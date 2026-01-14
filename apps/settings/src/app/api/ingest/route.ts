import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ============ INLINE CODE - NO EXTERNAL MODULE ============

// UUID generator
function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

// Types
interface ParsedMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ParsedConversation {
  id: string
  title: string
  source: string
  messages: ParsedMessage[]
}

interface Chunk {
  id: string
  conversationId: string
  content: string
  source: string
  title: string
}

// Simple parser - treats file as single conversation
function parseFile(content: string, filename: string): ParsedConversation[] {
  // Se è JSON, prova a parsare come Claude export
  if (filename.endsWith('.json')) {
    try {
      const data = JSON.parse(content)
      const items = Array.isArray(data) ? data : data.conversations || []
      const conversations: ParsedConversation[] = []
      
      for (const conv of items) {
        const messages: ParsedMessage[] = []
        const msgs = conv.chat_messages || conv.messages || []
        
        for (const msg of msgs) {
          const role = msg.sender === 'human' || msg.role === 'user' ? 'user' : 'assistant'
          const text = typeof msg.text === 'string' ? msg.text : 
                       typeof msg.content === 'string' ? msg.content : ''
          
          if (text.trim()) {
            messages.push({ role, content: text.trim() })
          }
        }
        
        if (messages.length > 0) {
          conversations.push({
            id: conv.uuid || conv.id || generateId(),
            title: conv.name || conv.title || 'Conversazione',
            source: 'claude',
            messages,
          })
        }
      }
      return conversations
    } catch {
      // Se parsing JSON fallisce, tratta come testo
    }
  }

  // Default: tratta tutto come singola conversazione
  const title = filename.replace(/^\d+_/, '').replace(/\.(md|txt)$/, '') || 'Documento'
  
  return [{
    id: generateId(),
    title,
    source: 'document',
    messages: [{ role: 'user', content: content.trim() }],
  }]
}

// Simple chunker
function chunkConversations(conversations: ParsedConversation[]): Chunk[] {
  const CHUNK_SIZE = 1500
  const chunks: Chunk[] = []

  for (const conv of conversations) {
    const fullText = conv.messages
      .map(m => `${m.role === 'user' ? 'Utente' : 'Assistente'}: ${m.content}`)
      .join('\n\n')

    // Split in chunks semplici
    if (fullText.length <= CHUNK_SIZE) {
      chunks.push({
        id: `${conv.id}-0`,
        conversationId: conv.id,
        content: fullText,
        source: conv.source,
        title: conv.title,
      })
    } else {
      let start = 0
      let idx = 0
      while (start < fullText.length) {
        const end = Math.min(start + CHUNK_SIZE, fullText.length)
        chunks.push({
          id: `${conv.id}-${idx}`,
          conversationId: conv.id,
          content: fullText.slice(start, end).trim(),
          source: conv.source,
          title: conv.title,
        })
        start = end
        idx++
      }
    }
  }

  return chunks
}

// Embeddings via Cloudflare
async function generateEmbeddings(
  texts: string[],
  accountId: string,
  apiToken: string
): Promise<number[][]> {
  console.log(`[Embed] Generating ${texts.length} embeddings...`)
  
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/baai/bge-small-en-v1.5`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: texts }),
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Cloudflare error: ${response.status} - ${errorText}`)
  }

  const data = await response.json() as { 
    success: boolean
    result: { data: number[][] }
  }
  
  if (!data.success || !data.result?.data) {
    throw new Error('Cloudflare embedding failed')
  }

  return data.result.data
}

// ============ API HANDLERS ============

export async function GET() {
  return NextResponse.json({ status: 'ok', method: 'GET' })
}

export async function POST(request: NextRequest) {
  console.log('[ingest] POST received')
  
  try {
    const body = await request.json()
    const { files, userId, userEmail } = body
    
    console.log(`[ingest] userId: ${userId}, files: ${files?.length || 0}`)

    if (!files || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No files provided' },
        { status: 400 }
      )
    }

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID missing' },
        { status: 400 }
      )
    }

    // Supabase client (service role)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Ensure user exists
    console.log('[ingest] Checking user...')
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .single()

    if (!existingUser) {
      console.log('[ingest] Creating user...')
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          id: userId,
          email: userEmail || 'unknown@email.com',
          has_rag: false,
          tier: 'beta',
        })

      if (insertError) {
        console.error('[ingest] User creation failed:', insertError)
        return NextResponse.json(
          { success: false, error: `User creation failed: ${insertError.message}` },
          { status: 500 }
        )
      }
    }

    // Parse files
    console.log('[ingest] Parsing files...')
    const allConversations: ParsedConversation[] = []
    for (const file of files) {
      const convs = parseFile(file.content, file.filename)
      allConversations.push(...convs)
    }
    console.log(`[ingest] Found ${allConversations.length} conversations`)

    if (allConversations.length === 0) {
      return NextResponse.json({
        success: true,
        conversationsProcessed: 0,
        chunksCreated: 0,
      })
    }

    // Chunk
    console.log('[ingest] Chunking...')
    const chunks = chunkConversations(allConversations)
    console.log(`[ingest] Created ${chunks.length} chunks`)

    if (chunks.length === 0) {
      return NextResponse.json({
        success: true,
        conversationsProcessed: allConversations.length,
        chunksCreated: 0,
      })
    }

    // Generate embeddings
    console.log('[ingest] Generating embeddings...')
    const texts = chunks.map(c => c.content)
    const embeddings = await generateEmbeddings(
      texts,
      process.env.CLOUDFLARE_ACCOUNT_ID!,
      process.env.CLOUDFLARE_API_TOKEN!
    )
    console.log(`[ingest] Got ${embeddings.length} embeddings`)

    // Save to Supabase
    console.log('[ingest] Saving to Supabase...')
    const rows = chunks.map((chunk, i) => ({
      id: chunk.id,
      user_id: userId,
      content: chunk.content,
      embedding: embeddings[i],
      source: chunk.source,
      title: chunk.title,
      conversation_id: chunk.conversationId,
    }))

    const { error: insertError } = await supabase
      .from('chat_chunks')
      .upsert(rows)

    if (insertError) {
      console.error('[ingest] Insert error:', insertError)
      return NextResponse.json(
        { success: false, error: `Insert failed: ${insertError.message}` },
        { status: 500 }
      )
    }

    // Update user has_rag
    await supabase
      .from('users')
      .update({ has_rag: true })
      .eq('id', userId)

    console.log('[ingest] Done!')
    return NextResponse.json({
      success: true,
      conversationsProcessed: allConversations.length,
      chunksCreated: chunks.length,
    })

  } catch (error) {
    console.error('[ingest] Error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

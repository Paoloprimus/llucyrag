import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp?: number
}

// Generate embedding using Cloudflare
async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/baai/bge-small-en-v1.5`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: [text] }),
    }
  )

  if (!response.ok) {
    throw new Error('Embedding generation failed')
  }

  const data = await response.json() as { 
    success: boolean
    result: { data: number[][] }
  }
  
  return data.result.data[0]
}

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

export async function POST(request: NextRequest) {
  try {
    const { messages, userId, sessionId } = await request.json()

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ success: true }) // Nothing to save
    }

    if (!userId) {
      return NextResponse.json({ success: false, error: 'User ID required' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Format messages as a conversation chunk
    const content = messages
      .map((m: Message) => `${m.role === 'user' ? 'Utente' : 'llucy'}: ${m.content}`)
      .join('\n\n')

    // Generate embedding
    const embedding = await generateEmbedding(content)

    // Create chunk ID based on session
    const chunkId = `llucy-${sessionId}-${Date.now()}`

    // Save to chat_chunks
    const { error: insertError } = await supabase
      .from('chat_chunks')
      .upsert({
        id: chunkId,
        user_id: userId,
        content,
        embedding,
        source: 'llucy',
        title: `Conversazione con llucy`,
        conversation_id: sessionId,
      })

    if (insertError) {
      console.error('Error saving chat chunk:', insertError)
      return NextResponse.json({ success: false, error: insertError.message }, { status: 500 })
    }

    // Also save individual messages to chat_messages for history
    for (const msg of messages) {
      await supabase
        .from('chat_messages')
        .insert({
          id: generateId(),
          user_id: userId,
          role: msg.role,
          content: msg.content,
          created_at: msg.timestamp ? new Date(msg.timestamp).toISOString() : new Date().toISOString(),
        })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Save chat error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

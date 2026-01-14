import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

const SYSTEM_PROMPT = `Sei llucy, un'assistente gentile e presente. 
Parli in italiano, in modo naturale e conciso.
Non usi emoji. Non fai liste puntate a meno che non sia necessario.
Sei qui per ascoltare, riflettere insieme, e aiutare a mettere ordine nei pensieri.
Rispondi in modo breve e diretto, come in una conversazione vera.`

const RAG_CONTEXT_PROMPT = `

Hai accesso alla memoria delle conversazioni passate dell'utente con altri assistenti AI.
Usa queste informazioni per dare risposte più personalizzate e contestuali, 
ma non citare esplicitamente "le tue conversazioni passate" a meno che non sia rilevante.

Contesto dalle conversazioni passate:
`

interface Message {
  role: 'user' | 'assistant'
  content: string
}

// Generate embedding using Cloudflare
async function generateQueryEmbedding(text: string): Promise<number[]> {
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

// Search RAG for relevant context
async function searchRAG(userId: string, query: string): Promise<string | null> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Check if user has RAG enabled
    const { data: user } = await supabase
      .from('users')
      .select('has_rag')
      .eq('id', userId)
      .single()

    if (!user?.has_rag) {
      return null
    }

    // Generate embedding for query
    const embedding = await generateQueryEmbedding(query)

    // Search in Supabase using pgvector
    const { data: chunks, error } = await supabase.rpc('match_chunks', {
      query_embedding: embedding,
      match_count: 3,
      filter_user_id: userId,
    })

    if (error || !chunks || chunks.length === 0) {
      return null
    }

    // Format context from chunks
    const context = chunks
      .map((c: { title: string; content: string; similarity: number }) => 
        `[${c.title}]\n${c.content}`
      )
      .join('\n\n---\n\n')

    return context

  } catch (error) {
    console.error('RAG search error:', error)
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const { message, history = [], userId } = await request.json()

    if (!message) {
      return NextResponse.json({ error: 'Messaggio mancante' }, { status: 400 })
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'API key non configurata' }, { status: 500 })
    }

    // Build conversation
    const messages: { role: 'user' | 'assistant'; content: string }[] = [
      ...history.map((m: Message) => ({
        role: m.role,
        content: m.content,
      })),
      { role: 'user' as const, content: message },
    ]

    // Search RAG for context
    let systemPrompt = SYSTEM_PROMPT
    if (userId) {
      const ragContext = await searchRAG(userId, message)
      if (ragContext) {
        systemPrompt = SYSTEM_PROMPT + RAG_CONTEXT_PROMPT + ragContext
      }
    }

    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    })

    const assistantResponse = response.content[0].type === 'text' 
      ? response.content[0].text 
      : ''

    return NextResponse.json({ response: assistantResponse })

  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { error: 'Errore nella risposta' },
      { status: 500 }
    )
  }
}

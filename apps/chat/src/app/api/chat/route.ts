import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

const SYSTEM_PROMPT = `Sei llucy, un'assistente gentile e presente. 
Parli in italiano, in modo naturale e conciso.
Non usi emoji. Non fai liste puntate a meno che non sia necessario.
Sei qui per ascoltare, riflettere insieme, e aiutare a mettere ordine nei pensieri.
Rispondi in modo breve e diretto, come in una conversazione vera.`

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export async function POST(request: NextRequest) {
  try {
    const { message, history = [] } = await request.json()

    if (!message) {
      return NextResponse.json({ error: 'Messaggio mancante' }, { status: 400 })
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'API key non configurata' }, { status: 500 })
    }

    // Costruisci la conversazione
    const messages: { role: 'user' | 'assistant'; content: string }[] = [
      ...history.map((m: Message) => ({
        role: m.role,
        content: m.content,
      })),
      { role: 'user' as const, content: message },
    ]

    // TODO: Se RAG è abilitato, cerca contesto rilevante
    // const ragContext = await searchRAG(userId, message)
    // if (ragContext) { ... aggiungi al prompt ... }

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250514',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
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

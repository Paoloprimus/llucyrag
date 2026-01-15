import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { 
  parseTemporalIntent, 
  formatDateIT, 
  formatTimeIT,
  type TemporalRange 
} from '@/lib/temporal-parser'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

// System prompt base - sempre presente
const BASE_PROMPT = `Sei LLucy, un'assistente personale gentile e presente.
Parli in italiano, in modo naturale e conciso.
Non usi emoji. Non fai liste puntate a meno che non sia necessario.
Sei qui per ascoltare, riflettere insieme, e aiutare a mettere ordine nei pensieri.
Rispondi in modo breve e diretto, come in una conversazione vera.

Non ostentare mai ciò che sai. Non offrire aiuto non richiesto.
A volte la risposta migliore è breve, o è una domanda, o è silenzio.
Sei un'amica molto in gamba, non un supereroe.`

// Prompt aggiuntivo quando RAG trova contesto
const RAG_CONTEXT_PROMPT = `

Hai accesso alla memoria delle conversazioni passate.
Usa queste informazioni per dare risposte più personalizzate e contestuali,
ma non citare esplicitamente "le tue conversazioni passate" o "nel mio database".
Usa la memoria in modo naturale, come un'amica che ricorda.

Contesto dalle conversazioni passate:
`

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface UserData {
  name: string | null
  modules: {
    diario?: boolean
    obiettivi?: boolean
    benessere?: boolean
    creativo?: boolean
    relazioni?: boolean
    agenda?: boolean
  }
  tier: string
}

// Costruisce il contesto temporale (CORE - sempre presente)
function buildContextPrompt(user: UserData | null): string {
  const now = new Date()
  const dateStr = formatDateIT(now)
  const timeStr = formatTimeIT(now)
  
  let context = `

Informazioni contestuali:
- Data: ${dateStr}
- Ora: ${timeStr}`

  if (user?.name) {
    context += `
- L'utente si chiama: ${user.name}`
  }

  // Moduli attivi (per Premium/Pro)
  if (user?.modules) {
    const activeModules = Object.entries(user.modules)
      .filter(([_, active]) => active)
      .map(([name]) => name)
    
    if (activeModules.length > 0) {
      context += `
- Moduli attivi: ${activeModules.join(', ')}`
    }
  }

  return context
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

// Search RAG with optional temporal filter
async function searchRAG(
  userId: string, 
  query: string, 
  temporalRange: TemporalRange | null,
  supabase: ReturnType<typeof createClient>
): Promise<string | null> {
  try {
    // Generate embedding for query
    const embedding = await generateQueryEmbedding(query)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let chunks: any[] | null = null

    if (temporalRange) {
      // Ricerca con filtro temporale
      console.log(`[RAG] Searching with temporal filter: ${temporalRange.description}`)
      
      const { data, error } = await supabase.rpc('match_chunks_in_range' as any, {
        query_embedding: embedding,
        match_count: 5,
        filter_user_id: userId,
        date_from: temporalRange.from.toISOString(),
        date_to: temporalRange.to.toISOString(),
      } as any)

      if (error) {
        console.error('[RAG] Temporal search error:', error)
        // Fallback a ricerca normale
        const { data: fallbackData } = await supabase.rpc('match_chunks' as any, {
          query_embedding: embedding,
          match_count: 3,
          filter_user_id: userId,
        } as any)
        chunks = fallbackData
      } else {
        chunks = data
      }
    } else {
      // Ricerca semantica normale
      const { data, error } = await supabase.rpc('match_chunks' as any, {
        query_embedding: embedding,
        match_count: 3,
        filter_user_id: userId,
      } as any)

      if (error) {
        console.error('[RAG] Search error:', error)
        return null
      }
      chunks = data
    }

    if (!chunks || chunks.length === 0) {
      return null
    }

    // Format context from chunks
    const context = chunks
      .map((c: { title: string; content: string; similarity: number; created_at?: string }) => {
        // Includi la data se disponibile e rilevante
        const dateInfo = c.created_at 
          ? ` (${new Date(c.created_at).toLocaleDateString('it-IT')})`
          : ''
        return `[${c.title}${dateInfo}]\n${c.content}`
      })
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

    // Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Fetch user data
    let userData: UserData | null = null
    if (userId) {
      const { data: user } = await supabase
        .from('users')
        .select('name, modules, tier')
        .eq('id', userId)
        .single()
      
      userData = user
    }

    // Parse temporal intent (CORE - sempre attivo)
    const temporalRange = parseTemporalIntent(message)
    if (temporalRange) {
      console.log(`[Temporal] Detected: "${temporalRange.description}"`)
    }

    // Build conversation
    const messages: { role: 'user' | 'assistant'; content: string }[] = [
      ...history.map((m: Message) => ({
        role: m.role,
        content: m.content,
      })),
      { role: 'user' as const, content: message },
    ]

    // Build system prompt
    let systemPrompt = BASE_PROMPT
    
    // Aggiungi contesto temporale (CORE - sempre)
    systemPrompt += buildContextPrompt(userData)

    // Search RAG if Diario is enabled
    if (userId && userData?.modules?.diario) {
      const ragContext = await searchRAG(userId, message, temporalRange, supabase)
      if (ragContext) {
        systemPrompt += RAG_CONTEXT_PROMPT + ragContext
      } else if (temporalRange) {
        // Se c'era un intent temporale ma niente risultati
        systemPrompt += `

Nota: l'utente chiede di "${temporalRange.description}" ma non ho trovato 
conversazioni in quel periodo. Puoi dirlo gentilmente se rilevante.`
      }
    }

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
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

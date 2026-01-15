import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { 
  parseTemporalIntent, 
  formatDateIT, 
  formatTimeIT,
  type TemporalRange 
} from '@/lib/temporal-parser'
import { 
  detectMood, 
  moodToDescription,
  type MoodLevel 
} from '@/lib/mood-detector'

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

// Prompt per modulo Obiettivi
const GOALS_PROMPT = `

Hai accesso agli obiettivi dell'utente. Il tuo ruolo NON è fare da task manager,
ma aiutare a chiarire cosa vuole veramente e perché.

Quando parli di obiettivi:
- Aiuta a esplorare il "perché" dietro un desiderio
- Fai domande che aprono riflessioni, non che chiudono
- Collega naturalmente se qualcosa nel RAG è rilevante (persone, esperienze passate)
- Non imporre timeline o step intermedi (a meno che l'utente non li chieda esplicitamente)
- Celebra la chiarezza, non la produttività

Obiettivi attuali:`

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

interface MoodSummary {
  avg_mood: number
  mood_trend: string
  dominant_mood: MoodLevel
  entry_count: number
}

interface Goal {
  id: string
  title: string
  description: string | null
  why: string | null
  status: string
  related_topics: string[] | null
  related_people: string[] | null
}

// Costruisce il contesto temporale (CORE - sempre presente)
function buildContextPrompt(user: UserData | null, moodContext?: string): string {
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

  // Mood context (se disponibile)
  if (moodContext) {
    context += `
${moodContext}`
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

// Tipo per i chunk RAG
interface RAGChunk {
  id: string
  content: string
  source: string
  title: string
  conversation_id: string
  created_at?: string
  similarity: number
}

// Search RAG with optional temporal filter
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function searchRAG(
  userId: string, 
  query: string, 
  temporalRange: TemporalRange | null,
  supabase: any
): Promise<string | null> {
  try {
    // Generate embedding for query
    const embedding = await generateQueryEmbedding(query)

    let chunks: RAGChunk[] = []

    if (temporalRange) {
      // Ricerca con filtro temporale
      console.log(`[RAG] Searching with temporal filter: ${temporalRange.description}`)
      
      const { data, error } = await (supabase.rpc as Function)('match_chunks_in_range', {
        query_embedding: embedding,
        match_count: 5,
        filter_user_id: userId,
        date_from: temporalRange.from.toISOString(),
        date_to: temporalRange.to.toISOString(),
      })

      if (error) {
        console.error('[RAG] Temporal search error:', error)
        // Fallback a ricerca normale
        const { data: fallbackData } = await (supabase.rpc as Function)('match_chunks', {
          query_embedding: embedding,
          match_count: 3,
          filter_user_id: userId,
        })
        chunks = (fallbackData as RAGChunk[]) || []
      } else {
        chunks = (data as RAGChunk[]) || []
      }
    } else {
      // Ricerca semantica normale
      const { data, error } = await (supabase.rpc as Function)('match_chunks', {
        query_embedding: embedding,
        match_count: 3,
        filter_user_id: userId,
      })

      if (error) {
        console.error('[RAG] Search error:', error)
        return null
      }
      chunks = (data as RAGChunk[]) || []
    }

    if (chunks.length === 0) {
      return null
    }

    // Format context from chunks
    const context = chunks
      .map((c) => {
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

// Salva mood entry nel database
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function saveMoodEntry(
  userId: string,
  mood: MoodLevel,
  intensity: number,
  keywords: string[],
  sessionId: string | null,
  supabase: any
): Promise<void> {
  try {
    const { error } = await supabase
      .from('mood_entries')
      .insert({
        user_id: userId,
        mood,
        intensity,
        keywords,
        session_id: sessionId,
      })
    
    if (error) {
      console.error('[Mood] Save error:', error)
    } else {
      console.log(`[Mood] Saved: ${mood} (${intensity.toFixed(2)})`)
    }
  } catch (e) {
    console.error('[Mood] Save exception:', e)
  }
}

// Ottieni sommario mood recente
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getMoodSummary(userId: string, supabase: any): Promise<MoodSummary | null> {
  try {
    const { data, error } = await (supabase.rpc as Function)('get_mood_summary', {
      p_user_id: userId,
      p_days: 7,
    })
    
    if (error || !data || data.length === 0) {
      return null
    }
    
    return data[0] as MoodSummary
  } catch (e) {
    console.error('[Mood] Summary error:', e)
    return null
  }
}

// Costruisce contesto mood per il prompt
function buildMoodContext(summary: MoodSummary | null, currentMood: MoodLevel | null): string {
  if (!summary && !currentMood) {
    return ''
  }
  
  let context = '\n- Stato emotivo:'
  
  if (currentMood) {
    context += ` in questo momento sembra ${moodToDescription(currentMood)}`
  }
  
  if (summary && summary.entry_count >= 3) {
    const trendText = summary.mood_trend === 'miglioramento' 
      ? 'in miglioramento'
      : summary.mood_trend === 'peggioramento'
        ? 'in calo'
        : 'stabile'
    
    context += currentMood 
      ? `. Nell'ultima settimana umore ${trendText}`
      : ` trend ultima settimana: ${trendText}`
  }
  
  return context
}

// Ottieni goals attivi
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getActiveGoals(userId: string, supabase: any): Promise<Goal[]> {
  try {
    const { data, error } = await supabase
      .from('goals')
      .select('id, title, description, why, status, related_topics, related_people')
      .eq('user_id', userId)
      .in('status', ['exploring', 'active'])
      .order('created_at', { ascending: false })
      .limit(10)
    
    if (error) {
      console.error('[Goals] Fetch error:', error)
      return []
    }
    
    return data || []
  } catch (e) {
    console.error('[Goals] Error:', e)
    return []
  }
}

// Costruisce contesto goals per il prompt
function buildGoalsContext(goals: Goal[]): string {
  if (goals.length === 0) {
    return '\nNessun obiettivo definito ancora.'
  }
  
  return goals.map(g => {
    let goalText = `\n- "${g.title}"`
    if (g.status === 'exploring') goalText += ' (in esplorazione)'
    if (g.why) goalText += `\n  Perché: ${g.why}`
    if (g.related_people && g.related_people.length > 0) {
      goalText += `\n  Persone collegate: ${g.related_people.join(', ')}`
    }
    return goalText
  }).join('')
}

export async function POST(request: NextRequest) {
  try {
    const { message, history = [], userId, sessionId } = await request.json()

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

    // Detect mood from user message (se Diario attivo)
    let currentMood: MoodLevel | null = null
    let moodContext = ''
    
    if (userId && userData?.modules?.diario) {
      // Rileva mood dal messaggio corrente
      const moodAnalysis = detectMood(message)
      if (moodAnalysis && moodAnalysis.confidence >= 0.3) {
        currentMood = moodAnalysis.mood
        console.log(`[Mood] Detected: ${moodAnalysis.mood} (conf: ${moodAnalysis.confidence.toFixed(2)})`)
        
        // Salva mood entry (async, non blocca)
        saveMoodEntry(
          userId,
          moodAnalysis.mood,
          moodAnalysis.intensity,
          moodAnalysis.keywords,
          sessionId || null,
          supabase
        )
      }
      
      // Ottieni sommario mood recente
      const moodSummary = await getMoodSummary(userId, supabase)
      moodContext = buildMoodContext(moodSummary, currentMood)
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
    
    // Aggiungi contesto temporale e mood (CORE - sempre)
    systemPrompt += buildContextPrompt(userData, moodContext)

    // Aggiungi contesto obiettivi se modulo attivo
    if (userId && userData?.modules?.obiettivi) {
      const activeGoals = await getActiveGoals(userId, supabase)
      if (activeGoals.length > 0) {
        systemPrompt += GOALS_PROMPT + buildGoalsContext(activeGoals)
      }
    }

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

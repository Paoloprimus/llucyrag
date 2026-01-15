# LLucy Core - Comportamenti Fondamentali

> Comportamenti e capacità che LLucy ha SEMPRE, indipendentemente dai moduli attivi.
> Questi definiscono l'intelligenza base dell'assistente.

---

## 1. Identità

LLucy è un'assistente personale gentile, presente, e intelligente.

**Caratteristiche fisse:**
- Parla italiano naturale, mai robotico
- Non usa emoji (salvo richiesta esplicita)
- Risposte concise ma complete
- Tono: caldo, mai giudicante, leggermente intimo
- Sa quando fare domande e quando rispondere

**System Prompt Base:**
```
Sei LLucy, un'assistente personale gentile e presente.
Parli in italiano, in modo naturale e conciso.
Non usi emoji. Non fai liste puntate a meno che non sia necessario.
Sei qui per ascoltare, riflettere insieme, e aiutare a mettere ordine nei pensieri.
Rispondi in modo breve e diretto, come in una conversazione vera.
```

---

## 2. Consapevolezza Temporale

LLucy capisce SEMPRE i riferimenti temporali e agisce di conseguenza.

### Riferimenti supportati

| Input utente | Interpretazione |
|--------------|-----------------|
| "ieri" | data corrente - 1 giorno |
| "l'altro ieri" | data corrente - 2 giorni |
| "la settimana scorsa" | 7 giorni fa → oggi |
| "il mese scorso" | mese precedente |
| "a dicembre" | 1-31 dicembre (anno corrente o precedente) |
| "lunedì" | ultimo lunedì passato |
| "stamattina" | oggi, 00:00 → 12:00 |
| "qualche giorno fa" | ~3-5 giorni fa (fuzzy) |
| "di recente" | ultimi 7 giorni |
| "tempo fa" | 2-4 settimane fa (fuzzy) |

### Implementazione

```typescript
// lib/temporal-parser.ts

interface TemporalRange {
  from: Date
  to: Date
  fuzzy: boolean // true se range approssimativo
}

export function parseTemporalIntent(message: string): TemporalRange | null {
  const now = new Date()
  const text = message.toLowerCase()
  
  // Pattern matching
  if (text.includes('ieri')) {
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    return {
      from: startOfDay(yesterday),
      to: endOfDay(yesterday),
      fuzzy: false
    }
  }
  
  if (text.includes('settimana scorsa') || text.includes('la scorsa settimana')) {
    const weekAgo = new Date(now)
    weekAgo.setDate(weekAgo.getDate() - 7)
    return {
      from: startOfDay(weekAgo),
      to: endOfDay(now),
      fuzzy: false
    }
  }
  
  if (text.includes('di recente') || text.includes('ultimamente')) {
    const recent = new Date(now)
    recent.setDate(recent.getDate() - 7)
    return {
      from: startOfDay(recent),
      to: endOfDay(now),
      fuzzy: true
    }
  }
  
  // ... altri pattern
  
  return null // Nessun intent temporale rilevato
}

export function hasTemporalIntent(message: string): boolean {
  return parseTemporalIntent(message) !== null
}
```

### Uso nel Chat API

```typescript
// In /api/chat/route.ts

import { parseTemporalIntent } from '@/lib/temporal-parser'

// Durante la ricerca RAG
const temporalRange = parseTemporalIntent(message)

if (temporalRange) {
  // Cerca con filtro temporale
  chunks = await searchRAGWithDateFilter(userId, message, temporalRange)
} else {
  // Ricerca semantica normale
  chunks = await searchRAG(userId, message)
}
```

### Query Supabase con filtro temporale

```typescript
async function searchRAGWithDateFilter(
  userId: string, 
  query: string, 
  range: TemporalRange
) {
  const supabase = createClient(...)
  
  // Prima filtra per data, poi cerca semanticamente
  const { data: chunks } = await supabase
    .from('chat_chunks')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', range.from.toISOString())
    .lte('created_at', range.to.toISOString())
    .order('created_at', { ascending: false })
    .limit(10)
  
  // Se pochi risultati, fai anche ricerca semantica nel range
  if (chunks && chunks.length < 3) {
    const embedding = await generateQueryEmbedding(query)
    const { data: semanticChunks } = await supabase.rpc('match_chunks_in_range', {
      query_embedding: embedding,
      match_count: 5,
      filter_user_id: userId,
      date_from: range.from.toISOString(),
      date_to: range.to.toISOString(),
    })
    return semanticChunks
  }
  
  return chunks
}
```

### Funzione SQL aggiuntiva

```sql
-- In Supabase: ricerca semantica con filtro data
create or replace function match_chunks_in_range(
  query_embedding vector(384),
  match_count int default 5,
  filter_user_id uuid default null,
  date_from timestamp with time zone default null,
  date_to timestamp with time zone default null
)
returns table (
  id text,
  content text,
  source text,
  title text,
  conversation_id text,
  created_at timestamp with time zone,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    cc.id,
    cc.content,
    cc.source,
    cc.title,
    cc.conversation_id,
    cc.created_at,
    1 - (cc.embedding <=> query_embedding) as similarity
  from chat_chunks cc
  where cc.user_id = filter_user_id
    and (date_from is null or cc.created_at >= date_from)
    and (date_to is null or cc.created_at <= date_to)
  order by cc.embedding <=> query_embedding
  limit match_count;
end;
$$;
```

---

## 3. Consapevolezza del Contesto

LLucy sa sempre:

| Informazione | Come la ottiene |
|--------------|-----------------|
| Nome utente | `users.name` |
| Ora corrente | `new Date()` |
| Giorno settimana | Derivato da data |
| Moduli attivi | `users.modules` |
| Conversazione corrente | `history` passato al API |

### Nel System Prompt

```typescript
const contextPrompt = `
Informazioni contestuali:
- Utente: ${userName || 'non specificato'}
- Data: ${formatDate(new Date(), 'EEEE d MMMM yyyy', { locale: it })}
- Ora: ${formatDate(new Date(), 'HH:mm')}
- Moduli attivi: ${activeModules.join(', ') || 'nessuno'}
`
```

Questo permette conversazioni come:
- "Buongiorno!" → LLucy sa se è mattina o sera
- "Che giorno è?" → Risponde correttamente
- "Ci vediamo lunedì" → Capisce quale lunedì

---

## 4. Memoria di Sessione

Anche SENZA moduli attivi, LLucy ricorda la conversazione corrente.

**Implementazione attuale:**
- `localStorage` salva messaggi della sessione
- Ultimi 10 messaggi passati come `history` al API
- Cancellati dopo 24h o manualmente

**Comportamento:**
- LLucy può riferirsi a cose dette prima nella stessa sessione
- "Come dicevi prima..." è sempre possibile
- Non confonde sessioni diverse

---

## 5. Comportamento Adattivo ai Moduli

LLucy cambia comportamento in base ai moduli attivi:

| Moduli attivi | Comportamento aggiuntivo |
|---------------|--------------------------|
| Nessuno | Solo conversazione base |
| Diario | Può cercare in conversazioni passate, nota pattern |
| Obiettivi | Collega conversazione a goal, propone check-in |
| Diario + Obiettivi | Tutto sopra + connessioni incrociate |

### Logica nel prompt

```typescript
let systemPrompt = BASE_PROMPT + CONTEXT_PROMPT

if (modules.diario) {
  systemPrompt += DIARIO_PROMPT
  // + RAG context se trovato
}

if (modules.obiettivi) {
  systemPrompt += COACHING_PROMPT
  // + goals context
}
```

---

## 6. Privacy e Trasparenza

LLucy è sempre trasparente su cosa sa e cosa no:

**Frasi tipo:**
- "Non ho memoria delle nostre conversazioni passate perché il modulo Diario non è attivo."
- "Basandomi su quello che mi hai raccontato in passato..."
- "Non ho informazioni su questo, vuoi raccontarmi di più?"

**Mai:**
- Inventare ricordi che non ha
- Fingere di sapere cose che non sa
- Accedere a dati senza che l'utente lo sappia

---

## 7. Limiti Espliciti

LLucy sa cosa NON può fare e lo comunica:

- "Non posso impostare promemoria, ma posso aiutarti a pianificare."
- "Non ho accesso al tuo calendario, ma dimmi i tuoi impegni."
- "Non posso navigare internet, ma posso ragionare su quello che mi dici."

---

## Implementazione Priorità

1. **P0 (essenziale)**: Consapevolezza temporale nel RAG
2. **P1 (importante)**: Contesto data/ora nel prompt
3. **P2 (nice-to-have)**: Parser temporale avanzato (mesi, anni)
4. **P3 (futuro)**: Integrazione calendario esterno

---

*Documento creato: Gennaio 2026*

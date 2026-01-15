# Modulo Diario (Memoria)

> Il sistema di memoria a lungo termine di LLucy.
> Status: **Implementato (base)** | Priorità: Alta | Evoluzione: In corso

---

## 1. Cos'è il Diario

Il Diario è la **memoria a lungo termine** di LLucy. Permette di:

- Ricordare conversazioni passate (con LLucy e altri AI)
- Trovare pattern nei pensieri dell'utente
- Dare risposte contestuali basate sulla storia personale
- Costruire una relazione che evolve nel tempo

**Senza Diario**: LLucy ricorda solo la sessione corrente (24h max)
**Con Diario**: LLucy può attingere a mesi/anni di conversazioni

---

## 2. Architettura

```
┌─────────────────────────────────────────────────────────────┐
│                         FONTI                                │
├─────────────┬─────────────┬─────────────┬──────────────────┤
│  ChatGPT    │   Claude    │   Gemini    │  LLucy stessa    │
│  (export)   │  (export)   │  (export)   │  (auto-sync)     │
└──────┬──────┴──────┬──────┴──────┬──────┴────────┬─────────┘
       │             │             │               │
       └─────────────┴──────┬──────┴───────────────┘
                            ▼
                    ┌───────────────┐
                    │    PARSER     │
                    │ (per formato) │
                    └───────┬───────┘
                            ▼
                    ┌───────────────┐
                    │   CHUNKER     │
                    │ (1500 chars)  │
                    └───────┬───────┘
                            ▼
                    ┌───────────────┐
                    │   EMBEDDER    │
                    │ (Cloudflare)  │
                    └───────┬───────┘
                            ▼
                    ┌───────────────┐
                    │   SUPABASE    │
                    │  (pgvector)   │
                    └───────────────┘
```

---

## 3. Database Schema

```sql
-- Già implementato in schema.sql
create table chat_chunks (
  id text primary key,
  user_id uuid references users(id) on delete cascade,
  content text not null,
  embedding vector(384),  -- bge-small-en-v1.5
  source text not null,   -- 'chatgpt', 'claude', 'llucy', etc.
  title text,
  conversation_id text,
  created_at timestamp with time zone default now()
);
```

### Fonti supportate

| Source | Formato | Parser |
|--------|---------|--------|
| `chatgpt` | Markdown (.md) | `parseChatGPTMarkdown` |
| `claude` | JSON (.json) | `parseClaudeJSON` |
| `gemini` | Markdown (.md) | `parseGeminiMarkdown` |
| `deepseek` | Markdown (.md) | `parseDeepseekMarkdown` |
| `llucy` | Auto-generato | Auto-sync |
| `document` | Testo generico | Fallback parser |

---

## 4. Funzionalità Attuali

### 4.1 Upload Manuale (✅ Implementato)

L'utente può caricare export da altri AI su `settings.llucy.it`:

1. Drag & drop file nella zona upload
2. Sistema rileva formato automaticamente
3. Parsing → Chunking → Embedding → Storage
4. Feedback con conteggio conversazioni/chunks

**Limiti attuali:**
- Max 4.5MB per batch (limite Vercel)
- File grandi vanno splittati (script forniti)

### 4.2 Auto-Sync Conversazioni LLucy (✅ Parziale)

Ogni conversazione con LLucy viene salvata automaticamente:

```typescript
// In page.tsx, dopo ogni risposta
if (user?.id && modules.diario) {
  fetch('/api/save-chat', {
    method: 'POST',
    body: JSON.stringify({
      userId: user.id,
      conversation: [lastUserMessage, lastAssistantMessage],
    }),
  })
}
```

### 4.3 Ricerca Semantica (✅ Implementato)

```typescript
// match_chunks function in Supabase
const { data: chunks } = await supabase.rpc('match_chunks', {
  query_embedding: embedding,
  match_count: 5,
  filter_user_id: userId,
})
```

---

## 5. Funzionalità Pianificate

### 5.1 Sync Notturno Automatico

**Obiettivo**: Processare tutte le conversazioni del giorno in batch, di notte.

**Architettura:**

```
Durante il giorno                    Di notte (3:00 AM)
─────────────────                    ──────────────────
Messaggi salvati in                  Vercel Cron Job
`pending_messages`        ──────▶    processa → RAG
(tabella temporanea)                 svuota pending
```

**Schema aggiuntivo:**

```sql
create table pending_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  session_id text,
  role text not null,
  content text not null,
  created_at timestamp with time zone default now()
);

-- Index per batch processing
create index pending_user_date on pending_messages (user_id, created_at);
```

**Cron Job (Vercel):**

```typescript
// app/api/cron/sync-diario/route.ts
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  // Verifica cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Processa utenti con diario_auto_sync attivo
  const users = await getUsersWithAutoSync()
  
  for (const user of users) {
    const pending = await getPendingMessages(user.id)
    if (pending.length > 0) {
      await processToRAG(user.id, pending)
      await clearPendingMessages(user.id)
    }
  }

  return NextResponse.json({ processed: users.length })
}
```

**vercel.json:**

```json
{
  "crons": [
    {
      "path": "/api/cron/sync-diario",
      "schedule": "0 3 * * *"
    }
  ]
}
```

### 5.2 Toggle Auto-Sync

Nuovo campo in `modules`:

```typescript
modules: {
  diario: true,
  diario_auto_sync: true,  // ← nuovo
  obiettivi: false
}
```

**UI in Settings:**

```
Diario ✓
├── Memoria attiva
└── [ ] Sincronizza automaticamente ogni notte
```

### 5.3 Gestione Dati Utente

**Vista memoria:**
- Lista chunks raggruppati per fonte/data
- Preview contenuto
- Conteggio totale

**Azioni:**
- "Sincronizza ora" → trigger manuale del sync
- "Elimina tutto" → cancella tutti i chunks
- "Elimina per fonte" → cancella solo ChatGPT, solo Claude, etc.
- "Elimina periodo" → cancella chunks di un range di date

**API:**

```typescript
// DELETE /api/chunks
// ?userId=xxx                    → elimina tutto
// ?userId=xxx&source=chatgpt    → elimina per fonte
// ?userId=xxx&from=2025-01-01&to=2025-12-31  → elimina per periodo
```

---

## 6. Ricerca Temporale

Integrazione con LLucy Core per query temporali:

```typescript
// Quando l'utente chiede "ieri di cosa abbiamo parlato?"

const temporalRange = parseTemporalIntent(message)

if (temporalRange) {
  // Usa match_chunks_in_range (vedi LLUCY_CORE.md)
  chunks = await supabase.rpc('match_chunks_in_range', {
    query_embedding: embedding,
    match_count: 5,
    filter_user_id: userId,
    date_from: temporalRange.from,
    date_to: temporalRange.to,
  })
} else {
  // Ricerca semantica normale
  chunks = await supabase.rpc('match_chunks', {...})
}
```

---

## 7. Privacy e Sicurezza

### Principi

1. **Dati dell'utente, controllo dell'utente**
   - Può vedere cosa è salvato
   - Può cancellare in qualsiasi momento
   - Può esportare (futuro)

2. **Isolamento totale**
   - RLS garantisce che ogni utente veda solo i suoi dati
   - Nessun accesso cross-user possibile

3. **Trasparenza**
   - LLucy dice sempre quando usa la memoria
   - "Basandomi sulle nostre conversazioni passate..."

### Retention

- **Default**: Nessun limite (l'utente decide)
- **Opzione futura**: Auto-delete dopo X mesi

---

## 8. Metriche

| Metrica | Significato |
|---------|-------------|
| chunks_per_user | Quanto è "profonda" la memoria |
| sources_distribution | Da dove vengono i dati |
| search_latency_p95 | Performance ricerca |
| auto_sync_success_rate | Affidabilità sync notturno |

---

## 9. Implementazione Step-by-Step

### Fase 1: Completare Upload (✅ Fatto)
- [x] Parser multi-formato
- [x] Chunking
- [x] Embedding via Cloudflare
- [x] Storage in Supabase
- [x] UI upload in settings

### Fase 2: Auto-Sync Base (✅ Parziale)
- [x] Salvataggio conversazioni LLucy
- [ ] Tabella `pending_messages`
- [ ] Toggle `diario_auto_sync`

### Fase 3: Sync Notturno (⏳ Pianificato)
- [ ] Cron job Vercel
- [ ] Batch processing
- [ ] Error handling e retry

### Fase 4: Gestione Dati (⏳ Pianificato)
- [ ] Vista chunks in settings
- [ ] Eliminazione selettiva
- [ ] Export dati (GDPR)

### Fase 5: Ricerca Avanzata (⏳ Pianificato)
- [ ] Filtri temporali (vedi LLUCY_CORE.md)
- [ ] Filtri per fonte
- [ ] Highlighting risultati

---

## 10. Integrazione con Altri Moduli

### Con Obiettivi

```
Diario                          Obiettivi
───────                         ─────────
Pattern rilevati     ──────▶    Suggerimenti goal
Check-in goal        ◀──────    Salvati come chunks
```

Esempio:
- Diario nota che l'utente parla spesso di "stress lavoro"
- Obiettivi suggerisce: "Vuoi definire un obiettivo per gestire lo stress?"

### Con Moduli Futuri

Il Diario è la **base di conoscenza personale** su cui tutti i moduli possono appoggiarsi:

- **Agenda**: "La settimana scorsa avevi detto che oggi avevi una riunione importante..."
- **Salute**: Pattern su sonno, energia, umore nel tempo
- **Relazioni**: Chi menziona spesso, dinamiche ricorrenti

---

*Documento creato: Gennaio 2026*
*Ultimo aggiornamento: -*

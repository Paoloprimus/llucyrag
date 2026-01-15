# Modulo Obiettivi (Coaching)

> Guida allo sviluppo del modulo di goal-setting e coaching per LLucy.
> Status: **Pianificato** | Priorità: Alta | Complessità: Media

---

## 1. Filosofia

Il modulo Obiettivi trasforma LLucy da assistente conversazionale a **coach personale**. 
Non è un task manager: è uno spazio di riflessione strutturata che aiuta l'utente a:

- Chiarire cosa vuole veramente
- Definire obiettivi concreti e misurabili
- Monitorare i progressi con gentilezza
- Riflettere sui blocchi e celebrare i successi

**Principio chiave**: LLucy non giudica, accompagna.

---

## 2. Integrazione con Diario (RAG)

Il modulo Obiettivi si nutre del Diario e lo arricchisce:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   DIARIO    │────▶│  OBIETTIVI  │────▶│    CHAT     │
│   (RAG)     │◀────│   (Goals)   │◀────│  (LLucy)    │
└─────────────┘     └─────────────┘     └─────────────┘
     │                    │                    │
     └────────────────────┴────────────────────┘
              Contesto condiviso
```

### Flussi di integrazione:

1. **Diario → Obiettivi**: Pattern ricorrenti nelle conversazioni suggeriscono obiettivi
2. **Obiettivi → Diario**: Check-in e riflessioni sui goal vengono salvati nel RAG
3. **Chat → Entrambi**: LLucy può accedere a obiettivi e storia per risposte contestuali

---

## 3. Database Schema

```sql
-- Tabella obiettivi
create table goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  
  -- Core
  title text not null,
  description text,
  why text, -- Perché questo obiettivo è importante
  
  -- Timeframe
  type text default 'medium' check (type in ('daily', 'weekly', 'medium', 'long')),
  deadline date,
  
  -- Status
  status text default 'active' check (status in ('draft', 'active', 'paused', 'completed', 'abandoned')),
  progress int default 0 check (progress >= 0 and progress <= 100),
  
  -- Metadata
  tags text[], -- Es: ['salute', 'lavoro', 'relazioni']
  parent_goal_id uuid references goals(id), -- Per sotto-obiettivi
  
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  completed_at timestamp with time zone
);

-- Tabella check-in (riflessioni periodiche)
create table goal_checkins (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid references goals(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  
  progress_delta int, -- Quanto è cambiato il progress
  reflection text, -- Riflessione dell'utente
  blockers text, -- Ostacoli incontrati
  wins text, -- Vittorie/successi
  next_steps text, -- Prossimi passi
  mood text check (mood in ('struggling', 'neutral', 'good', 'great')),
  
  created_at timestamp with time zone default now()
);

-- RLS
alter table goals enable row level security;
alter table goal_checkins enable row level security;

create policy "Users own goals" on goals for all using (auth.uid() = user_id);
create policy "Users own checkins" on goal_checkins for all using (auth.uid() = user_id);

-- Index
create index goals_user_status on goals (user_id, status);
create index checkins_goal on goal_checkins (goal_id, created_at desc);
```

---

## 4. System Prompt (Coaching Mode)

Quando il modulo Obiettivi è attivo, il system prompt di LLucy si arricchisce:

```typescript
const COACHING_PROMPT = `
## Ruolo Aggiuntivo: Coach

Oltre al tuo ruolo di assistente, sei anche un coach gentile ma efficace.

### Principi di coaching:
1. **Ascolto attivo**: Prima capisci, poi suggerisci
2. **Domande potenti**: Preferisci domande che aprono riflessioni
3. **SMART implicito**: Guida verso obiettivi Specifici, Misurabili, Achievable, Rilevanti, Time-bound
4. **Celebra i piccoli passi**: Ogni progresso merita riconoscimento
5. **Esplora i blocchi**: I blocchi sono informazioni, non fallimenti

### Obiettivi attivi dell'utente:
{GOALS_CONTEXT}

### Comportamento:
- Se l'utente parla di qualcosa legato a un obiettivo, collegalo naturalmente
- Proponi check-in periodici senza essere invadente
- Quando rilevi un pattern dal Diario legato a un obiettivo, fallo notare gentilmente
- Non trasformare ogni conversazione in coaching: resta umana

### Domande utili:
- "Cosa ti aiuterebbe a fare il prossimo passo?"
- "Cosa ti sta bloccando in questo momento?"
- "Come ti sentiresti se raggiungessi questo obiettivo?"
- "Qual è la cosa più piccola che potresti fare oggi?"
`
```

---

## 5. API Endpoints

### `POST /api/goals`
Crea nuovo obiettivo

```typescript
// Request
{
  title: string
  description?: string
  why?: string
  type?: 'daily' | 'weekly' | 'medium' | 'long'
  deadline?: string
  tags?: string[]
  parent_goal_id?: string
}

// Response
{ success: true, goal: Goal }
```

### `GET /api/goals`
Lista obiettivi utente

```typescript
// Query params
?status=active,completed  // Filtro status
?type=medium,long         // Filtro tipo

// Response
{ goals: Goal[] }
```

### `PATCH /api/goals/[id]`
Aggiorna obiettivo (incluso progress)

### `POST /api/goals/[id]/checkin`
Registra check-in

```typescript
// Request
{
  progress_delta?: number  // Es: +10
  reflection?: string
  blockers?: string
  wins?: string
  next_steps?: string
  mood?: 'struggling' | 'neutral' | 'good' | 'great'
}
```

### `GET /api/goals/context`
Restituisce contesto obiettivi per il prompt (usato internamente da /api/chat)

---

## 6. UI Components

### Settings (settings.llucy.it)

```
Moduli
├── Diario ✓
└── Obiettivi ○ ← Toggle

Se Obiettivi è attivo:
┌────────────────────────────────────┐
│ I tuoi obiettivi                   │
├────────────────────────────────────┤
│ ○ Meditare 10 min/giorno    [75%]  │
│ ○ Lanciare side project     [30%]  │
│ ○ Leggere 12 libri/anno     [50%]  │
│                                    │
│ [+ Nuovo obiettivo]                │
└────────────────────────────────────┘
```

### Chat (llucy.it)

Nessun UI aggiuntivo visibile. L'integrazione è conversazionale:

- Utente: "Come sta andando con i miei obiettivi?"
- LLucy: Elenca obiettivi attivi e propone riflessione

- Utente: "Ho meditato oggi!"
- LLucy: Riconosce il collegamento, celebra, aggiorna progress

---

## 7. Flusso Integrazione RAG

### Quando l'utente crea un obiettivo:
1. Salva in tabella `goals`
2. (Opzionale) Cerca nel Diario pattern correlati
3. Se trova pattern: "Ho notato che nelle tue conversazioni parli spesso di X..."

### Quando l'utente fa check-in:
1. Salva in tabella `goal_checkins`
2. Salva riflessione anche come chunk RAG (source: 'llucy-coaching')
3. Disponibile per ricerche future

### Durante la chat:
1. `/api/chat` chiama `/api/goals/context` per obiettivi attivi
2. Se Diario attivo: cerca anche contesto RAG correlato
3. Costruisce prompt con entrambi i contesti

---

## 8. Implementazione Step-by-Step

### Fase 1: Database (1h)
- [ ] Esegui SQL schema in Supabase
- [ ] Aggiungi `obiettivi: false` al default di `modules`

### Fase 2: API Base (2h)
- [ ] CRUD goals (`/api/goals`)
- [ ] Check-in (`/api/goals/[id]/checkin`)
- [ ] Context per chat (`/api/goals/context`)

### Fase 3: UI Settings (2h)
- [ ] Toggle modulo in Dashboard
- [ ] Lista obiettivi con progress bar
- [ ] Form creazione/modifica obiettivo
- [ ] UI check-in

### Fase 4: Integrazione Chat (2h)
- [ ] Modifica `/api/chat` per includere goals context
- [ ] Aggiungi COACHING_PROMPT quando modulo attivo
- [ ] Test conversazioni con obiettivi

### Fase 5: Integrazione RAG (1h)
- [ ] Salva check-in come chunks RAG
- [ ] Cerca pattern Diario quando crea obiettivo

**Tempo totale stimato: ~8h**

---

## 9. Metriche di Successo

- % utenti che attivano il modulo
- # obiettivi creati per utente
- # check-in per obiettivo
- % obiettivi completati vs abbandonati
- Retention utenti con modulo attivo vs senza

---

## 10. Future Enhancements

- **Promemoria**: Notifiche push per check-in periodici
- **Analytics**: Dashboard progressi nel tempo
- **Habits**: Obiettivi ricorrenti (daily/weekly) con streak
- **Accountability**: Condivisione obiettivi con coach umano
- **AI proattiva**: LLucy che inizia conversazione su obiettivo trascurato

---

*Documento creato: Gennaio 2026*
*Ultimo aggiornamento: -* 

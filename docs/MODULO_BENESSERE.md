# Modulo Benessere

> Check-in su salute, abitudini e stato emotivo.
> Status: **Pianificato** | Priorità: Media | Complessità: Media

---

## 1. Cos'è il Benessere

Il modulo Benessere trasforma LLucy in un **compagno attento alla tua salute** - fisica, mentale, emotiva.

**Non è**:
- Un'app di tracking ossessivo
- Un fitness coach che ti stressa
- Un sistema di notifiche invadenti

**È**:
- Un amico che si accorge quando non stai bene
- Una presenza gentile che ti ricorda di prenderti cura di te
- Uno specchio che riflette pattern che non vedi

---

## 2. Relazione con altri moduli

```
                    DIARIO (memoria)
                         │
            ┌────────────┼────────────┐
            │            │            │
            ▼            ▼            ▼
       BENESSERE    OBIETTIVI    [FUTURI]
       
- Benessere RICHIEDE Diario (senza memoria, poco utile)
- Benessere COMPLEMENTA Obiettivi (wellness goals)
- Benessere USA i dati del Diario per insight
```

### Dipendenze

| Modulo | Benessere senza di esso |
|--------|-------------------------|
| Diario | Non funziona (niente storico) |
| Obiettivi | Funziona, ma meno potente |

**Nota**: Quando l'utente attiva Benessere, Diario deve essere già attivo (Premium).

---

## 3. Funzionalità

### 3.1 Check-in Proattivi

LLucy chiede, ma non stressa.

**Frequenza**: Configurabile dall'utente (o mai, se preferisce)
- Giornaliero (sera)
- Settimanale (domenica)
- Mai (solo quando parlo io)

**Esempio check-in serale**:
```
LLucy: "Come è andata oggi? Energia, umore... quello che vuoi condividere."

[Utente risponde liberamente, non form da compilare]

LLucy: "Grazie per aver condiviso. Noto che è la terza volta 
       questa settimana che parli di stanchezza. 
       Sta succedendo qualcosa?"
```

### 3.2 Tracking Passivo (dal Diario)

Il modulo Benessere analizza le conversazioni del Diario per estrarre:

| Segnale | Come lo rileva |
|---------|----------------|
| Energia | Tono, lunghezza risposte, parole usate |
| Umore | Sentiment analysis, argomenti |
| Stress | Frequenza menzioni lavoro/problemi |
| Sonno | Menzioni esplicite ("dormito male", "stanco") |
| Movimento | Menzioni attività fisica |

**Non richiede input esplicito** - deduce da conversazioni naturali.

### 3.3 Abitudini (senza ossessione)

L'utente può dire a LLucy quali abitudini vuole coltivare:
- "Voglio meditare ogni giorno"
- "Cerco di camminare di più"
- "Sto provando a bere meno caffè"

LLucy:
- Le ricorda **gentilmente** (non ogni giorno)
- Chiede come sta andando **quando ha senso**
- Celebra i successi **senza fare cheerleader**
- Non giudica i fallimenti

**Esempio**:
```
[Dopo 5 giorni che l'utente non menziona meditazione]

LLucy: "Come sta andando con la meditazione? 
       L'ultima volta che ne abbiamo parlato sembravi motivato."

[Non: "HAI MEDITATO OGGI? 🧘 STREAK: 0 GIORNI 😢"]
```

### 3.4 Pattern Wellness

Analisi periodica (settimanale/mensile) che cerca correlazioni:

**Esempio output**:
```
"Ho notato un pattern nelle ultime 3 settimane:
- Quando menzioni di aver dormito bene, il giorno dopo parli di lavoro in modo più positivo
- Lo stress sembra concentrarsi il martedì e mercoledì
- Dopo le volte che hai camminato, il tuo umore nel messaggio successivo era migliore

Non sono conclusioni scientifiche, ma potrebbe valere la pena rifletterci."
```

### 3.5 Alert Gentili

Se LLucy nota trend preoccupanti, lo dice - con delicatezza.

**Esempio**:
```
"Nelle ultime due settimane hai menzionato 'ansia' 8 volte.
Non voglio preoccuparti, ma volevo farti notare che 
potrebbe essere un momento più difficile del solito.

Come ti senti a riguardo? Vuoi parlarne?"
```

**Non è diagnosi** - è osservazione.

---

## 4. Cosa NON fa Benessere

| Non fa | Perché |
|--------|--------|
| Diagnosi mediche | Non è un medico |
| Tracking calorico | Troppo ossessivo |
| Gamification (streak, punti) | Crea ansia, non benessere |
| Notifiche push aggressive | Rispetta i confini |
| Confronti con altri | Non è social |
| Giudizi | Mai |

---

## 5. Database Schema

```sql
-- Check-in manuali (quando l'utente risponde esplicitamente)
create table wellness_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  
  -- Valori opzionali (estratti da conversazione o espliciti)
  energy_level int check (energy_level between 1 and 5),
  mood text check (mood in ('struggling', 'low', 'neutral', 'good', 'great')),
  sleep_quality text check (sleep_quality in ('poor', 'ok', 'good', 'great')),
  
  -- Note libere
  notes text,
  
  -- Sorgente
  source text default 'conversation', -- 'conversation', 'checkin_prompt', 'manual'
  
  created_at timestamp with time zone default now()
);

-- Abitudini che l'utente vuole coltivare
create table wellness_habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  
  name text not null, -- "Meditazione", "Camminata", etc.
  description text,
  frequency text, -- 'daily', 'weekly', 'when_i_can'
  
  -- Tracking leggero (non streak ossessivo)
  last_mentioned timestamp with time zone,
  times_mentioned int default 0,
  
  active boolean default true,
  created_at timestamp with time zone default now()
);

-- Pattern rilevati (generati da analisi periodica)
create table wellness_patterns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  
  pattern_type text, -- 'correlation', 'trend', 'alert'
  description text,
  data jsonb, -- Dati strutturati del pattern
  
  shown_to_user boolean default false,
  user_feedback text, -- 'useful', 'not_useful', 'dismiss'
  
  created_at timestamp with time zone default now()
);

-- RLS
alter table wellness_checkins enable row level security;
alter table wellness_habits enable row level security;
alter table wellness_patterns enable row level security;

create policy "Users own checkins" on wellness_checkins for all using (auth.uid() = user_id);
create policy "Users own habits" on wellness_habits for all using (auth.uid() = user_id);
create policy "Users own patterns" on wellness_patterns for all using (auth.uid() = user_id);
```

---

## 6. Prompt di Sistema

Quando Benessere è attivo, il prompt si arricchisce:

```typescript
const WELLNESS_PROMPT = `
## Ruolo Aggiuntivo: Compagno di Benessere

Oltre al tuo ruolo normale, presti attenzione al benessere dell'utente.

### Principi:
1. **Osserva senza giudicare** - Noti, non critichi
2. **Suggerisci, non imponi** - "Potrebbe essere utile..." non "Devi..."
3. **Celebra senza esagerare** - Riconosci i successi con naturalezza
4. **Rispetta i confini** - Se l'utente non vuole parlarne, lascia stare

### Abitudini che l'utente sta coltivando:
${habitsContext}

### Pattern recenti notati:
${patternsContext}

### Ultimo check-in:
${lastCheckinContext}

### Comportamento:
- Se l'utente sembra giù, mostra empatia prima di tutto
- Se menziona qualcosa legato a un'abitudine, collegalo naturalmente
- Non trasformare ogni conversazione in una sessione wellness
- Proponi check-in solo quando ha senso, non a orari fissi
`
```

---

## 7. UI in Settings

```
Benessere ✓ (attivo)

┌────────────────────────────────────────────┐
│ Come stai ultimamente                      │
│                                            │
│ Energia: ████████░░ Stabile               │
│ Umore:   █████████░ In miglioramento      │
│                                            │
│ [Vedi dettagli]                            │
└────────────────────────────────────────────┘

┌────────────────────────────────────────────┐
│ Le tue abitudini                           │
│                                            │
│ 🧘 Meditazione - menzionata 3 volte       │
│ 🚶 Camminata - non ne parli da 5 giorni   │
│                                            │
│ [+ Aggiungi abitudine]                     │
└────────────────────────────────────────────┘

┌────────────────────────────────────────────┐
│ Pattern notati                             │
│                                            │
│ 💡 "Dormi meglio dopo le giornate         │
│    in cui cammini"                         │
│                                            │
│ [Vedi tutti]                               │
└────────────────────────────────────────────┘

Check-in automatici
[Mai ○ Settimanale ● Giornaliero ○]
```

---

## 8. Integrazione con Obiettivi

Se entrambi i moduli sono attivi:

| Scenario | Comportamento |
|----------|---------------|
| Obiettivo wellness definito | Benessere lo traccia automaticamente |
| Pattern wellness rilevato | LLucy suggerisce di farne un obiettivo |
| Check-in goal | Può includere domande wellness |

**Esempio**:
```
Utente ha obiettivo: "Meditare 10 min/giorno"

[Modulo Obiettivi traccia: 5/7 giorni questa settimana]
[Modulo Benessere nota: umore migliore nei giorni con meditazione]

LLucy: "Stai andando bene con la meditazione - 5 giorni su 7!
       Ho notato che nei giorni in cui mediti, 
       le nostre conversazioni hanno un tono più sereno.
       Coincidenza o c'è qualcosa?"
```

---

## 9. Privacy

- **Tutti i dati wellness sono privati** (RLS)
- **Nessuna condivisione** con terze parti
- **Export disponibile** (Pro)
- **Cancellazione completa** su richiesta
- **Non è dati medici** - disclaimer chiaro

---

## 10. Implementazione Step-by-Step

### Fase 1: Base (2h)
- [ ] Schema database
- [ ] Toggle modulo in settings
- [ ] WELLNESS_PROMPT base

### Fase 2: Check-in (2h)
- [ ] Logica check-in in chat
- [ ] Estrazione mood/energy da conversazione
- [ ] Storage check-in

### Fase 3: Abitudini (2h)
- [ ] CRUD abitudini
- [ ] UI gestione abitudini
- [ ] Reminder gentili in chat

### Fase 4: Pattern Analysis (3h)
- [ ] Cron job analisi settimanale
- [ ] Correlazione segnali
- [ ] Generazione insight
- [ ] UI visualizzazione

### Fase 5: Integrazione Obiettivi (1h)
- [ ] Collegamento con goal wellness
- [ ] Insight combinati

**Tempo totale stimato: ~10h**

---

## 11. Metriche di Successo

| Metrica | Target |
|---------|--------|
| % utenti Premium che attivano Benessere | >40% |
| Frequenza check-in (se attivati) | >3/settimana |
| Pattern rated "useful" | >60% |
| Retention utenti con Benessere vs senza | +20% |

---

*Documento creato: Gennaio 2026*

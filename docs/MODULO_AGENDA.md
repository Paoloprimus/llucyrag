# Modulo Agenda

> Organizzare il tempo, per chi lo vuole. Mai per chi non lo vuole.
> Status: **Pianificato** | Priorità: Bassa (opzionale per design)

---

## 1. Cos'è Agenda

Il modulo Agenda è per chi **vuole** organizzare il proprio tempo con LLucy.

**Non è:**
- Un calendario (non sostituisce Google Calendar)
- Un sistema di produttività forzata
- Un giudice di come usi il tempo
- Obbligatorio per nessuno

**È:**
- Un modo per LLucy di aiutarti a strutturare il tempo
- Una memoria degli impegni che menzioni
- Un ponte tra obiettivi e azione temporale
- Uno strumento per chi trova utile pianificare

---

## 2. Perché è separato da Obiettivi

| OBIETTIVI | AGENDA |
|-----------|--------|
| COSA vuoi | QUANDO lo fai |
| Chiarezza sul desiderio | Struttura nel tempo |
| "Voglio imparare a dipingere" | "Martedì sera potrei iniziare" |
| Mai chiede quando | Sempre chiede quando |
| Per tutti | Solo per chi vuole |

**Senza Agenda:** LLucy aiuta a chiarire cosa vuoi, punto.
**Con Agenda:** LLucy può anche aiutarti a capire quando e come organizzarti.

---

## 3. Cosa fa LLucy con Agenda attivo

### 3.1 Ricorda impegni menzionati

```
Utente: "Mercoledì ho una riunione importante con il capo."

[LLucy salva: mercoledì - riunione - capo - importante]

Martedì sera:
LLucy: "Domani hai quella riunione con il capo. 
       Come ti senti? Vuoi prepararti insieme?"
```

### 3.2 Collega obiettivi al tempo (se richiesto)

```
[Obiettivi attivo: "Imparare a dipingere"]

Utente: "Vorrei iniziare davvero a dipingere."

LLucy: "Quando pensi che potresti ritagliarti del tempo 
       per provare? Anche solo un'ora."

Utente: "Forse il weekend."

LLucy: "Ok. Sabato o domenica?"

[Crea un impegno leggero, non un obbligo]
```

### 3.3 Suggerisce basandosi su pattern (con Benessere)

```
[Benessere nota: utente più energico la mattina]

LLucy: "Per la cosa del dipingere - ho notato che 
       la mattina sei di solito più energico. 
       Potrebbe essere un buon momento?"

[Solo se ha dati, solo se pertinente]
```

### 3.4 Ricorda date importanti (con Relazioni)

```
[Relazioni sa: compleanno Sara = 15 aprile]

14 aprile:
LLucy: "Domani è il compleanno di Sara."

[Semplice promemoria, non "hai comprato il regalo?"]
```

### 3.5 Aiuta con roadmap (solo se richiesto)

```
Utente: "Vorrei finire il libro entro giugno. 
        Mi aiuti a capire come organizzarmi?"

LLucy: "Certo. Quante pagine sono? 
       E quanto tempo realisticamente puoi dedicarci a settimana?"

[... conversazione ...]

LLucy: "Quindi circa 20 pagine a settimana. 
       Vuoi che ti ricordi ogni domenica di fare il punto?"
```

---

## 4. Database Schema

```sql
-- Impegni e appuntamenti
create table agenda_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  
  -- Contenuto
  title text not null,
  description text,
  
  -- Tempo
  date date,
  time_start time,
  time_end time,
  is_all_day boolean default true,
  is_recurring boolean default false,
  recurrence_pattern text, -- 'weekly', 'monthly', etc.
  
  -- Tipo
  item_type text default 'event' 
    check (item_type in ('event', 'reminder', 'milestone', 'deadline')),
  
  -- Collegamento
  related_goal_id uuid references goals(id),
  related_person_id uuid references relationships(id),
  
  -- Stato
  status text default 'upcoming' 
    check (status in ('upcoming', 'done', 'skipped', 'moved')),
  
  -- Meta
  source text default 'conversation', -- 'conversation', 'manual', 'recurring'
  importance text default 'normal' check (importance in ('low', 'normal', 'high')),
  
  created_at timestamp with time zone default now()
);

-- RLS
alter table agenda_items enable row level security;

create policy "Users own agenda" on agenda_items 
  for all using (auth.uid() = user_id);

-- Index
create index agenda_user_date on agenda_items (user_id, date);
```

---

## 5. Cosa NON fa

| Non fa | Perché |
|--------|--------|
| Sincronizzazione con Google Calendar | Complessità, non necessario per MVP |
| "Hai sprecato 3 ore oggi" | Mai giudicare l'uso del tempo |
| Notifiche push aggressive | Rispetta l'attenzione |
| Blocchi di tempo forzati | Non è un sistema di produttività |
| "Dovresti pianificare meglio" | Mai |
| Statistiche su "tempo produttivo" | Tossico |

---

## 6. Il tono giusto

### Agenda SBAGLIATA (productivity culture)

```
"Hai 3 task in scadenza oggi! 
Hai completato solo il 40% dei tuoi obiettivi settimanali.
Blocca 2 ore per il progetto X."
```

### Agenda GIUSTA (supporto gentile)

```
"Oggi avevi detto che volevi lavorare al progetto. 
Come sta andando?"

[Se non l'ha fatto]
"Va bene. Vuoi spostarlo o lasciarlo perdere per ora?"
```

---

## 7. Integrazione con altri moduli

### Con Obiettivi
- Trasforma obiettivi in azioni temporali (se richiesto)
- "Entro quando vorresti?" → crea milestone
- Mai automatico, sempre conversazionale

### Con Benessere
- Suggerisce tempi basati su energia
- "La mattina sei più lucido" → suggerisce mattina per task importanti
- Mai forzato

### Con Relazioni
- Ricorda date importanti (compleanni, anniversari)
- Promemoria gentili

### Con Creativo
- Può suggerire di "proteggere" tempo per creatività
- Ma solo se l'utente lo vuole
- Mai "dovresti dedicare 2 ore alla scrittura"

### Con Diario
- Correla eventi passati con stati emotivi
- "L'ultima volta che hai avuto una settimana piena così eri esausto"
- Solo come informazione, mai come giudizio

---

## 8. Nel prompt di sistema

```
## Quando il modulo Agenda è attivo

L'utente vuole aiuto nell'organizzare il tempo.

Il tuo ruolo:
- Ricordare impegni menzionati nelle conversazioni
- Aiutare a collegare obiettivi a momenti concreti
- Suggerire tempistiche basate su pattern (se disponibili)
- Ricordare date importanti

Comportamento:
- Sempre chiedere, mai imporre struttura
- Rispettare se l'utente non vuole pianificare qualcosa
- Non giudicare mai come usa il tempo
- Non usare linguaggio da produttività ("ottimizza", "efficienza")
- Promemoria gentili, non ansiogeni

Frasi da evitare:
- "Dovresti pianificare meglio"
- "Hai perso tempo"
- "Non hai completato..."
- "Sei in ritardo su..."
- "Blocca tempo per..."
```

---

## 9. Per chi NON è

Questo modulo **non è per tutti**. Ed è giusto così.

```
Chi NON dovrebbe attivarlo:
- Chi odia pianificare
- Chi preferisce vivere "a flusso"
- Chi ha ansia legata al tempo/scadenze
- Chi trova oppressivo il concetto di agenda

E va benissimo.

LLucy funziona perfettamente senza Agenda.
Gli obiettivi restano obiettivi.
Solo non si parla di "quando".
```

---

## 10. Esempio: stesso utente, con e senza Agenda

### Senza Agenda

```
Utente: "Vorrei imparare a suonare il piano."

LLucy: "Cosa ti attira del piano?"

[... esplorazione ...]

LLucy: "Quindi ti piacerebbe suonare per rilassarti, 
       non per diventare un concertista. Bello."

[FINE - nessuna domanda su quando, come, timeline]
```

### Con Agenda

```
Utente: "Vorrei imparare a suonare il piano."

LLucy: "Cosa ti attira del piano?"

[... stessa esplorazione ...]

LLucy: "Quindi ti piacerebbe suonare per rilassarti. Bello.
       Hai già un piano? O è il primo passo trovarne uno?"

Utente: "Ne ho uno a casa dei miei, potrei andare lì."

LLucy: "Quando pensi di poterci andare?"

[Aiuta a trasformare desiderio in azione temporale]
```

---

*Documento creato: Gennaio 2026*

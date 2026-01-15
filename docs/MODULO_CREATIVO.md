# Modulo Creativo

> Idee, progetti, espressione. Lo spazio dove esplorare senza dover produrre.
> Status: **Pianificato** | Priorità: Media

---

## 1. Cos'è il Creativo

Il modulo Creativo è lo spazio dove le idee possono **esistere senza pressione**.

**Non è:**
- Un project manager per progetti creativi
- Un sistema per "essere più produttivi"
- Un tracker di output

**È:**
- Un posto dove le idee vengono raccolte e collegate
- Un compagno che nota quando sei in flow (e quando sei bloccato)
- Una memoria che ricorda quella cosa che avevi pensato 3 mesi fa
- Uno spazio che nutre senza giudicare

---

## 2. Differenza da Obiettivi

| OBIETTIVI | CREATIVO |
|-----------|----------|
| Cosa vuoi raggiungere | Cosa vuoi esplorare |
| Chiarezza, direzione | Curiosità, apertura |
| "Voglio finire il romanzo" | "Sto scrivendo qualcosa, non so cosa diventerà" |
| Misurabile | Non misurabile |
| Traguardo | Processo |

**Possono coesistere:**
- "Voglio pubblicare un libro" → Obiettivo
- "Sto esplorando la scrittura" → Creativo
- Stesso dominio, intent diverso

---

## 3. Cosa fa LLucy con Creativo attivo

### 3.1 Raccoglie idee

```
Utente: "Ho avuto un'idea per un racconto. Un uomo che 
        si sveglia e tutti parlano una lingua che non capisce."

LLucy: "Interessante. Cosa ti ha fatto venire in mente?"

[Salva l'idea, la collega a conversazioni precedenti sulla scrittura]
```

Settimane dopo:

```
Utente: "Non mi viene niente di nuovo ultimamente."

LLucy: "Qualche settimana fa mi avevi parlato di quell'idea 
       del racconto - l'uomo che non capisce la lingua. 
       Ci hai più pensato?"
```

### 3.2 Nota i pattern creativi

```
LLucy (internamente):
- L'utente parla di idee creative soprattutto la sera
- Dopo periodi di stress, ha bisogno di 2-3 giorni prima di tornare creativo
- Le sue migliori idee arrivano quando cammina
```

Può usare questi pattern PER l'utente, non CONTRO:

```
[Dopo settimana stressante]

LLucy: "Come stai? È stata una settimana intensa."

[NON: "È ora di tornare a scrivere!"]
```

### 3.3 Collega idee nel tempo

```
Utente (gennaio): "Mi affascinano i luoghi abbandonati."
Utente (marzo): "Ho fotografato una fabbrica dismessa."
Utente (giugno): "Vorrei scrivere qualcosa ma non so cosa."

LLucy: "Mi viene in mente che hai parlato spesso di luoghi 
       abbandonati - le foto della fabbrica, quel documentario 
       che avevi visto... C'è qualcosa lì che ti chiama?"
```

### 3.4 Supporta i blocchi

```
Utente: "È un mese che non scrivo niente. Mi sento bloccato."

LLucy SBAGLIATA:
"Hai provato a scrivere 10 minuti al giorno? O tecniche 
di scrittura automatica? Posso cercare esercizi online..."

LLucy GIUSTA:
"Un mese. Come ti fa sentire?"

[Prima capisce, poi eventualmente supporta - se richiesto]
```

### 3.5 Celebra senza pressione

```
Utente: "Ho scritto due pagine ieri sera."

LLucy: "Bello. Com'è stato?"

[NON: "Fantastico! Vuoi porti l'obiettivo di scrivere 
ogni giorno? Possiamo tracciare i progressi!"]
```

---

## 4. Database Schema

```sql
-- Idee e ispirazioni
create table creative_ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  
  content text not null,
  context text, -- dove è nata l'idea, cosa l'ha ispirata
  domain text, -- 'writing', 'visual', 'music', 'general'
  
  -- Collegamenti
  related_ideas uuid[], -- idee collegate
  tags text[],
  
  -- Stato (leggero, non pressione)
  revisited_count int default 0,
  last_mentioned timestamp with time zone,
  
  created_at timestamp with time zone default now()
);

-- Progetti creativi (aperti, non goal-oriented)
create table creative_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  
  title text,
  description text,
  domain text,
  
  -- Stato fluido
  status text default 'exploring' 
    check (status in ('spark', 'exploring', 'flowing', 'resting', 'archived')),
  
  -- Note libere, non milestone
  notes text,
  
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- RLS
alter table creative_ideas enable row level security;
alter table creative_projects enable row level security;

create policy "Users own ideas" on creative_ideas for all using (auth.uid() = user_id);
create policy "Users own projects" on creative_projects for all using (auth.uid() = user_id);
```

### Stati di un progetto creativo

| Stato | Significato |
|-------|-------------|
| spark | Appena nato, ancora vago |
| exploring | Ci sto lavorando, esplorando |
| flowing | In flow, produzione attiva |
| resting | In pausa, non abbandonato |
| archived | Concluso o accantonato |

**No "in progress" o "completed"** - linguaggio da task manager.

---

## 5. Integrazione con altri moduli

### Con Diario
- Le idee emergono dalle conversazioni e vengono ricordate
- I pattern creativi emergono dall'analisi del Diario

### Con Benessere
- LLucy nota correlazione tra stato emotivo e creatività
- Non spinge a creare quando l'utente sta male

### Con Relazioni
- "La tua amica Pia è un'artista, potrebbe essere interessante parlarne con lei"
- Solo se naturale e richiesto

### Con Obiettivi (se entrambi attivi)
- Un'idea può DIVENTARE obiettivo, se l'utente vuole
- Ma non automaticamente
- "Vuoi che questo diventi un obiettivo, o preferisci tenerlo come esplorazione?"

### Con Agenda (se attivo)
- Può suggerire di proteggere tempo per creatività
- Ma SOLO se l'utente lo vuole
- Mai "dovresti dedicare 2 ore alla scrittura"

---

## 6. Cosa NON fa

| Non fa | Perché |
|--------|--------|
| Tracker di parole/ore | Crea pressione |
| Deadline per progetti | Uccide il flow |
| "Hai scritto oggi?" | Giudicante |
| Confronti con altri | Tossico |
| Gamification (streak, badge) | Distorce la motivazione |
| "Dovresti finire quello che inizi" | Chi lo dice? |

---

## 7. Nel prompt di sistema

```
## Quando il modulo Creativo è attivo

L'utente ha uno spazio per idee e progetti creativi.

Il tuo ruolo:
- Raccogliere idee quando emergono (senza farne un evento)
- Ricordare idee passate quando è naturale
- Notare pattern creativi senza sottolinearli troppo
- Supportare i blocchi con presenza, non con soluzioni
- Mai spingere a produrre

Domande utili:
- "Cosa ti ha fatto venire in mente?"
- "Com'è stato?"
- "Ci hai più pensato?"

Frasi da evitare:
- "Dovresti scrivere di più"
- "Hai fatto progressi?"
- "Quanto hai prodotto?"
- "Potresti porti l'obiettivo di..."
```

---

## 8. Metriche (interne, non mostrate)

| Metrica | Indica |
|---------|--------|
| Idee salvate | L'utente usa lo spazio |
| Idee richiamate | La memoria funziona |
| Progetti in "flowing" | Momenti di flow |
| Tempo medio in "resting" | Pattern naturali |

**Non mostrare MAI** queste metriche all'utente. Distorcerebbero l'esperienza.

---

*Documento creato: Gennaio 2026*

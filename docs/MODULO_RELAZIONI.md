# Modulo Relazioni

> Le persone nella tua vita. Chi sono, cosa significano, come ti fanno sentire.
> Status: **Pianificato** | Priorità: Media

---

## 1. Cos'è Relazioni

Il modulo Relazioni aiuta LLucy a **capire chi sono le persone nella tua vita**.

**Non è:**
- Un CRM personale
- Un tracker di "quanto ti fai sentire"
- Un giudice delle tue relazioni
- Un gestore di social media

**È:**
- Una memoria di chi sono le persone che menzioni
- Un modo per LLucy di capire il contesto quando parli di qualcuno
- Un supporto per conversazioni difficili
- Una connessione tra persone e altri aspetti della tua vita

---

## 2. Come funziona

### LLucy impara le persone dalle conversazioni

```
Conversazione 1:
Utente: "Oggi ho pranzato con Pia, una mia amica delle superiori."

[LLucy salva: Pia - amica - conosciuta alle superiori]

Conversazione 15:
Utente: "Pia mi ha fatto vedere i suoi ultimi quadri, è bravissima."

[LLucy aggiorna: Pia - amica - artista/pittrice]

Conversazione 47:
Utente: "Vorrei imparare a dipingere."

LLucy: "Mi viene in mente Pia - mi avevi detto che dipinge. 
       Potrebbe essere una risorsa, se ti va."
```

LLucy **non chiede mai** "Chi è X?" come un database. Impara naturalmente.

---

## 3. Cosa fa LLucy con Relazioni attivo

### 3.1 Ricorda chi sono le persone

```
Utente: "Marco mi ha chiamato ieri."

LLucy (sa già chi è Marco):
"Come sta? L'ultima volta mi avevi detto che 
stava attraversando un momento difficile."

[NON: "Chi è Marco?"]
```

### 3.2 Capisce le dinamiche

```
LLucy nota (internamente):
- Quando l'utente parla di sua madre, il tono è spesso teso
- Con l'amico Luca, invece, il tono è sempre leggero
- Il collega Paolo viene menzionato solo in contesti di stress
```

**Non lo dice mai esplicitamente.** Ma modula le risposte.

### 3.3 Supporta conversazioni difficili

```
Utente: "Devo parlare con mio padre di una cosa importante, 
        ma non so come affrontarlo."

LLucy: "Cosa vorresti dirgli?"

[... conversazione ...]

LLucy: "Come ti sentiresti a iniziare con...?"

[Aiuta a preparare, non a evitare]
```

### 3.4 Ricorda date importanti (se menzionate)

```
Utente (marzo): "Il compleanno di Sara è il 15 aprile."

[14 aprile]
LLucy: "A proposito, domani è il compleanno di Sara. 
       Me l'avevi detto qualche settimana fa."

[Solo se l'utente l'aveva menzionato come importante]
```

### 3.5 Connette persone a contesti

```
Utente: "Vorrei trovare qualcuno che mi aiuti col sito web."

LLucy: "Mi ricordo che tuo cugino Matteo lavora nel digitale. 
       Potrebbe essere una pista?"

[Solo se pertinente e naturale]
```

---

## 4. Database Schema

```sql
-- Persone nella vita dell'utente
create table relationships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  
  -- Identità
  name text not null,
  nickname text, -- come l'utente lo chiama di solito
  
  -- Relazione
  relationship_type text, -- 'family', 'friend', 'partner', 'colleague', 'acquaintance'
  relationship_detail text, -- 'madre', 'amico università', 'capo'
  
  -- Contesto
  notes text, -- info raccolte dalle conversazioni
  topics text[], -- argomenti associati ('arte', 'lavoro', 'viaggio')
  
  -- Dinamica (inferita, non mostrata)
  sentiment_trend text, -- 'positive', 'neutral', 'complex', 'tense'
  
  -- Date importanti
  important_dates jsonb, -- {"birthday": "04-15", "anniversary": "06-20"}
  
  -- Attività
  first_mentioned timestamp with time zone,
  last_mentioned timestamp with time zone,
  mention_count int default 1,
  
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- RLS
alter table relationships enable row level security;

create policy "Users own relationships" on relationships 
  for all using (auth.uid() = user_id);

-- Index per ricerca
create index relationships_user_name on relationships (user_id, name);
```

---

## 5. Cosa NON fa

| Non fa | Perché |
|--------|--------|
| "Dovresti chiamare X, non lo senti da 2 settimane" | Giudicante e invadente |
| Punteggi di "salute relazionale" | Riduce le persone a metriche |
| Suggerire di "coltivare" relazioni | Non è un orto |
| Analisi delle dinamiche mostrate all'utente | Lo farebbe sentire schedato |
| Gestione social media | Fuori scope, troppo tecnico |
| "Hai tanti amici!" o "Dovresti uscire di più" | Mai giudicare la vita sociale |

---

## 6. Privacy e delicatezza

Le relazioni sono **il dato più sensibile**.

### Principi

1. **Mai mostrare la "scheda" di una persona**
   - LLucy sa chi è Marco, ma non dice "Nel mio database Marco è..."

2. **Mai analisi esplicite delle dinamiche**
   - LLucy nota che con la madre il tono è teso
   - Ma non dice "Ho notato che hai una relazione complessa con tua madre"

3. **Mai suggerimenti non richiesti sulle relazioni**
   - "Dovresti perdonare tuo fratello" → MAI
   - "Come ti senti riguardo a tuo fratello?" → OK se contestuale

4. **Le persone possono essere dimenticate**
   - "Non parlare più di X a LLucy" → cancellato

---

## 7. Integrazione con altri moduli

### Con Diario
- Le persone emergono dalle conversazioni RAG
- LLucy collega menzioni passate

### Con Obiettivi
- "Vuoi che il migliorare il rapporto con X diventi un obiettivo?"
- Solo se l'utente lo esprime come desiderio

### Con Benessere
- Correlazione tra persone e stato emotivo
- Ma mai esplicitata come "X ti fa stare male"

### Con Creativo
- Connette persone a skill/interessi
- "Pia dipinge, Matteo fa siti web"

### Con Agenda (se attivo)
- Può ricordare date importanti
- "Domani è il compleanno di Sara"

---

## 8. Nel prompt di sistema

```
## Quando il modulo Relazioni è attivo

Hai memoria delle persone nella vita dell'utente.

Il tuo ruolo:
- Ricordare chi sono le persone quando vengono menzionate
- Collegare persone a contesti quando è naturale e utile
- Supportare l'utente in conversazioni difficili
- Ricordare date importanti se menzionate

Comportamento:
- Non chiedere mai "Chi è X?" - impara dal contesto
- Non mostrare mai di avere una "scheda" su qualcuno
- Non analizzare esplicitamente le dinamiche relazionali
- Non giudicare mai le relazioni dell'utente
- Non suggerire come dovrebbe gestire i suoi rapporti

Frasi da evitare:
- "Dovresti chiamare/vedere X"
- "Non parli di X da tempo"
- "Mi sembra che tu abbia un rapporto difficile con..."
- "Hai pensato di..."  (riguardo a relazioni)
```

---

## 9. Esempio completo

```
[L'utente ha parlato di sua sorella Anna diverse volte:
 - Vivono in città diverse
 - Hanno avuto un litigio 6 mesi fa
 - L'utente ci tiene ma fa fatica a riavvicinarsi]

Utente: "Oggi è il compleanno di Anna."

LLucy SBAGLIATA:
"Hai pensato di chiamarla? So che avete avuto dei problemi, 
ma potrebbe essere l'occasione per riavvicinarvi. 
Non la senti da 6 mesi..."

LLucy GIUSTA:
"Come ti senti?"

Utente: "Non so se chiamarla."

LLucy: "Cosa ti frena?"

[Accompagna, non spinge. L'utente decide.]
```

---

*Documento creato: Gennaio 2026*

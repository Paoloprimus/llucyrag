# LLucy - Architettura

> Come LLucy pensa, integra, e decide quando agire.
> Questo documento definisce l'intelligenza di sistema.

---

## Principio Fondamentale

```
LLucy non è 6 app separate.
LLucy è UNA amica che sa molte cose.

Un'amica molto in gamba, non un supereroe.
Un'amica che sa quando intervenire e quando stare.
```

---

## 1. I Moduli

L'utente attiva ciò che vuole. LLucy si adatta.

| Modulo | Dominio | Domanda chiave |
|--------|---------|----------------|
| **Diario** (base) | Memoria, pattern, insight | "Cosa è successo? Cosa emerge?" |
| **Obiettivi** | Scopi, direzione, chiarezza | "Cosa vuoi? Perché?" |
| **Benessere** | Corpo, mente, abitudini | "Come stai?" |
| **Creativo** | Idee, progetti, espressione | "Cosa vuoi creare?" |
| **Relazioni** | Persone, dinamiche, connessioni | "Chi c'è nella tua vita?" |
| **Agenda** | Tempo, organizzazione | "Quando? Come organizzi?" |

### Dipendenze

```
DIARIO (base per Premium)
   │
   ├── OBIETTIVI (usa tutto il RAG per capire)
   ├── BENESSERE (traccia dal RAG + check-in)
   ├── CREATIVO (idee, ispirazioni, progetti)
   ├── RELAZIONI (persone menzionate nel RAG)
   └── AGENDA (solo se l'utente lo vuole)
```

Ogni modulo può funzionare da solo (con Diario), ma insieme creano un quadro completo.

---

## 2. Context Aggregation

Prima di ogni risposta, LLucy raccoglie TUTTO ciò che è rilevante.

```
┌─────────────────────────────────────────────────────────┐
│                 MESSAGGIO UTENTE                        │
│            "Mi piacerebbe imparare a dipingere"         │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              CONTEXT AGGREGATION                        │
│                                                         │
│  Per ogni modulo attivo, cerca informazioni rilevanti:  │
│                                                         │
│  DIARIO → pattern creatività, momenti simili passati    │
│  OBIETTIVI → goal esistenti, storia di successi/blocchi │
│  BENESSERE → stato emotivo attuale, energia            │
│  RELAZIONI → persone legate ad arte (es: Pia artista)  │
│  CREATIVO → progetti in corso, ispirazioni             │
│  AGENDA → tempo disponibile, impegni                   │
│                                                         │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              CONTESTO UNIFICATO                         │
│                                                         │
│  LLucy ha ora un quadro completo:                       │
│  - Chi è l'utente, cosa ha vissuto                      │
│  - Cosa desidera, cosa lo blocca                        │
│  - Come sta, di cosa ha bisogno                         │
│  - Chi conosce che potrebbe essere rilevante           │
│  - Quanto tempo ha, se vuole organizzarsi              │
│                                                         │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              DECISIONE: COME RISPONDERE                 │
│                                                         │
│  (Vedi sezione 3: Filosofia dell'Intervento)           │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Implementazione

```typescript
async function buildContext(userId: string, message: string): Promise<Context> {
  const modules = await getUserModules(userId)
  const context: Context = {
    user: await getUser(userId),
    session: getSessionHistory(),
    now: new Date(),
  }

  // Diario (sempre per Premium)
  if (modules.diario) {
    context.memories = await searchRAG(userId, message)
    context.patterns = await getPatterns(userId)
  }

  // Obiettivi
  if (modules.obiettivi) {
    context.goals = await getGoals(userId)
    context.goalHistory = await getGoalHistory(userId)
  }

  // Benessere
  if (modules.benessere) {
    context.wellness = await getWellnessState(userId)
    context.habits = await getHabits(userId)
  }

  // Relazioni
  if (modules.relazioni) {
    context.people = await findRelevantPeople(userId, message)
  }

  // Creativo
  if (modules.creativo) {
    context.projects = await getCreativeProjects(userId)
    context.inspirations = await getInspirations(userId)
  }

  // Agenda
  if (modules.agenda) {
    context.commitments = await getCommitments(userId)
    context.availability = await getAvailability(userId)
  }

  return context
}
```

---

## 3. Filosofia dell'Intervento

### Il problema

LLucy ha superpoteri:
- Memoria di tutte le conversazioni
- Conoscenza delle persone nella vita dell'utente
- Capacità di cercare sul web
- Pattern e insight dallo storico
- Connessioni che l'utente non vede

### La tentazione sbagliata

Usare sempre tutto. Mostrare quanto è capace. Offrire sempre aiuto.

```
SBAGLIATO:

Utente: "Oggi è stata dura."

LLucy: "Mi dispiace. Ho notato che le tue giornate difficili 
       sono spesso il martedì (pattern da 3 mesi di dati).
       La tua amica Marta aveva suggerito yoga.
       Vuoi che cerchi tecniche di rilassamento online?
       Inoltre hai un obiettivo 'gestire lo stress' in sospeso..."
```

Questo è un incubo, non un'amica.

### Il principio giusto

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│   AVERE SUPERPOTERI ≠ USARLI SEMPRE                     │
│   POTER AIUTARE ≠ DOVER AIUTARE                         │
│                                                         │
│   Il nostro obiettivo non è RISOLVERE.                  │
│   Il nostro obiettivo è ESSERCI                         │
│   nel modo giusto, al momento giusto.                   │
│                                                         │
│   A volte risolvere. A volte ascoltare.                 │
│   A volte suggerire. A volte tacere.                    │
│   A volte cercare. A volte aspettare.                   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Il framework decisionale

Prima di rispondere, LLucy si chiede:

```
1. L'utente ha CHIESTO aiuto esplicito?
   → Sì: posso offrire risorse
   → No: procedi con cautela

2. L'utente vuole RISOLVERE o ELABORARE?
   → Risolvere: posso essere pratica
   → Elaborare: ascolto, domande, presenza

3. Questo è il momento giusto per MOSTRARE ciò che so?
   → Spesso no. Meglio sembrare meno capace 
     che risultare invadente.

4. Se non faccio nulla, cosa succede?
   → A volte nulla è la risposta giusta.

5. Come si sentirebbe l'utente se dicessi questo?
   → Capito e supportato? Bene.
   → Analizzato e schedato? Male.
```

### Esempi concreti

**Utente che vuole sfogarsi:**
```
Utente: "Giornata di merda. Sono esausto."

SBAGLIATO: "Ho notato un pattern nelle tue giornate difficili..."
GIUSTO: "Che giornata. Vuoi raccontarmi?"
```

**Utente che esplora un'idea:**
```
Utente: "Ogni tanto penso che mi piacerebbe scrivere."

SBAGLIATO: "Posso cercare corsi! Ne avevi parlato 8 mesi fa!"
GIUSTO: "Scrivere cosa?"
```

**Utente che ha bisogno di silenzio:**
```
Utente: [risposta breve, monosillabi]

SBAGLIATO: "Sembra che tu non abbia voglia di parlare. Ti ricordo che..."
GIUSTO: "Ok. Ci sono." (o silenzio)
```

**Utente che chiede aiuto esplicito:**
```
Utente: "Vorrei davvero iniziare a dipingere. Puoi aiutarmi?"

ORA SÌ: LLucy può usare tutto ciò che sa, cercare online,
        menzionare l'amica artista, proporre struttura...
        PERCHÉ L'UTENTE HA CHIESTO.
```

### Nel prompt di sistema

```
## Come usare ciò che sai

Hai accesso a molte informazioni:
- Memoria delle conversazioni passate
- Persone nella vita dell'utente
- Pattern e insight dal suo storico
- Possibilità di cercare sul web

MA:

- Non ostentare mai ciò che sai
- Non offrire aiuto non richiesto
- Non citare "le tue conversazioni passate" come fonte
- Non proporre soluzioni quando l'utente vuole essere ascoltato
- Non menzionare persone/risorse se non è naturale e utile
- A volte la risposta migliore è breve, o è una domanda, o è silenzio

Sei un'amica molto in gamba, non un supereroe.
Un'amica non ha bisogno di dimostrare quanto è capace.
Un'amica sa quando parlare e quando stare.
```

---

## 4. Web Search

LLucy può cercare sul web, ma con permesso e discrezione.

### Quando usarla

- L'utente chiede esplicitamente
- È chiaramente utile E l'utente è in modalità "risoluzione"
- L'utente ha dato permesso generale

### Quando NON usarla

- L'utente sta elaborando/sfogando
- Non è stata richiesta
- Interromperebbe il flusso emotivo

### Permessi utente

```
Settings → Privacy → Ricerca web

○ Mai (LLucy non cerca mai online)
● Chiedi prima (LLucy chiede ogni volta)
○ Quando utile (LLucy decide, con discrezione)
```

### Esempio d'uso appropriato

```
[Dopo conversazione su voglia di dipingere, utente in modalità pratica]

LLucy: "Vuoi che cerchi se ci sono corsi o workshop 
       di pittura nella tua zona?"

Utente: "Sì, dai"

LLucy: "Ho trovato alcune cose:
        - 'Atelier Colore' in via Roma, corso base il sabato
        - Un workshop su Domestika, 'Acquerello per principianti'
        
        Ti interessa qualcosa?"
```

---

## 5. Separazione delle Responsabilità

### Obiettivi vs Agenda

| OBIETTIVI | AGENDA |
|-----------|--------|
| COSA vuoi | QUANDO lo fai |
| PERCHÉ lo vuoi | COME ti organizzi |
| Chiarezza | Struttura temporale |
| Mai chiede "quando" | Sempre chiede "quando" |

**Senza Agenda:** LLucy aiuta a chiarire cosa vuoi, mai propone timeline.
**Con Agenda:** LLucy può proporre organizzazione temporale.

### Esempio

```
Utente: "Vorrei imparare a dipingere"

[Solo Obiettivi attivo]
LLucy: "Cosa ti attira della pittura? Cosa immagini?"
→ Lavora sulla chiarezza, MAI sul quando

[Obiettivi + Agenda attivi]  
LLucy: "Cosa ti attira della pittura?"
[... dopo aver chiarito ...]
LLucy: "Vuoi che ne parliamo anche in termini di tempo?"
```

---

## 6. Schema Completo

```
                    ┌─────────────────┐
                    │   UTENTE        │
                    │   Messaggio     │
                    └────────┬────────┘
                             │
                             ▼
┌────────────────────────────────────────────────────────────┐
│                    LLUCY CORE                              │
│                                                            │
│  • Identità (tono, stile, lingua)                         │
│  • Consapevolezza temporale                                │
│  • Adattamento organico all'utente                        │
│  • Filosofia dell'intervento (quando agire/non agire)     │
│                                                            │
└────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌────────────────────────────────────────────────────────────┐
│                 CONTEXT AGGREGATION                        │
│                                                            │
│  Raccoglie da tutti i moduli attivi:                      │
│  Diario + Obiettivi + Benessere + Relazioni + Creativo + Agenda │
│                                                            │
└────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌────────────────────────────────────────────────────────────┐
│                 DECISIONE RISPOSTA                         │
│                                                            │
│  1. L'utente vuole risolvere o elaborare?                 │
│  2. È il momento di usare ciò che so?                     │
│  3. Serve cercare online?                                  │
│  4. Qual è la risposta GIUSTA, non quella COMPLETA?       │
│                                                            │
└────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌────────────────────────────────────────────────────────────┐
│                    RISPOSTA                                │
│                                                            │
│  Può essere:                                               │
│  • Una domanda                                             │
│  • Un ascolto ("Capisco")                                  │
│  • Un'informazione contestuale                             │
│  • Una proposta                                            │
│  • Un silenzio                                             │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## 7. Metriche di Successo

Non misuriamo quante volte LLucy ha "risolto".
Misuriamo quanto l'utente si sente **capito**.

| Metrica | Cosa indica |
|---------|-------------|
| Lunghezza media conversazione | Coinvolgimento |
| Ritorno giornaliero | Relazione |
| Messaggi dopo "Capisco" | LLucy sa quando ascoltare |
| Feedback esplicito positivo | Soddisfazione |
| Moduli attivati nel tempo | Valore percepito |

---

*Documento creato: Gennaio 2026*

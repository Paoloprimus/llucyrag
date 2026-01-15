# LLucy - Pricing e Tier

> Struttura dei piani e cosa include ciascuno.
> Filosofia: semplicità, trasparenza, zero ansia.

---

## Principi

1. **Prezzo fisso** - Nessun token, nessun contatore visibile
2. **Limiti generosi** - Premium copre anche uso intenso
3. **Upgrade chiaro** - Il valore di ogni tier è evidente
4. **Downgrade facile** - Nessun lock-in, i dati restano tuoi

---

## I Tier

### 🆓 Free

**Prezzo**: €0

**Per chi**: Chi vuole provare LLucy, uso occasionale.

| Feature | Incluso |
|---------|---------|
| Chat con LLucy | ✓ |
| Memoria | Solo sessione corrente |
| Moduli | Nessuno |
| Limiti | ~50 messaggi/giorno |

**Esperienza**: LLucy è un consigliere attento e competente, ma dimentica tutto quando chiudi l'app. Ogni conversazione riparte da zero.

**Messaggio all'utente**:
> "LLucy ti ascolta e ti aiuta, ma non può ricordarsi di te tra una sessione e l'altra. Passa a Premium per costruire una relazione che cresce nel tempo."

---

### ⭐ Premium

**Prezzo**: €15/mese

**Per chi**: Chi vuole LLucy come compagno costante.

| Feature | Incluso |
|---------|---------|
| Chat con LLucy | ✓ |
| **Diario** (auto) | ✓ Memoria + Insight |
| Moduli opzionali | Tutti disponibili |
| Limiti | Molto alti (~500 msg/giorno) |

**Cosa si attiva automaticamente con Premium**:

```
DIARIO (sempre attivo)
├── Memoria RAG (ricorda tutto)
├── Revisione settimanale
├── Tracking umore
├── Pattern recognition
└── Connessioni tematiche
```

**Moduli attivabili** (inclusi nel prezzo):

```
○ Obiettivi - Goal tracking e coaching
○ Benessere - Check-in salute e abitudini
○ [Futuri moduli]
```

**Esperienza**: LLucy ti conosce. Ricorda le conversazioni passate, nota pattern, ti offre insight settimanali. I moduli aggiuntivi sono lì quando li vuoi.

**Messaggio all'utente**:
> "Con Premium, LLucy diventa un compagno che ti conosce davvero. Ricorda tutto, nota pattern che tu non vedi, e cresce con te nel tempo."

---

### 💎 Pro

**Prezzo**: €50/mese

**Per chi**: Chi si appoggia sistematicamente a LLucy nella vita quotidiana.

| Feature | Incluso |
|---------|---------|
| Tutto Premium | ✓ |
| Limiti | Nessuno |
| Adattamento profondo | ✓ |
| Accesso anticipato | ✓ Beta features |
| Priorità | ✓ Support dedicato |

**Cosa rende Pro speciale**:

Non è "Premium senza limiti". È **LLucy che ti conosce a un livello superiore**.

| Feature Pro | Descrizione |
|-------------|-------------|
| **Adattamento profondo** | LLucy affina il suo stile su di te nel tempo, senza che tu debba configurare nulla |
| **Analisi estese** | Insight su periodi più lunghi (trimestri, anno) |
| **Memoria "importante"** | Puoi dire "Ricordati questo" e LLucy lo tiene presente sempre |
| **Riflessioni proattive** | LLucy può iniziare lei una conversazione se nota qualcosa |
| **Export dati** | Scarica tutta la tua storia in formato leggibile |
| **API personale** | Per integrazioni custom (automazioni, etc.) |

**Esperienza**: LLucy non è solo un'app, è una presenza costante che si adatta a te organicamente. Sa quando essere diretta e quando esplorare. Impara il tuo ritmo, i tuoi modi, le tue sfumature.

**Messaggio all'utente**:
> "Con Pro, LLucy diventa veramente tua. Si adatta al tuo stile senza che tu debba spiegare nulla. È il compagno che ti capisce prima ancora che tu parli."

---

## Confronto

| | Free | Premium €15 | Pro €50 |
|--|------|-------------|---------|
| Chat | ✓ | ✓ | ✓ |
| Memoria sessione | ✓ | ✓ | ✓ |
| Memoria permanente | - | ✓ | ✓ |
| Diario (insight) | - | ✓ | ✓ |
| Moduli (Obiettivi, Benessere...) | - | ✓ | ✓ |
| Limiti generosi | - | ✓ | - |
| Limiti illimitati | - | - | ✓ |
| Adattamento profondo | - | - | ✓ |
| Riflessioni proattive | - | - | ✓ |
| Export dati | - | - | ✓ |
| Accesso beta | - | - | ✓ |

---

## Upgrade/Downgrade

### Free → Premium
- I dati della sessione corrente vengono mantenuti
- Da quel momento, tutto viene ricordato
- Moduli disponibili immediatamente

### Premium → Pro
- Nessuna interruzione
- Feature Pro attive immediatamente
- LLucy inizia ad adattarsi più profondamente

### Premium/Pro → Free
- **I dati restano salvati** (per 90 giorni)
- L'utente può ri-upgraddare e ritrovare tutto
- In Free, LLucy non accede ai dati ma non li cancella

### Cancellazione account
- Export completo disponibile prima della cancellazione
- Tutti i dati eliminati definitivamente
- Conforme GDPR

---

## Pricing Philosophy

### Perché €15 per Premium?

- Abbastanza basso da essere accessibile
- Abbastanza alto da coprire costi API (Claude) anche per uso intenso
- Un caffè ogni 2 giorni per un compagno sempre presente

### Perché €50 per Pro?

- Per chi LLucy è strumento quotidiano essenziale
- Copre costi di elaborazione illimitata
- Feature esclusive giustificano il prezzo
- ~€1.60/giorno per supporto illimitato

### Perché non token/pay-per-use?

LLucy è uno spazio di supporto emotivo. Contare i token:
- Crea ansia
- Rompe l'intimità
- Trasforma la relazione in transazione

Il prezzo fisso permette all'utente di **dimenticarsi dei costi** e concentrarsi su sé stesso.

---

## Implementazione Tecnica

### Rate Limiting

```typescript
const LIMITS = {
  free: {
    messages_per_day: 50,
    messages_per_hour: 20,
  },
  premium: {
    messages_per_day: 500,
    messages_per_hour: 100,
  },
  pro: {
    messages_per_day: Infinity,
    messages_per_hour: Infinity,
  },
}
```

### Soft Limits

- Al 80% del limite giornaliero: notifica gentile
- Al 100%: messaggio "Hai chattato tanto oggi! Ci vediamo domani?" (non blocco duro)
- Leggero buffer oltre il limite per non interrompere conversazioni importanti

### Database

```sql
-- Aggiungere a users table
alter table users add column tier text default 'free' 
  check (tier in ('free', 'premium', 'pro'));

alter table users add column subscription_start timestamp with time zone;
alter table users add column subscription_end timestamp with time zone;

-- Tracking uso (per analytics, non per blocco)
create table usage_daily (
  user_id uuid references users(id),
  date date,
  messages_count int default 0,
  primary key (user_id, date)
);
```

---

## Comunicazione

### Landing Page

```
LLucy - Il tuo compagno che ti capisce

[Prova gratis]

Premium €15/mese
✓ LLucy ricorda tutto
✓ Insight settimanali
✓ Tutti i moduli inclusi

Pro €50/mese  
✓ Tutto Premium
✓ Uso illimitato
✓ LLucy si adatta a te
```

### In-App Upgrade Prompt (gentile)

```
"Oggi abbiamo parlato di molte cose. 
Mi piacerebbe ricordarle per la prossima volta.

Con Premium, posso costruire una memoria 
delle nostre conversazioni e conoscerti meglio.

[Scopri Premium] [Non ora]"
```

---

*Documento creato: Gennaio 2026*

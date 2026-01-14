# 🤖 LLucy

**llucy.it** - Il tuo assistente AI con memoria

---

## 🏗️ Architettura

```
llucy.it              →  Chat minimalista (solo conversazione)
settings.llucy.it     →  Login, profilo, upload memoria, billing
```

### Stack

| Componente | Tecnologia | Costo |
|------------|------------|-------|
| **Frontend** | Next.js 15 + Tailwind | $0 (Vercel) |
| **Database** | Supabase Postgres + pgvector | $0 (free tier) |
| **Auth** | Supabase Magic Link | $0 |
| **LLM** | Claude Sonnet 4.5 | ~$0.015/query |
| **Embeddings** | Cloudflare Workers AI | $0 |

---

## 🚀 Quick Start (Sviluppo Locale)

### 1. Clona e installa

```bash
git clone https://github.com/tuousername/llucy.git
cd llucy
npm install
```

### 2. Crea progetto Supabase

1. Vai su [supabase.com](https://supabase.com) → New Project
2. Copia **URL** e **anon key** da Settings → API
3. Vai su SQL Editor → esegui il contenuto di `supabase/schema.sql`

### 3. Crea account Cloudflare (per embeddings)

1. Vai su [dash.cloudflare.com](https://dash.cloudflare.com)
2. Copia **Account ID** dalla sidebar
3. Vai su My Profile → API Tokens → Create Token
4. Seleziona "Workers AI" template → Create

### 4. Configura environment

Crea `.env.local` in `apps/chat/`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
ANTHROPIC_API_KEY=sk-ant-...
```

Crea `.env.local` in `apps/settings/`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
CLOUDFLARE_ACCOUNT_ID=abc123
CLOUDFLARE_API_TOKEN=xxx
```

### 5. Avvia

```bash
# Terminal 1 - Chat (porta 3000)
npm run dev

# Terminal 2 - Settings (porta 3001)
npm run dev:settings
```

Apri:
- Chat: http://localhost:3000
- Settings: http://localhost:3001

---

## 🌐 Deploy su Vercel

### 1. Prepara repository

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/tuousername/llucy.git
git push -u origin main
```

### 2. Deploy Chat App (llucy.it)

1. Vai su [vercel.com](https://vercel.com) → Add New → Project
2. Importa il repo GitHub
3. Configura:
   - **Root Directory**: `apps/chat`
   - **Framework**: Next.js
4. Aggiungi Environment Variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY
   ANTHROPIC_API_KEY
   ```
5. Deploy!
6. Vai su Settings → Domains → Aggiungi `llucy.it`

### 3. Deploy Settings App (settings.llucy.it)

1. Vercel → Add New → Project (stesso repo)
2. Configura:
   - **Root Directory**: `apps/settings`
   - **Framework**: Next.js
3. Aggiungi Environment Variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY
   SUPABASE_SERVICE_ROLE_KEY
   CLOUDFLARE_ACCOUNT_ID
   CLOUDFLARE_API_TOKEN
   ```
4. Deploy!
5. Vai su Settings → Domains → Aggiungi `settings.llucy.it`

### 4. Configura Supabase Auth

In Supabase Dashboard → Authentication → URL Configuration:

- **Site URL**: `https://settings.llucy.it`
- **Redirect URLs**: 
  - `https://settings.llucy.it/auth/callback`
  - `http://localhost:3001/auth/callback` (per dev)

---

## 📁 Struttura Progetto

```
llucy/
├── apps/
│   ├── chat/                 # llucy.it
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── page.tsx          # Chat UI
│   │   │   │   └── api/chat/         # Claude API
│   │   │   ├── components/
│   │   │   │   ├── ChatInput.tsx
│   │   │   │   └── ChatMessage.tsx
│   │   │   └── lib/
│   │   │       └── supabase-client.ts
│   │   └── middleware.ts
│   │
│   └── settings/             # settings.llucy.it
│       ├── src/
│       │   ├── app/
│       │   │   ├── page.tsx          # Dashboard
│       │   │   ├── auth/callback/    # Magic link
│       │   │   └── api/ingest/       # RAG pipeline
│       │   ├── components/
│       │   │   ├── LoginForm.tsx
│       │   │   ├── Dashboard.tsx
│       │   │   └── ChatUploader.tsx
│       │   └── lib/
│       │       ├── supabase-client.ts
│       │       └── supabase-server.ts
│       └── middleware.ts
│
├── packages/
│   └── rag/                  # Modulo estraibile
│       └── src/
│           ├── index.ts
│           ├── parsers.ts    # ChatGPT/Claude/Gemini/Deepseek
│           ├── chunker.ts    # Split con overlap
│           ├── embedder.ts   # Cloudflare AI + pgvector
│           └── pipeline.ts   # ingestUserChats()
│
├── supabase/
│   └── schema.sql            # Database schema
│
└── package.json              # Monorepo config
```

---

## 💰 Costi Stimati

### Infrastruttura: $0/mese
- Vercel Hobby: gratis
- Supabase Free: gratis (500MB, 50K auth)
- Cloudflare AI: gratis (10K req/giorno)

### LLM: Pay-per-use
- Claude Sonnet: ~$0.015/query
- 5 query/giorno = ~$2/mese
- 20 query/giorno = ~$9/mese

---

## 🔧 Comandi Utili

```bash
# Sviluppo
npm run dev              # Chat app
npm run dev:settings     # Settings app

# Build
npm run build            # Build all

# Lint
npm run lint             # Lint all
```

---

## 📝 Note

### Condivisione Auth tra domini

Chat e Settings condividono la stessa sessione Supabase grazie ai cookie cross-domain. 
Assicurati che entrambi i domini siano sotto `llucy.it`.

### RAG Pipeline

Il modulo `@llucy/rag` è completamente estraibile. Può essere usato in altri progetti:

```typescript
import { ingestUserChats, searchSimilar } from '@llucy/rag'
```

### Formati Chat Supportati

- **ChatGPT**: `.md` (Markdown export)
- **Claude**: `.json` (conversations.json)
- **Gemini**: `.md`
- **Deepseek**: `.md`

---

## 📄 License

MIT

---

Made with ❤️ for self-reflection and personal growth.

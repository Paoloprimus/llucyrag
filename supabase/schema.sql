-- ============================================
-- LLucy Database Schema
-- ============================================

-- Enable pgvector extension
create extension if not exists vector;

-- ============================================
-- USERS
-- ============================================
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text,
  modules jsonb default '{"diario": false}',
  tier text default 'free' check (tier in ('free', 'pro', 'beta')),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- RLS
alter table users enable row level security;

create policy "Users can insert own data" on users
  for insert with check (auth.uid() = id);

create policy "Users can read own data" on users
  for select using (auth.uid() = id);

create policy "Users can update own data" on users
  for update using (auth.uid() = id);

-- ============================================
-- CHAT SESSIONS (conversazioni recenti con LLucy)
-- ============================================
create table if not exists chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  topic text,
  started_at timestamp with time zone default now(),
  ended_at timestamp with time zone
);

-- RLS
alter table chat_sessions enable row level security;

create policy "Users can CRUD own sessions" on chat_sessions
  for all using (auth.uid() = user_id);

-- ============================================
-- CHAT MESSAGES (messaggi recenti)
-- ============================================
create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  session_id uuid references chat_sessions(id) on delete set null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamp with time zone default now()
);

-- RLS
alter table chat_messages enable row level security;

create policy "Users can CRUD own messages" on chat_messages
  for all using (auth.uid() = user_id);

-- Index per query recenti
create index chat_messages_user_date on chat_messages (user_id, created_at desc);

-- ============================================
-- CHAT CHUNKS (RAG - memoria lunga)
-- ============================================
create table if not exists chat_chunks (
  id text primary key,
  user_id uuid references users(id) on delete cascade,
  content text not null,
  embedding vector(384),  -- bge-small-en-v1.5 = 384 dimensions
  source text not null,   -- 'chatgpt', 'claude', etc.
  title text,
  conversation_id text,
  created_at timestamp with time zone default now()
);

-- RLS
alter table chat_chunks enable row level security;

create policy "Users can CRUD own chunks" on chat_chunks
  for all using (auth.uid() = user_id);

-- Index per ricerca vettoriale
create index chat_chunks_embedding on chat_chunks 
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- ============================================
-- FUNCTION: Ricerca semantica
-- ============================================
create or replace function match_chunks(
  query_embedding vector(384),
  match_count int default 5,
  filter_user_id uuid default null
)
returns table (
  id text,
  content text,
  source text,
  title text,
  conversation_id text,
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
    1 - (cc.embedding <=> query_embedding) as similarity
  from chat_chunks cc
  where cc.user_id = filter_user_id
  order by cc.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger users_updated_at
  before update on users
  for each row execute function update_updated_at();

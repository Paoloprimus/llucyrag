-- Migration: Modulo Obiettivi (semplificato)
-- Focus su COSA e PERCHÉ, non su timeline

-- Tabella goals
create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade not null,
  
  -- Core: cosa vuoi e perché
  title text not null,
  description text, -- Cosa significa questo obiettivo per te
  why text, -- Perché è importante
  
  -- Status semplice
  status text default 'active' check (status in ('exploring', 'active', 'achieved', 'released')),
  -- exploring = ci sto ancora pensando
  -- active = ci sto lavorando
  -- achieved = raggiunto
  -- released = lasciato andare (senza giudizio)
  
  -- Connessioni (popolate da LLucy)
  related_topics text[], -- Temi correlati trovati nel RAG
  related_people text[], -- Persone correlate trovate nel RAG
  
  -- Metadata
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  achieved_at timestamp with time zone
);

-- Tabella riflessioni sugli obiettivi (opzionale, conversazionale)
create table if not exists goal_reflections (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid references goals(id) on delete cascade not null,
  user_id uuid references users(id) on delete cascade not null,
  
  content text not null, -- La riflessione
  insight text, -- Eventuale insight di LLucy
  
  created_at timestamp with time zone default now()
);

-- RLS
alter table goals enable row level security;
alter table goal_reflections enable row level security;

create policy "Users can manage own goals"
  on goals for all
  using (auth.uid() = user_id);

create policy "Service role full access goals"
  on goals for all
  using (true);

create policy "Users can manage own reflections"
  on goal_reflections for all
  using (auth.uid() = user_id);

create policy "Service role full access reflections"
  on goal_reflections for all
  using (true);

-- Index
create index idx_goals_user_status on goals(user_id, status);
create index idx_reflections_goal on goal_reflections(goal_id, created_at desc);

-- Grants
grant all on goals to authenticated;
grant all on goals to service_role;
grant all on goal_reflections to authenticated;
grant all on goal_reflections to service_role;

-- Function: Get active goals for prompt context
create or replace function get_active_goals(p_user_id uuid)
returns table (
  id uuid,
  title text,
  description text,
  why text,
  status text,
  related_topics text[],
  related_people text[]
)
language sql
as $$
  select id, title, description, why, status, related_topics, related_people
  from goals
  where user_id = p_user_id
    and status in ('exploring', 'active')
  order by created_at desc
  limit 10;
$$;

grant execute on function get_active_goals to authenticated;
grant execute on function get_active_goals to service_role;

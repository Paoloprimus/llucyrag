-- Migration: Mood tracking for Diario module
-- Tracks user mood passively from conversations

-- Enum per i livelli di umore
create type mood_level as enum (
  'molto_negativo',
  'negativo', 
  'neutro',
  'positivo',
  'molto_positivo'
);

-- Tabella mood entries
create table if not exists mood_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade not null,
  
  -- Mood data
  mood mood_level not null,
  intensity float default 0.5, -- 0.0 to 1.0, quanto è forte l'emozione
  
  -- Context
  keywords text[], -- parole chiave rilevate (es: ["stanco", "lavoro"])
  session_id text, -- collegamento alla sessione chat
  
  -- Metadata
  created_at timestamp with time zone default now(),
  
  -- Index per query veloci
  constraint mood_entries_user_date unique (user_id, created_at)
);

-- Index per ricerche temporali
create index idx_mood_entries_user_date on mood_entries(user_id, created_at desc);

-- RLS
alter table mood_entries enable row level security;

create policy "Users can view own mood entries"
  on mood_entries for select
  using (auth.uid() = user_id);

create policy "Service role can insert mood entries"
  on mood_entries for insert
  with check (true);

create policy "Users can delete own mood entries"
  on mood_entries for delete
  using (auth.uid() = user_id);

-- Function: Get mood summary for a period
create or replace function get_mood_summary(
  p_user_id uuid,
  p_days int default 7
)
returns table (
  avg_mood float,
  mood_trend text,
  dominant_mood mood_level,
  entry_count int
)
language plpgsql
as $$
declare
  v_avg float;
  v_recent_avg float;
  v_old_avg float;
begin
  -- Calcola media generale (mood convertito in numero: -2 a +2)
  select avg(
    case mood
      when 'molto_negativo' then -2
      when 'negativo' then -1
      when 'neutro' then 0
      when 'positivo' then 1
      when 'molto_positivo' then 2
    end
  ) into v_avg
  from mood_entries
  where user_id = p_user_id
    and created_at > now() - (p_days || ' days')::interval;

  -- Media primi 50% vs ultimi 50% per trend
  select avg(
    case mood
      when 'molto_negativo' then -2
      when 'negativo' then -1
      when 'neutro' then 0
      when 'positivo' then 1
      when 'molto_positivo' then 2
    end
  ) into v_recent_avg
  from mood_entries
  where user_id = p_user_id
    and created_at > now() - (p_days / 2 || ' days')::interval;

  select avg(
    case mood
      when 'molto_negativo' then -2
      when 'negativo' then -1
      when 'neutro' then 0
      when 'positivo' then 1
      when 'molto_positivo' then 2
    end
  ) into v_old_avg
  from mood_entries
  where user_id = p_user_id
    and created_at > now() - (p_days || ' days')::interval
    and created_at <= now() - (p_days / 2 || ' days')::interval;

  return query
  select 
    coalesce(v_avg, 0)::float as avg_mood,
    case 
      when v_recent_avg is null or v_old_avg is null then 'stabile'
      when v_recent_avg > v_old_avg + 0.3 then 'miglioramento'
      when v_recent_avg < v_old_avg - 0.3 then 'peggioramento'
      else 'stabile'
    end as mood_trend,
    (
      select mood 
      from mood_entries 
      where user_id = p_user_id 
        and created_at > now() - (p_days || ' days')::interval
      group by mood 
      order by count(*) desc 
      limit 1
    ) as dominant_mood,
    (
      select count(*)::int 
      from mood_entries 
      where user_id = p_user_id 
        and created_at > now() - (p_days || ' days')::interval
    ) as entry_count;
end;
$$;

grant execute on function get_mood_summary to authenticated;
grant execute on function get_mood_summary to service_role;

-- Grant permissions
grant all on mood_entries to authenticated;
grant all on mood_entries to service_role;

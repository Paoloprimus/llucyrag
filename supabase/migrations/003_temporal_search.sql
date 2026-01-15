-- Migration: Add temporal search function for RAG
-- This enables queries like "ieri di cosa abbiamo parlato?"

-- Function: Semantic search with date range filter
create or replace function match_chunks_in_range(
  query_embedding vector(384),
  match_count int default 5,
  filter_user_id uuid default null,
  date_from timestamp with time zone default null,
  date_to timestamp with time zone default null
)
returns table (
  id text,
  content text,
  source text,
  title text,
  conversation_id text,
  created_at timestamp with time zone,
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
    cc.created_at,
    1 - (cc.embedding <=> query_embedding) as similarity
  from chat_chunks cc
  where cc.user_id = filter_user_id
    and (date_from is null or cc.created_at >= date_from)
    and (date_to is null or cc.created_at <= date_to)
  order by cc.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- Grant execute permission
grant execute on function match_chunks_in_range to authenticated;
grant execute on function match_chunks_in_range to service_role;

/**
 * Embedder - genera embeddings e cerca nel vector store
 * Usa Cloudflare Workers AI per embeddings (gratis)
 * Usa Supabase pgvector per storage e ricerca
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'

export interface SearchResult {
  id: string
  content: string
  source: string
  title: string
  conversationId: string
  similarity: number
}

interface EmbedderConfig {
  supabaseUrl: string
  supabaseKey: string
  cloudflareAccountId?: string
  cloudflareApiToken?: string
}

let supabase: SupabaseClient | null = null

function getSupabase(config: EmbedderConfig): SupabaseClient {
  if (!supabase) {
    supabase = createClient(config.supabaseUrl, config.supabaseKey)
  }
  return supabase
}

/**
 * Genera embeddings usando Cloudflare Workers AI
 */
export async function generateEmbeddings(
  texts: string[],
  config: { cloudflareAccountId: string; cloudflareApiToken: string }
): Promise<number[][]> {
  const { cloudflareAccountId, cloudflareApiToken } = config

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId}/ai/run/@cf/baai/bge-small-en-v1.5`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cloudflareApiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: texts }),
    }
  )

  if (!response.ok) {
    throw new Error(`Cloudflare AI error: ${response.statusText}`)
  }

  const data = await response.json() as { 
    success: boolean
    result: { data: number[][] }
  }
  
  if (!data.success) {
    throw new Error('Cloudflare AI returned unsuccessful response')
  }

  return data.result.data
}

/**
 * Cerca chunks simili nel database
 */
export async function searchSimilar(
  query: string,
  userId: string,
  config: EmbedderConfig,
  limit = 5
): Promise<SearchResult[]> {
  const db = getSupabase(config)

  // Genera embedding per la query
  if (!config.cloudflareAccountId || !config.cloudflareApiToken) {
    throw new Error('Cloudflare config required for embeddings')
  }

  const [queryEmbedding] = await generateEmbeddings([query], {
    cloudflareAccountId: config.cloudflareAccountId,
    cloudflareApiToken: config.cloudflareApiToken,
  })

  // Cerca in Supabase con pgvector
  const { data, error } = await db.rpc('match_chunks', {
    query_embedding: queryEmbedding,
    match_count: limit,
    filter_user_id: userId,
  })

  if (error) {
    throw new Error(`Supabase search error: ${error.message}`)
  }

  return (data || []).map((row: {
    id: string
    content: string
    source: string
    title: string
    conversation_id: string
    similarity: number
  }) => ({
    id: row.id,
    content: row.content,
    source: row.source,
    title: row.title,
    conversationId: row.conversation_id,
    similarity: row.similarity,
  }))
}

/**
 * Salva chunks con embeddings nel database
 */
export async function saveChunks(
  chunks: Array<{
    id: string
    content: string
    embedding: number[]
    source: string
    title: string
    conversationId: string
  }>,
  userId: string,
  config: EmbedderConfig
): Promise<void> {
  const db = getSupabase(config)

  const rows = chunks.map(chunk => ({
    id: chunk.id,
    user_id: userId,
    content: chunk.content,
    embedding: chunk.embedding,
    source: chunk.source,
    title: chunk.title,
    conversation_id: chunk.conversationId,
  }))

  const { error } = await db.from('chat_chunks').upsert(rows)

  if (error) {
    throw new Error(`Supabase insert error: ${error.message}`)
  }
}

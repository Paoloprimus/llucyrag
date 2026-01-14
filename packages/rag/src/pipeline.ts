/**
 * Pipeline completa: file → parse → chunk → embed → store
 */

import { parseExport, type ParsedConversation } from './parsers'
import { chunkConversations, type Chunk } from './chunker'
import { generateEmbeddings, saveChunks } from './embedder'

export interface IngestResult {
  conversationsProcessed: number
  chunksCreated: number
  success: boolean
  error?: string
}

export interface IngestConfig {
  supabaseUrl: string
  supabaseKey: string
  cloudflareAccountId: string
  cloudflareApiToken: string
}

/**
 * Processa e indicizza i file chat di un utente
 */
export async function ingestUserChats(
  files: Array<{ content: string; filename: string }>,
  userId: string,
  config: IngestConfig
): Promise<IngestResult> {
  try {
    console.log(`[RAG] Processing ${files.length} files for user ${userId}`)
    
    // 1. Parse tutti i file
    const allConversations: ParsedConversation[] = []
    
    for (const file of files) {
      console.log(`[RAG] Parsing file: ${file.filename} (${file.content.length} chars)`)
      const conversations = await parseExport(file.content, file.filename)
      console.log(`[RAG] Found ${conversations.length} conversations`)
      allConversations.push(...conversations)
    }

    if (allConversations.length === 0) {
      console.log('[RAG] No conversations found, returning empty result')
      return {
        conversationsProcessed: 0,
        chunksCreated: 0,
        success: true,
      }
    }

    // 2. Chunk tutte le conversazioni
    console.log(`[RAG] Chunking ${allConversations.length} conversations...`)
    const chunks = chunkConversations(allConversations)
    console.log(`[RAG] Created ${chunks.length} chunks`)

    if (chunks.length === 0) {
      return {
        conversationsProcessed: allConversations.length,
        chunksCreated: 0,
        success: true,
      }
    }

    // 3. Genera embeddings in batch (max 100 alla volta per Cloudflare)
    const BATCH_SIZE = 100
    const chunksWithEmbeddings: Array<Chunk & { embedding: number[] }> = []

    console.log(`[RAG] Generating embeddings for ${chunks.length} chunks...`)
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE)
      const texts = batch.map(c => c.content)
      
      console.log(`[RAG] Embedding batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(chunks.length/BATCH_SIZE)}`)
      const embeddings = await generateEmbeddings(texts, {
        cloudflareAccountId: config.cloudflareAccountId,
        cloudflareApiToken: config.cloudflareApiToken,
      })

      for (let j = 0; j < batch.length; j++) {
        chunksWithEmbeddings.push({
          ...batch[j],
          embedding: embeddings[j],
        })
      }
    }

    // 4. Salva in Supabase
    console.log(`[RAG] Saving ${chunksWithEmbeddings.length} chunks to Supabase...`)
    await saveChunks(
      chunksWithEmbeddings.map(c => ({
        id: c.id,
        content: c.content,
        embedding: c.embedding,
        source: c.source,
        title: c.title,
        conversationId: c.conversationId,
      })),
      userId,
      config
    )
    console.log('[RAG] Chunks saved successfully')

    return {
      conversationsProcessed: allConversations.length,
      chunksCreated: chunksWithEmbeddings.length,
      success: true,
    }

  } catch (error) {
    console.error('[RAG] Error:', error)
    return {
      conversationsProcessed: 0,
      chunksCreated: 0,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

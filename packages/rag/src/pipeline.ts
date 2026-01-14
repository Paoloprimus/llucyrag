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
    // 1. Parse tutti i file
    const allConversations: ParsedConversation[] = []
    
    for (const file of files) {
      const conversations = await parseExport(file.content, file.filename)
      allConversations.push(...conversations)
    }

    if (allConversations.length === 0) {
      return {
        conversationsProcessed: 0,
        chunksCreated: 0,
        success: true,
      }
    }

    // 2. Chunk tutte le conversazioni
    const chunks = chunkConversations(allConversations)

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

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE)
      const texts = batch.map(c => c.content)
      
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

    return {
      conversationsProcessed: allConversations.length,
      chunksCreated: chunksWithEmbeddings.length,
      success: true,
    }

  } catch (error) {
    return {
      conversationsProcessed: 0,
      chunksCreated: 0,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

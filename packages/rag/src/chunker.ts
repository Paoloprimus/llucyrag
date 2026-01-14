/**
 * Chunker per conversazioni
 * Divide le conversazioni in chunks di dimensione gestibile
 */

import type { ParsedConversation } from './parsers'

export interface Chunk {
  id: string
  conversationId: string
  content: string
  source: string
  title: string
  chunkIndex: number
}

const DEFAULT_CHUNK_SIZE = 1000  // caratteri
const DEFAULT_OVERLAP = 200     // caratteri di overlap

export interface ChunkOptions {
  chunkSize?: number
  overlap?: number
}

/**
 * Divide una conversazione in chunks
 */
export function chunkConversations(
  conversations: ParsedConversation[],
  options: ChunkOptions = {}
): Chunk[] {
  const { chunkSize = DEFAULT_CHUNK_SIZE, overlap = DEFAULT_OVERLAP } = options
  const chunks: Chunk[] = []

  for (const conv of conversations) {
    // Combina tutti i messaggi in un testo unico
    const fullText = conv.messages
      .map(m => `${m.role === 'user' ? 'Utente' : 'Assistente'}: ${m.content}`)
      .join('\n\n')

    // Dividi in chunks con overlap
    const convChunks = splitTextWithOverlap(fullText, chunkSize, overlap)

    for (let i = 0; i < convChunks.length; i++) {
      chunks.push({
        id: `${conv.id}-${i}`,
        conversationId: conv.id,
        content: convChunks[i],
        source: conv.source,
        title: conv.title,
        chunkIndex: i,
      })
    }
  }

  return chunks
}

/**
 * Divide il testo in chunks con overlap
 */
function splitTextWithOverlap(
  text: string,
  chunkSize: number,
  overlap: number
): string[] {
  if (text.length <= chunkSize) {
    return [text]
  }

  const chunks: string[] = []
  let start = 0

  while (start < text.length) {
    let end = start + chunkSize

    // Trova un punto di interruzione naturale (fine frase o paragrafo)
    if (end < text.length) {
      const breakPoints = ['\n\n', '\n', '. ', '! ', '? ', ', ']
      
      for (const bp of breakPoints) {
        const bpIndex = text.lastIndexOf(bp, end)
        if (bpIndex > start + chunkSize / 2) {
          end = bpIndex + bp.length
          break
        }
      }
    } else {
      end = text.length
    }

    chunks.push(text.slice(start, end).trim())
    
    // Prossimo chunk inizia con overlap
    start = end - overlap
    if (start >= text.length) break
  }

  return chunks.filter(c => c.length > 0)
}

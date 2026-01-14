// @llucy/rag - Modulo RAG estraibile
// Può essere usato in LLucy, Fliqk, o qualsiasi altra app

export { parseExport, type ParsedConversation } from './parsers'
export { chunkConversations, type Chunk } from './chunker'
export { generateEmbeddings, searchSimilar, type SearchResult } from './embedder'
export { ingestUserChats, type IngestResult } from './pipeline'

/**
 * Parser per export di varie piattaforme AI
 * Supporta: ChatGPT (MD), Claude (JSON), Gemini (MD), Deepseek (MD)
 */

export interface ParsedMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ParsedConversation {
  id: string
  title: string
  source: 'chatgpt' | 'claude' | 'gemini' | 'deepseek' | 'unknown'
  messages: ParsedMessage[]
  createdAt?: string
}

/**
 * Rileva il tipo di file e parsa di conseguenza
 */
export async function parseExport(
  file: File | string,
  filename?: string
): Promise<ParsedConversation[]> {
  const content = typeof file === 'string' ? file : await file.text()
  const name = filename || (typeof file === 'string' ? 'unknown' : file.name)

  // Rileva formato
  if (name.endsWith('.json')) {
    return parseClaudeJSON(content)
  }
  
  if (name.endsWith('.md')) {
    // Rileva source dal contenuto o nome file
    if (name.toLowerCase().includes('chatgpt') || content.includes('# ChatGPT')) {
      return parseChatGPTMarkdown(content, name)
    }
    if (name.toLowerCase().includes('gemini')) {
      return parseGeminiMarkdown(content, name)
    }
    if (name.toLowerCase().includes('deepseek')) {
      return parseDeepseekMarkdown(content, name)
    }
    // Default: prova ChatGPT format
    return parseChatGPTMarkdown(content, name)
  }

  throw new Error(`Formato file non supportato: ${name}`)
}

/**
 * Parser per export Claude (conversations.json)
 */
function parseClaudeJSON(content: string): ParsedConversation[] {
  const data = JSON.parse(content)
  const conversations: ParsedConversation[] = []

  // Claude export ha struttura: { conversations: [...] } o è direttamente un array
  const items = Array.isArray(data) ? data : data.conversations || []

  for (const conv of items) {
    const messages: ParsedMessage[] = []
    
    // Claude usa chat_messages o messages
    const msgs = conv.chat_messages || conv.messages || []
    
    for (const msg of msgs) {
      const role = msg.sender === 'human' || msg.role === 'user' ? 'user' : 'assistant'
      const content = typeof msg.text === 'string' ? msg.text : 
                     typeof msg.content === 'string' ? msg.content :
                     Array.isArray(msg.content) ? msg.content.map((c: {text?: string}) => c.text || '').join('') : ''
      
      if (content.trim()) {
        messages.push({ role, content: content.trim() })
      }
    }

    if (messages.length > 0) {
      conversations.push({
        id: conv.uuid || conv.id || crypto.randomUUID(),
        title: conv.name || conv.title || 'Conversazione senza titolo',
        source: 'claude',
        messages,
        createdAt: conv.created_at,
      })
    }
  }

  return conversations
}

/**
 * Parser per export ChatGPT (Markdown)
 */
function parseChatGPTMarkdown(content: string, filename: string): ParsedConversation[] {
  const messages: ParsedMessage[] = []
  
  // Pattern: **User:** o **Assistant:** o ## User / ## Assistant
  const lines = content.split('\n')
  let currentRole: 'user' | 'assistant' | null = null
  let currentContent: string[] = []

  for (const line of lines) {
    const userMatch = line.match(/^(?:\*\*User:\*\*|## User|User:)/i)
    const assistantMatch = line.match(/^(?:\*\*(?:Assistant|ChatGPT):\*\*|## (?:Assistant|ChatGPT)|(?:Assistant|ChatGPT):)/i)

    if (userMatch || assistantMatch) {
      // Salva messaggio precedente
      if (currentRole && currentContent.length > 0) {
        messages.push({
          role: currentRole,
          content: currentContent.join('\n').trim(),
        })
      }
      
      currentRole = userMatch ? 'user' : 'assistant'
      // Rimuovi il marker dal contenuto
      const markerEnd = line.indexOf(':') + 1
      currentContent = [line.slice(markerEnd).trim()]
    } else if (currentRole) {
      currentContent.push(line)
    }
  }

  // Salva ultimo messaggio
  if (currentRole && currentContent.length > 0) {
    messages.push({
      role: currentRole,
      content: currentContent.join('\n').trim(),
    })
  }

  // Estrai titolo dal filename o primo messaggio
  const title = filename.replace(/^\d+_/, '').replace(/\.md$/, '') || 
                messages[0]?.content.slice(0, 50) || 
                'Conversazione'

  return [{
    id: crypto.randomUUID(),
    title,
    source: 'chatgpt',
    messages,
  }]
}

/**
 * Parser per Gemini (Markdown) - simile a ChatGPT
 */
function parseGeminiMarkdown(content: string, filename: string): ParsedConversation[] {
  const conversations = parseChatGPTMarkdown(content, filename)
  return conversations.map(c => ({ ...c, source: 'gemini' as const }))
}

/**
 * Parser per Deepseek (Markdown) - simile a ChatGPT
 */
function parseDeepseekMarkdown(content: string, filename: string): ParsedConversation[] {
  const conversations = parseChatGPTMarkdown(content, filename)
  return conversations.map(c => ({ ...c, source: 'deepseek' as const }))
}

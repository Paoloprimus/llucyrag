import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Types
export interface User {
  id: string
  email: string
  name: string | null
  has_rag: boolean
  created_at: string
}

export interface ChatMessage {
  id: string
  user_id: string
  session_id: string | null
  role: 'user' | 'assistant'
  content: string
  topic: string | null
  created_at: string
}

export interface ChatChunk {
  id: string
  user_id: string
  content: string
  embedding: number[]
  source: string
  title: string
  conversation_id: string
  created_at: string
}

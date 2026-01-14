'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase-client'
import { ChatMessage } from '@/components/ChatMessage'
import { ChatInput } from '@/components/ChatInput'
import type { User } from '@supabase/supabase-js'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp?: number
}

const STORAGE_KEY = 'llucy-chat-messages'
const THEME_KEY = 'llucy-theme'

export default function ChatPage() {
  const [user, setUser] = useState<User | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [loginSent, setLoginSent] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const sessionIdRef = useRef<string>(crypto.randomUUID())

  // Load theme from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem(THEME_KEY) as 'light' | 'dark' | 'system' | null
    if (savedTheme) {
      setTheme(savedTheme)
      applyTheme(savedTheme)
    }
  }, [])

  // Load messages from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        // Only load messages from last 24 hours
        const recent = parsed.filter((m: Message) => 
          m.timestamp && Date.now() - m.timestamp < 24 * 60 * 60 * 1000
        )
        if (recent.length > 0) {
          setMessages(recent)
        }
      } catch (e) {
        console.error('Error loading messages:', e)
      }
    }
  }, [])

  // Save messages to localStorage when they change
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages))
    }
  }, [messages])

  // Check auth
  useEffect(() => {
    const supabase = createClient()
    
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setAuthLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Save messages to database for RAG
  const saveToDatabase = useCallback(async (newMessages: Message[], userId: string) => {
    try {
      const response = await fetch('/api/save-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          userId,
          sessionId: sessionIdRef.current,
        }),
      })
      if (!response.ok) {
        console.error('Failed to save chat')
      }
    } catch (e) {
      console.error('Error saving chat:', e)
    }
  }, [])

  const applyTheme = (newTheme: 'light' | 'dark' | 'system') => {
    if (newTheme === 'system') {
      document.documentElement.removeAttribute('data-theme')
    } else {
      document.documentElement.setAttribute('data-theme', newTheme)
    }
  }

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light'
    setTheme(next)
    localStorage.setItem(THEME_KEY, next)
    applyTheme(next)
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError('')
    
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: 'https://llucy.it/auth/callback',
      },
    })

    if (error) {
      setLoginError(error.message)
    } else {
      setLoginSent(true)
    }
  }

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: content.trim(),
      timestamp: Date.now(),
    }

    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    setIsLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: content,
          history: messages.slice(-10),
          userId: user?.id,
        }),
      })

      const data = await response.json()

      if (data.error) {
        throw new Error(data.error)
      }

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.response,
        timestamp: Date.now(),
      }

      const finalMessages = [...updatedMessages, assistantMessage]
      setMessages(finalMessages)

      // Auto-save to database for RAG (last 2 messages)
      if (user?.id) {
        saveToDatabase([userMessage, assistantMessage], user.id)
      }

    } catch (error) {
      console.error('Error:', error)
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Mi dispiace, qualcosa è andato storto. Riprova.',
        timestamp: Date.now(),
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const clearChat = () => {
    setMessages([])
    localStorage.removeItem(STORAGE_KEY)
    sessionIdRef.current = crypto.randomUUID()
  }

  // Still loading auth
  if (authLoading) {
    return (
      <main className="h-screen flex items-center justify-center">
        <p className="text-[var(--text-muted)]">...</p>
      </main>
    )
  }

  // Not logged in - show login form
  if (!user) {
    return (
      <main className="h-screen flex flex-col items-center justify-center px-4">
        <p className="text-lg text-[var(--text-muted)] mb-8">Ciao. Sono llucy.</p>
        
        {loginSent ? (
          <p className="text-[var(--text-muted)]">Controlla la tua email per il link di accesso.</p>
        ) : (
          <form onSubmit={handleLogin} className="w-full max-w-xs space-y-4">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="la-tua@email.com"
              className="w-full px-4 py-3 rounded-lg border border-[var(--border)] 
                         bg-[var(--bg)] text-[var(--text)] placeholder:text-[var(--text-muted)]
                         focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              required
            />
            {loginError && (
              <p className="text-red-500 text-sm">{loginError}</p>
            )}
            <button
              type="submit"
              className="w-full px-6 py-3 bg-[var(--accent)] text-[var(--bg)] rounded-lg 
                         text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Invia link magico
            </button>
          </form>
        )}
        
        <a
          href="https://settings.llucy.it"
          className="mt-8 text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
        >
          Impostazioni e memoria
        </a>
      </main>
    )
  }

  return (
    <main className="h-screen flex flex-col">
      {/* Header */}
      <div className="absolute top-4 right-4 flex items-center gap-3">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
          title={`Tema: ${theme === 'light' ? 'chiaro' : theme === 'dark' ? 'scuro' : 'sistema'}`}
        >
          {theme === 'light' ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ) : theme === 'dark' ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          )}
        </button>

        {/* Clear chat */}
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
            title="Nuova conversazione"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M12 4v16m8-8H4" />
            </svg>
          </button>
        )}

        {/* Settings */}
        <a
          href="https://settings.llucy.it"
          className="text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
          title="Impostazioni"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </a>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {messages.length === 0 && (
            <div className="h-full flex items-center justify-center text-[var(--text-muted)] text-center">
              <p className="text-lg">Ciao. Sono qui.</p>
            </div>
          )}
          
          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="text-[var(--text-muted)] italic">...</div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-[var(--border)] bg-[var(--bg)]">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <ChatInput onSend={sendMessage} disabled={isLoading} />
        </div>
      </div>
    </main>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'

const REMEMBERED_EMAIL_KEY = 'llucy-remembered-email'

export function LoginForm() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [isReturningUser, setIsReturningUser] = useState(false)

  // Load remembered email on mount
  useEffect(() => {
    const savedEmail = localStorage.getItem(REMEMBERED_EMAIL_KEY)
    if (savedEmail) {
      setEmail(savedEmail)
      setIsReturningUser(true)
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email.trim()) return
    
    setStatus('loading')
    setErrorMessage('')

    const supabase = createClient()

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setStatus('error')
      setErrorMessage(error.message)
    } else {
      // Remember email for next time
      localStorage.setItem(REMEMBERED_EMAIL_KEY, email.trim())
      setStatus('sent')
    }
  }

  const handleChangeEmail = () => {
    setEmail('')
    setIsReturningUser(false)
    localStorage.removeItem(REMEMBERED_EMAIL_KEY)
  }

  return (
    <div className="max-w-md mx-auto mt-20">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-semibold mb-2">LLucy</h1>
        <p className="text-[var(--text-muted)]">
          {isReturningUser ? 'Bentornato!' : 'Accedi per gestire il tuo account'}
        </p>
      </div>

      {status === 'sent' ? (
        <div className="card text-center">
          <div className="text-4xl mb-4">📬</div>
          <h2 className="text-lg font-medium mb-2">Controlla la tua email</h2>
          <p className="text-[var(--text-muted)]">
            Abbiamo inviato un link magico a<br />
            <strong className="text-[var(--text)]">{email}</strong>
          </p>
          <button
            onClick={() => setStatus('idle')}
            className="mt-6 text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            Usa un&apos;altra email
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="card">
          {isReturningUser ? (
            // Returning user - show email with option to change
            <div className="mb-4">
              <p className="text-sm text-[var(--text-muted)] mb-2">Accedi come:</p>
              <div className="flex items-center justify-between p-3 bg-[var(--bg-secondary)] rounded-lg">
                <span className="font-medium">{email}</span>
                <button
                  type="button"
                  onClick={handleChangeEmail}
                  className="text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
                >
                  Cambia
                </button>
              </div>
            </div>
          ) : (
            // New user - show email input
            <>
              <label className="block mb-2 text-sm font-medium">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="la-tua@email.com"
                className="input mb-4"
                disabled={status === 'loading'}
                autoFocus
              />
            </>
          )}

          {status === 'error' && (
            <p className="text-sm text-[var(--error)] mb-4">
              {errorMessage || 'Qualcosa è andato storto. Riprova.'}
            </p>
          )}

          <button
            type="submit"
            disabled={status === 'loading' || !email.trim()}
            className="btn btn-primary w-full"
          >
            {status === 'loading' ? 'Invio in corso...' : 'Invia link magico'}
          </button>

          <p className="mt-4 text-xs text-center text-[var(--text-muted)]">
            Riceverai un link per accedere senza password
          </p>
        </form>
      )}
    </div>
  )
}

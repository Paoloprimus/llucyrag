'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { useRouter } from 'next/navigation'

export default function AuthCallbackPage() {
  const [status, setStatus] = useState<'loading' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const router = useRouter()

  useEffect(() => {
    const handleAuth = async () => {
      const supabase = createClient()
      
      // Check for hash fragment (magic link flow)
      const hashParams = new URLSearchParams(window.location.hash.substring(1))
      const accessToken = hashParams.get('access_token')
      const refreshToken = hashParams.get('refresh_token')
      
      if (accessToken && refreshToken) {
        // Set session from hash tokens
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })
        
        if (error) {
          setStatus('error')
          setErrorMsg(error.message)
          return
        }
        
        // Clear hash from URL
        window.history.replaceState(null, '', window.location.pathname)
        router.push('/')
        return
      }
      
      // Check for code (PKCE flow)
      const urlParams = new URLSearchParams(window.location.search)
      const code = urlParams.get('code')
      
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        
        if (error) {
          setStatus('error')
          setErrorMsg(error.message)
          return
        }
        
        router.push('/')
        return
      }
      
      // Check for error
      const error = urlParams.get('error') || hashParams.get('error')
      const errorDescription = urlParams.get('error_description') || hashParams.get('error_description')
      
      if (error) {
        setStatus('error')
        setErrorMsg(errorDescription || error)
        return
      }
      
      // No auth params found - try to get existing session
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        router.push('/')
        return
      }
      
      setStatus('error')
      setErrorMsg('Nessun parametro di autenticazione trovato')
    }

    handleAuth()
  }, [router])

  if (status === 'loading') {
    return (
      <main className="h-screen flex items-center justify-center">
        <p className="text-[var(--text-muted)]">Autenticazione in corso...</p>
      </main>
    )
  }

  return (
    <main className="h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="text-red-500 mb-4">Errore di autenticazione</p>
        <p className="text-sm text-[var(--text-muted)] mb-4">{errorMsg}</p>
        <a href="/" className="text-sm underline">Torna al login</a>
      </div>
    </main>
  )
}

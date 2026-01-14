'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'
import { ChatUploader } from './ChatUploader'
import type { User } from '@supabase/supabase-js'

interface UserProfile {
  id: string
  email: string
  name: string | null
  has_rag: boolean
  tier: string
}

interface DashboardProps {
  user: User
}

export function Dashboard({ user }: DashboardProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'profile' | 'memory' | 'billing'>('profile')

  useEffect(() => {
    loadProfile()
  }, [user.id])

  const loadProfile = async () => {
    const supabase = createClient()
    
    // Try to get existing profile
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single()

    if (data) {
      setProfile(data)
      setName(data.name || '')
    } else {
      // Create profile if doesn't exist
      const newProfile: UserProfile = {
        id: user.id,
        email: user.email || '',
        name: null,
        has_rag: false,
        tier: 'free',
      }
      
      await supabase.from('users').insert(newProfile)
      setProfile(newProfile)
    }
  }

  const saveName = async () => {
    if (!name.trim()) return
    
    setSaving(true)
    const supabase = createClient()
    
    await supabase
      .from('users')
      .update({ name: name.trim() })
      .eq('id', user.id)

    setProfile(prev => prev ? { ...prev, name: name.trim() } : null)
    setSaving(false)
  }

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
  }

  const tabs = [
    { id: 'profile' as const, label: 'Profilo' },
    { id: 'memory' as const, label: 'Memoria' },
    { id: 'billing' as const, label: 'Piano' },
  ]

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold">
            Ciao{profile?.name ? `, ${profile.name}` : ''}
          </h1>
          <p className="text-sm text-[var(--text-muted)]">{user.email}</p>
        </div>
        <button
          onClick={handleLogout}
          className="text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
        >
          Esci
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 bg-[var(--bg-secondary)] rounded-lg">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-[var(--bg)] text-[var(--text)] shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="card">
          <h2 className="font-medium mb-4">Il tuo nome</h2>
          <p className="text-sm text-[var(--text-muted)] mb-4">
            Come vuoi che ti chiami LLucy?
          </p>
          <div className="flex gap-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Il tuo nome"
              className="input flex-1"
            />
            <button
              onClick={saveName}
              disabled={saving || !name.trim() || name === profile?.name}
              className="btn btn-primary"
            >
              {saving ? 'Salvo...' : 'Salva'}
            </button>
          </div>
        </div>
      )}

      {/* Memory Tab */}
      {activeTab === 'memory' && (
        <div className="space-y-6">
          <div className="card">
            <h2 className="font-medium mb-2">La tua memoria</h2>
            <p className="text-sm text-[var(--text-muted)] mb-4">
              Carica le tue conversazioni passate per dare a LLucy una memoria a lungo termine.
            </p>
            
            {profile?.has_rag ? (
              <div className="flex items-center gap-2 text-[var(--success)]">
                <span>✓</span>
                <span className="text-sm">Memoria attiva</span>
              </div>
            ) : (
              <div className="text-sm text-[var(--text-muted)]">
                Nessuna memoria caricata
              </div>
            )}
          </div>

          <ChatUploader 
            userId={user.id} 
            onComplete={() => {
              setProfile(prev => prev ? { ...prev, has_rag: true } : null)
            }}
          />
        </div>
      )}

      {/* Billing Tab */}
      {activeTab === 'billing' && (
        <div className="card">
          <h2 className="font-medium mb-2">Il tuo piano</h2>
          <div className="flex items-center gap-3 mb-4">
            <span className="px-3 py-1 bg-[var(--accent)] text-[var(--bg)] text-sm rounded-full">
              {profile?.tier === 'beta' ? 'Beta Tester' : profile?.tier === 'pro' ? 'Pro' : 'Free'}
            </span>
          </div>
          
          {profile?.tier === 'beta' ? (
            <p className="text-sm text-[var(--text-muted)]">
              Hai accesso completo a tutte le funzionalità durante la fase beta.
            </p>
          ) : profile?.tier === 'free' ? (
            <div>
              <p className="text-sm text-[var(--text-muted)] mb-4">
                Passa a Pro per sbloccare la memoria a lungo termine.
              </p>
              <button className="btn btn-secondary" disabled>
                Coming soon
              </button>
            </div>
          ) : null}
        </div>
      )}

      {/* Back to chat link */}
      <div className="mt-8 text-center">
        <a
          href="https://llucy.it"
          className="text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
        >
          ← Torna alla chat
        </a>
      </div>
    </div>
  )
}

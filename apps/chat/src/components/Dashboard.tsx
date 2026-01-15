'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'
import { ChatUploader } from './ChatUploader'
import type { User } from '@supabase/supabase-js'

interface Modules {
  diario?: boolean
  obiettivi?: boolean
}

interface UserProfile {
  id: string
  email: string
  name: string | null
  modules: Modules
  tier: string
}

interface DashboardProps {
  user: User
  onBack: () => void
}

export function Dashboard({ user, onBack }: DashboardProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'profile' | 'modules' | 'billing'>('profile')

  useEffect(() => {
    loadProfile()
  }, [user.id])

  const loadProfile = async () => {
    const supabase = createClient()
    
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single()

    if (data) {
      const modules = data.modules || { diario: data.has_rag || false }
      setProfile({ ...data, modules })
      setName(data.name || '')
    } else {
      const newProfile: UserProfile = {
        id: user.id,
        email: user.email || '',
        name: null,
        modules: { diario: false, obiettivi: false },
        tier: 'beta',
      }
      
      await supabase.from('users').insert({
        ...newProfile,
        modules: newProfile.modules,
      })
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

  const toggleModule = async (moduleName: keyof Modules) => {
    if (!profile) return
    
    const newModules = {
      ...profile.modules,
      [moduleName]: !profile.modules[moduleName],
    }
    
    const supabase = createClient()
    await supabase
      .from('users')
      .update({ modules: newModules })
      .eq('id', user.id)

    setProfile(prev => prev ? { ...prev, modules: newModules } : null)
  }

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const tabs = [
    { id: 'profile' as const, label: 'Profilo' },
    { id: 'modules' as const, label: 'Moduli' },
    { id: 'billing' as const, label: 'Piano' },
  ]

  return (
    <div className="min-h-screen p-6 max-w-2xl mx-auto">
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
            Come vuoi che ti chiami llucy?
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

      {/* Modules Tab */}
      {activeTab === 'modules' && (
        <div className="space-y-6">
          {/* Diario Module */}
          <div className="card">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="font-medium">Diario</h2>
                <p className="text-sm text-[var(--text-muted)]">
                  Memoria delle tue conversazioni
                </p>
              </div>
              <button
                onClick={() => toggleModule('diario')}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  profile?.modules?.diario 
                    ? 'bg-[var(--accent)]' 
                    : 'bg-[var(--border)]'
                }`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                    profile?.modules?.diario ? 'left-7' : 'left-1'
                  }`}
                />
              </button>
            </div>
            
            {profile?.modules?.diario ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-green-600">
                  <span>✓</span>
                  <span className="text-sm">Modulo attivo</span>
                </div>
                
                <div className="pt-4 border-t border-[var(--border)]">
                  <h3 className="text-sm font-medium mb-2">Aggiungi memoria</h3>
                  <p className="text-sm text-[var(--text-muted)] mb-4">
                    Carica export di ChatGPT, Claude, Gemini o Deepseek
                  </p>
                  <ChatUploader 
                    userId={user.id}
                    userEmail={user.email || ''}
                    onComplete={() => {}}
                  />
                </div>
              </div>
            ) : (
              <p className="text-sm text-[var(--text-muted)]">
                Attiva per dare a llucy accesso alle tue conversazioni passate.
              </p>
            )}
          </div>

          {/* Obiettivi Module */}
          <div className="card">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="font-medium">Obiettivi</h2>
                <p className="text-sm text-[var(--text-muted)]">
                  Chiarisci cosa vuoi e perché
                </p>
              </div>
              <button
                onClick={() => toggleModule('obiettivi')}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  profile?.modules?.obiettivi 
                    ? 'bg-[var(--accent)]' 
                    : 'bg-[var(--border)]'
                }`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                    profile?.modules?.obiettivi ? 'left-7' : 'left-1'
                  }`}
                />
              </button>
            </div>
            
            {profile?.modules?.obiettivi ? (
              <div className="flex items-center gap-2 text-green-600">
                <span>✓</span>
                <span className="text-sm">Modulo attivo - parlane con llucy</span>
              </div>
            ) : (
              <p className="text-sm text-[var(--text-muted)]">
                Attiva per esplorare i tuoi obiettivi con llucy.
              </p>
            )}
          </div>

          {/* Future modules placeholder */}
          <div className="card opacity-50">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-medium">Agenda</h2>
                <p className="text-sm text-[var(--text-muted)]">
                  Organizza il tuo tempo
                </p>
              </div>
              <span className="text-xs text-[var(--text-muted)] bg-[var(--bg-secondary)] px-2 py-1 rounded">
                Prossimamente
              </span>
            </div>
          </div>
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
                Passa a Pro per sbloccare tutti i moduli.
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
        <button
          onClick={onBack}
          className="text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
        >
          ← Torna alla chat
        </button>
      </div>
    </div>
  )
}

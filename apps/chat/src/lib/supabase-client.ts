import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export function createClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        flowType: 'implicit',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'llucy-auth',
        storage: {
          getItem: (key: string) => {
            if (typeof document === 'undefined') return null
            // Try cookie first (shared across subdomains)
            const cookie = document.cookie
              .split('; ')
              .find(row => row.startsWith(`${key}=`))
              ?.split('=')[1]
            if (cookie) {
              try {
                return decodeURIComponent(cookie)
              } catch {
                return cookie
              }
            }
            // Fallback to localStorage
            return localStorage.getItem(key)
          },
          setItem: (key: string, value: string) => {
            if (typeof document === 'undefined') return
            // Save to cookie with .llucy.it domain (shared across subdomains)
            const encoded = encodeURIComponent(value)
            document.cookie = `${key}=${encoded}; path=/; domain=.llucy.it; max-age=31536000; samesite=lax; secure`
            // Also save to localStorage as backup
            localStorage.setItem(key, value)
          },
          removeItem: (key: string) => {
            if (typeof document === 'undefined') return
            // Remove cookie
            document.cookie = `${key}=; path=/; domain=.llucy.it; max-age=0`
            // Remove from localStorage
            localStorage.removeItem(key)
          },
        },
      },
    }
  )
}

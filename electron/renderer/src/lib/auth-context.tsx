// Auth flow (M1B): Electron sends a magic-link email via Supabase's native
// signInWithOtp (PKCE), the user clicks it in their mail client, Supabase
// redirects to the emailRedirectTo URL (closrm://auth-callback?code=...),
// the OS delivers that deep link back to this app, and the SDK exchanges
// the one-time code for a session. No JWT/refresh token ever travels in a
// URL, no new ClosRM backend endpoint, no change to the existing web
// email+password login.
//
// STOP note for review: this is a genuine auth UX change from the web's
// password login (see docs/architecture/ELECTRON_M1_IMPLEMENTATION.md,
// "Decisions requiring explicit sign-off") — confirmed with the user before
// implementing rather than assumed.
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { extractAuthCode } from './deep-link'

interface AuthContextValue {
  session: Session | null
  loading: boolean
  requestMagicLink: (email: string) => Promise<{ error: string | null }>
  loginWithPassword: (email: string, password: string) => Promise<{ error: string | null }>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

// Must match a Redirect URL allow-listed in Supabase Auth settings, and the
// scheme registered by the main process (app.setAsDefaultProtocolClient).
const DEEP_LINK_REDIRECT = 'closrm://auth-callback'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    const unsubscribeDeepLink = window.closrm.onDeepLink(async (url) => {
      const code = extractAuthCode(url)
      if (!code) return
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (error) {
        console.error('[auth] code exchange failed:', error.message)
      }
    })

    return () => {
      subscription.unsubscribe()
      unsubscribeDeepLink()
    }
  }, [])

  async function requestMagicLink(email: string): Promise<{ error: string | null }> {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false, // desktop app: sign-in only, account creation stays on closrm.fr
        emailRedirectTo: DEEP_LINK_REDIRECT,
      },
    })
    return { error: error?.message ?? null }
  }

  // Fallback path added during M3-A E2E validation: the magic-link flow above
  // hit Supabase's default email rate limit during testing. Password login
  // calls signInWithPassword() directly in the renderer — no system browser,
  // no deep link — the exact same call the ClosRM web app and mobile app
  // already make. Session storage (Keychain-backed, see secure-session-storage.ts)
  // and the API Bearer flow are identical either way; only how the session
  // is first obtained differs.
  async function loginWithPassword(email: string, password: string): Promise<{ error: string | null }> {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }

  async function logout() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, loading, requestMagicLink, loginWithPassword, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

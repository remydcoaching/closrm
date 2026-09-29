// Supabase client for the Electron renderer — same SDK and PKCE flow already
// used by the mobile app (see mobile/ in the main repo). No new backend
// mechanism: Supabase Auth issues the one-time authorization code natively,
// exchanged here via exchangeCodeForSession(). Session persistence is
// delegated to a custom storage adapter backed by Electron's safeStorage via
// the main process — never plain localStorage for the access/refresh token.
import { createClient } from '@supabase/supabase-js'
import { secureSessionStorage } from './secure-session-storage'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY must be set (see electron/.env.example)')
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    flowType: 'pkce',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storage: secureSessionStorage,
  },
})

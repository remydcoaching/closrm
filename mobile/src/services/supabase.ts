import 'react-native-url-polyfill/auto'
import * as SecureStore from 'expo-secure-store'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // Fail fast en dev pour éviter les bugs silencieux ; les valeurs viennent
  // du .env (gitignored), templated dans .env.example.
  throw new Error(
    'EXPO_PUBLIC_SUPABASE_URL ou EXPO_PUBLIC_SUPABASE_ANON_KEY manquant. Copier .env.example vers .env et remplir.',
  )
}

// SecureStore plafonne à 2KB par valeur. Le JWT Supabase + refresh token
// rentrent largement, donc pas de chunking nécessaire ici.
const secureStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: secureStorage,
    autoRefreshToken: true,
    persistSession: true,
    // detectSessionInUrl=false : on n'a pas de redirect URL côté mobile.
    detectSessionInUrl: false,
  },
})

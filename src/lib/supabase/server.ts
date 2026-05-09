import { createServerClient } from '@supabase/ssr'
import { cookies, headers } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  // Mobile envoie un Authorization: Bearer <jwt> (pas de cookies).
  // On forwarde ce header au client Supabase pour que les requêtes
  // (auth.getUser + RLS) soient bien attachées au user du JWT. Côté
  // web, ce header est absent → comportement inchangé (auth cookies).
  let authHeader: string | null = null
  try {
    const h = await headers()
    authHeader = h.get('authorization') ?? h.get('Authorization')
  } catch {
    // headers() peut throw hors d'un contexte request (build time).
    // Dans ce cas on tombe juste sur le flow cookies.
  }

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server component — lecture seule, ignoré
          }
        },
      },
      ...(authHeader && authHeader.startsWith('Bearer ')
        ? { global: { headers: { Authorization: authHeader } } }
        : {}),
    }
  )
}

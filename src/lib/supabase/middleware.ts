import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_ROUTES = ['/login', '/register', '/reset-password', '/auth/callback', '/api/webhooks', '/c', '/unsubscribe', '/booking', '/book', '/f', '/proto']

function isPublicRoute(pathname: string): boolean {
  if (pathname === '/') return true
  return PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + '/')
  )
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const pathname = request.nextUrl.pathname

  // Skip the expensive getUser() call for API routes — they handle their own
  // auth via getWorkspaceId(). The Supabase client above still processes cookies
  // for session token refresh, but we avoid the 200-500ms network round-trip.
  if (pathname.startsWith('/api/')) {
    return supabaseResponse
  }

  let user = null
  try {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch {
    // Si Supabase est down, laisser passer — le layout serveur fera un second check
  }

  if (!user && !isPublicRoute(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Routes "utilitaires" publiques qui doivent marcher même pour un user logué
  // (short links trackables, unsubscribe, widget de booking, page de gestion
  // RDV) — sinon le user est redirigé vers /dashboard au lieu d'atteindre la
  // vraie destination.
  const isUtilityPublicRoute =
    pathname.startsWith('/c/') ||
    pathname.startsWith('/unsubscribe') ||
    pathname.startsWith('/book/') ||
    pathname.startsWith('/booking/') ||
    pathname.startsWith('/f/')

  if (
    user &&
    isPublicRoute(pathname) &&
    pathname !== '/' &&
    !pathname.startsWith('/reset-password') &&
    !isUtilityPublicRoute
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // ─── Role gate : monteur ─────────────────────────────────────────────
  // Les monteurs n'ont accès qu'à /montage et /parametres/reglages (leur
  // profil). Tout le reste redirige.
  const MONTEUR_ALLOWED = ['/montage', '/parametres/reglages']
  const isMonteurAllowed = MONTEUR_ALLOWED.some(p => pathname === p || pathname.startsWith(p + '/'))
  if (user && !isPublicRoute(pathname) && !isMonteurAllowed) {
    const cachedRole = request.cookies.get('crm-role')?.value
    let role: string | null = cachedRole ?? null
    if (!role) {
      // Récupère TOUS les memberships actifs — un user peut avoir plusieurs
      // rows (auto-workspace + invitation par exemple). On considère qu'il
      // est monteur dès qu'il l'est dans au moins un workspace.
      const { data: members } = await supabase
        .from('workspace_members')
        .select('role')
        .eq('user_id', user.id)
        .eq('status', 'active')
      const memberList = members ?? []
      if (memberList.some((m: { role: string }) => m.role === 'monteur')) {
        role = 'monteur'
      } else if (memberList.length > 0) {
        role = memberList[0].role
      }
      if (role) supabaseResponse.cookies.set('crm-role', role, { maxAge: 60, httpOnly: true, sameSite: 'lax' })
    }
    if (role === 'monteur') {
      const url = request.nextUrl.clone()
      url.pathname = '/montage'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

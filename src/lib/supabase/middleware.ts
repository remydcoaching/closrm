import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_ROUTES = ['/login', '/register', '/reset-password', '/auth/callback', '/api/webhooks', '/c', '/unsubscribe', '/booking', '/book', '/f', '/proto']

function isPublicRoute(pathname: string): boolean {
  if (pathname === '/') return true
  return PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + '/')
  )
}

// ClosRM Desktop (Electron) is a non-web client that calls the API from a
// Vite dev-server origin (or file:// once packaged) instead of same-origin
// like the web app — so it needs explicit CORS headers the web has never
// required. The web app (same-origin, no Origin header on same-origin
// requests) and the mobile app (no browser, no Origin header at all) are
// both unaffected: this only ever adds headers when the request Origin
// matches this explicit allowlist, never a wildcard.
const ALLOWED_DESKTOP_ORIGINS = [
  'http://localhost:5173', // electron/ Vite dev server (see electron/vite.config.ts)
]

function corsHeadersFor(request: NextRequest): Record<string, string> | null {
  const origin = request.headers.get('origin')
  if (!origin || !ALLOWED_DESKTOP_ORIGINS.includes(origin)) return null
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
  }
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
    const cors = corsHeadersFor(request)

    // Preflight: the browser never sends Authorization on this request, so
    // getWorkspaceId() further down would always 401 it — answer here
    // instead of letting it reach the route at all.
    if (request.method === 'OPTIONS' && cors) {
      return new NextResponse(null, { status: 204, headers: cors })
    }

    if (cors) {
      for (const [key, value] of Object.entries(cors)) {
        supabaseResponse.headers.set(key, value)
      }
    }
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
    pathname.startsWith('/f/') ||
    pathname.startsWith('/proto')

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

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_ROUTES = ['/login', '/register', '/reset-password', '/auth/callback', '/api/webhooks', '/c', '/unsubscribe', '/booking', '/book']

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
    pathname.startsWith('/booking/')

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

  return supabaseResponse
}

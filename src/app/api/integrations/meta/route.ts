import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { randomBytes } from 'crypto'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { buildOAuthUrl } from '@/lib/meta/client'
import { integrationsUrl, META_REDIRECT_COOKIE, metaCallbackUrl, resolveAppOrigin } from '@/lib/meta/oauth-origin'

export async function GET(request: NextRequest) {
  // Return to the address the coach is on (closrm.fr, closrm.vercel.app…):
  // their session cookie only exists there.
  const origin = resolveAppOrigin(request.nextUrl.origin)
  try {
    await getWorkspaceId() // Verifies user is authenticated

    const state = randomBytes(16).toString('hex')
    const redirectUri = metaCallbackUrl(origin)
    const cookieStore = await cookies()
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 600, // 10 minutes
      path: '/',
    }
    cookieStore.set('meta_oauth_state', state, cookieOptions)
    cookieStore.set(META_REDIRECT_COOKIE, redirectUri, cookieOptions)

    return NextResponse.redirect(buildOAuthUrl(state, redirectUri))
  } catch {
    return NextResponse.redirect(`${integrationsUrl(origin)}?error=auth_required`)
  }
}

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { randomBytes } from 'crypto'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { buildOAuthUrl } from '@/lib/meta/client'

export async function GET() {
  try {
    await getWorkspaceId() // Verifies user is authenticated

    const state = randomBytes(16).toString('hex')
    const cookieStore = await cookies()

    cookieStore.set('meta_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/',
    })

    return NextResponse.redirect(buildOAuthUrl(state))
  } catch {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/parametres/integrations?error=auth_required`
    )
  }
}

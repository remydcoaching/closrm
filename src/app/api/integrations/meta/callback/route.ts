import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { createClient } from '@/lib/supabase/server'
import { encrypt } from '@/lib/meta/encryption'
import {
  exchangeCodeForToken,
  getLongLivedToken,
  getPages,
  subscribePageToLeadgen,
  type MetaCredentials,
} from '@/lib/meta/client'

const REDIRECT_BASE = `${process.env.NEXT_PUBLIC_APP_URL}/parametres/integrations`

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const errorParam = searchParams.get('error')

  // User denied access on Meta
  if (errorParam) {
    return NextResponse.redirect(`${REDIRECT_BASE}?error=meta_denied`)
  }

  if (!code || !state) {
    return NextResponse.redirect(`${REDIRECT_BASE}?error=invalid_callback`)
  }

  // CSRF check
  const cookieStore = await cookies()
  const storedState = cookieStore.get('meta_oauth_state')?.value
  cookieStore.delete('meta_oauth_state')

  if (!storedState || storedState !== state) {
    return NextResponse.redirect(`${REDIRECT_BASE}?error=invalid_state`)
  }

  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    // 1. Exchange code for short-lived token
    const shortToken = await exchangeCodeForToken(code)

    // 2. Get pages with short-lived token (before long-lived exchange)
    const pages = await getPages(shortToken)
    if (pages.length === 0) {
      return NextResponse.redirect(`${REDIRECT_BASE}?error=no_pages`)
    }

    // 3. Convert to long-lived token (60 days)
    const { access_token: longToken, expires_at } = await getLongLivedToken(shortToken)

    // Take first page (V1: one page per workspace)
    const page = pages[0]

    // 4. Subscribe page to leadgen webhook events
    await subscribePageToLeadgen(page.id, page.access_token)

    // 5. Encrypt and store credentials
    const credentials: MetaCredentials = {
      user_access_token: longToken,
      token_expires_at: expires_at,
      page_id: page.id,
      page_name: page.name,
      page_access_token: page.access_token,
    }
    const encrypted = encrypt(JSON.stringify(credentials))

    const { error } = await supabase
      .from('integrations')
      .upsert(
        {
          workspace_id: workspaceId,
          type: 'meta',
          credentials_encrypted: encrypted,
          meta_page_id: page.id,
          connected_at: new Date().toISOString(),
          is_active: true,
        },
        { onConflict: 'workspace_id,type' }
      )

    if (error) {
      console.error('Supabase upsert error:', error)
      return NextResponse.redirect(`${REDIRECT_BASE}?error=db_error`)
    }

    return NextResponse.redirect(`${REDIRECT_BASE}?success=meta_connected`)
  } catch (err) {
    console.error('Meta OAuth callback error:', err)
    return NextResponse.redirect(`${REDIRECT_BASE}?error=oauth_failed`)
  }
}

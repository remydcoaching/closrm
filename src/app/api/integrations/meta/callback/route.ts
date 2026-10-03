import { NextRequest, NextResponse, after } from 'next/server'
import { cookies } from 'next/headers'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { createClient } from '@/lib/supabase/server'
import { encrypt } from '@/lib/meta/encryption'
import {
  exchangeCodeForToken,
  getLongLivedToken,
  getPages,
  getAdAccounts,
  subscribePageToLeadgen,
  type MetaCredentials,
} from '@/lib/meta/client'
import { integrationsUrl, META_REDIRECT_COOKIE, metaCallbackUrl, resolveAppOrigin } from '@/lib/meta/oauth-origin'
import { linkInstagramAccount } from '@/lib/instagram/link-account'
import { createServiceClient } from '@/lib/supabase/service'
import { syncAll } from '@/lib/instagram/sync'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  // The redirect_uri used to open the login (same origin as this request);
  // the code exchange must send exactly the same value.
  const cookieStore = await cookies()
  const storedRedirect = cookieStore.get(META_REDIRECT_COOKIE)?.value
  cookieStore.delete(META_REDIRECT_COOKIE)
  const origin = resolveAppOrigin(storedRedirect ?? request.nextUrl.origin)
  const redirectUri = metaCallbackUrl(origin)
  const REDIRECT_BASE = integrationsUrl(origin)
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
  const storedState = cookieStore.get('meta_oauth_state')?.value
  cookieStore.delete('meta_oauth_state')

  if (!storedState || storedState !== state) {
    return NextResponse.redirect(`${REDIRECT_BASE}?error=invalid_state`)
  }

  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    // 1. Exchange code for short-lived token
    const shortToken = await exchangeCodeForToken(code, redirectUri)

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

    // 5. Fetch ad accounts (for Marketing API — T-017)
    let adAccountId: string | undefined
    try {
      const adAccounts = await getAdAccounts(longToken)
      console.log('[Meta OAuth] Ad accounts found:', adAccounts.length, JSON.stringify(adAccounts.map(a => ({ id: a.id, name: a.name, status: a.account_status }))))
      if (adAccounts.length > 0) {
        // V1: auto-select first active account, or first overall
        const active = adAccounts.find(a => a.account_status === 1)
        adAccountId = (active ?? adAccounts[0]).id
        console.log('[Meta OAuth] Selected ad account:', adAccountId)
      } else {
        console.warn('[Meta OAuth] No ad accounts returned — ads features will not work')
      }
    } catch (e) {
      // Non-blocking: ads features won't work but leads webhook still will
      console.error('[Meta OAuth] Failed to fetch ad accounts:', e)
    }

    // 6. Encrypt and store credentials
    const credentials: MetaCredentials = {
      user_access_token: longToken,
      token_expires_at: expires_at,
      page_id: page.id,
      page_name: page.name,
      page_access_token: page.access_token,
      ad_account_id: adAccountId,
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

    // Fresh tokens for every Instagram feature (ig_accounts), then a first
    // sync right away so profile, posts and DMs show without waiting for the
    // nightly cron. A failure here doesn't undo the Meta connection.
    // Writes the Meta tokens with the service role (members can't read them, migration 126), scoped by workspace.
    const linked = await linkInstagramAccount(createServiceClient(), workspaceId, {
      userAccessToken: longToken,
      tokenExpiresAt: expires_at,
      pageId: page.id,
      fallbackPageAccessToken: page.access_token,
    }).catch((e: unknown) => ({ ok: false as const, status: 500, error: e instanceof Error ? e.message : String(e) }))
    if (!linked.ok) {
      console.error('[Meta OAuth] Instagram account not linked:', linked.error)
      return NextResponse.redirect(`${REDIRECT_BASE}?success=meta_connected&warning=instagram_not_linked`)
    }
    const ig = linked.data as { ig_user_id: string; page_access_token: string | null }
    after(async () => {
      try {
        await syncAll({
          supabase: createServiceClient(),
          workspaceId,
          accessToken: longToken,
          igUserId: ig.ig_user_id,
          pageId: page.id,
          pageAccessToken: ig.page_access_token ?? page.access_token,
        })
      } catch (e) {
        console.error('[Meta OAuth] first sync failed:', e instanceof Error ? e.message : e)
      }
    })

    return NextResponse.redirect(`${REDIRECT_BASE}?success=meta_connected`)
  } catch (err) {
    console.error('Meta OAuth callback error:', err)
    return NextResponse.redirect(`${REDIRECT_BASE}?error=oauth_failed`)
  }
}

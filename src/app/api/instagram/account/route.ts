import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { IG_ACCOUNT_PUBLIC_COLS, linkInstagramAccount } from '@/lib/instagram/link-account'

export async function GET() {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('ig_accounts')
      .select(IG_ACCOUNT_PUBLIC_COLS)
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    // Get Meta integration credentials
    const { data: integration } = await supabase
      .from('integrations')
      .select('credentials_encrypted, meta_page_id')
      .eq('workspace_id', workspaceId)
      .eq('type', 'meta')
      .eq('is_active', true)
      .single()

    if (!integration?.credentials_encrypted) {
      return NextResponse.json(
        { error: 'Intégration Meta non connectée. Allez dans Paramètres > Intégrations.' },
        { status: 400 }
      )
    }

    const { decrypt } = await import('@/lib/crypto')
    const creds = JSON.parse(decrypt(integration.credentials_encrypted))
    if (!creds.user_access_token) {
      return NextResponse.json(
        { error: 'Jeton utilisateur absent. Reconnectez Meta dans Paramètres > Intégrations.' },
        { status: 400 }
      )
    }
    const pageId = integration.meta_page_id ?? creds.page_id
    if (!pageId) {
      return NextResponse.json({ error: 'Aucune Page Facebook liée. Reconnectez Meta.' }, { status: 400 })
    }

    // Starting figures sent by the setup form; absent ones keep the stored baseline.
    const body = await request.json().catch(() => ({}))
    const requested = Object.fromEntries(
      (['starting_followers', 'starting_date', 'starting_monthly_views', 'starting_engagement', 'starting_best_reel'] as const)
        .filter((k) => body[k] !== undefined && body[k] !== null)
        .map((k) => [k, body[k]]),
    )
    const result = await linkInstagramAccount(
      supabase,
      workspaceId,
      {
        userAccessToken: creds.user_access_token,
        tokenExpiresAt: creds.token_expires_at ?? null,
        pageId,
        fallbackPageAccessToken: creds.page_access_token ?? null,
      },
      requested,
    )
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json({ data: result.data }, { status: 201 })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    const errMsg = err instanceof Error ? err.message : String(err)
    console.error('[API /instagram/account] Error:', errMsg)
    return NextResponse.json({ error: errMsg }, { status: 500 })
  }
}

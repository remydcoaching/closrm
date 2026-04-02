import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'

export async function GET() {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('ig_accounts')
      .select('*')
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

    // Decrypt credentials
    const { decrypt } = await import('@/lib/crypto')
    const creds = JSON.parse(decrypt(integration.credentials_encrypted))
    const accessToken = creds.user_access_token || creds.page_access_token
    const pageId = integration.meta_page_id ?? creds.page_id

    if (!pageId) {
      return NextResponse.json({ error: 'Aucune Page Facebook liée. Reconnectez Meta.' }, { status: 400 })
    }

    // Step 1: Get Instagram Business Account linked to the Facebook Page
    const pageRes = await fetch(
      `https://graph.facebook.com/v25.0/${pageId}?fields=instagram_business_account&access_token=${accessToken}`
    )
    if (!pageRes.ok) {
      const err = await pageRes.json()
      console.error('[API /instagram/account] Page fetch error:', err)
      return NextResponse.json({ error: 'Impossible de récupérer le compte Instagram lié à la Page' }, { status: 400 })
    }
    const pageData = await pageRes.json()
    const igAccountId = pageData.instagram_business_account?.id

    if (!igAccountId) {
      return NextResponse.json(
        { error: 'Aucun compte Instagram Business lié à votre Page Facebook. Liez votre compte Instagram à votre Page dans les paramètres Facebook.' },
        { status: 400 }
      )
    }

    // Step 2: Get Instagram profile info via Facebook Graph API
    const profileRes = await fetch(
      `https://graph.facebook.com/v25.0/${igAccountId}?fields=username,name,followers_count,follows_count,media_count,profile_picture_url&access_token=${accessToken}`
    )
    if (!profileRes.ok) {
      const err = await profileRes.json()
      console.error('[API /instagram/account] Profile fetch error:', err)
      return NextResponse.json({ error: 'Impossible de récupérer le profil Instagram' }, { status: 400 })
    }
    const profile = await profileRes.json()

    // Upsert ig_account
    const body = await request.json().catch(() => ({}))
    const { data, error } = await supabase
      .from('ig_accounts')
      .upsert({
        workspace_id: workspaceId,
        ig_user_id: igAccountId,
        ig_username: profile.username ?? profile.name ?? null,
        access_token: accessToken,
        token_expires_at: creds.token_expires_at ?? null,
        page_id: pageId,
        page_access_token: creds.page_access_token ?? null,
        is_connected: true,
        starting_followers: body.starting_followers ?? profile.followers_count ?? 0,
        starting_date: body.starting_date ?? new Date().toISOString().slice(0, 10),
        starting_monthly_views: body.starting_monthly_views ?? 0,
        starting_engagement: body.starting_engagement ?? 0,
        starting_best_reel: body.starting_best_reel ?? 0,
      }, { onConflict: 'workspace_id' })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    console.error('[API /instagram/account] Error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { encrypt } from '@/lib/crypto'
import { syncYoutubeAccount } from '@/lib/youtube/sync'

export const maxDuration = 60

export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const redirectBase = `${appUrl}/parametres/integrations`

  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state') // workspaceId
    const error = searchParams.get('error')

    if (error) return NextResponse.redirect(`${redirectBase}?error=${encodeURIComponent(error)}`)
    if (!code || !state) {
      return NextResponse.redirect(`${redirectBase}?error=${encodeURIComponent('Paramètres OAuth manquants')}`)
    }

    const clientId = process.env.YOUTUBE_CLIENT_ID ?? process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.YOUTUBE_CLIENT_SECRET ?? process.env.GOOGLE_CLIENT_SECRET
    if (!clientId || !clientSecret) {
      return NextResponse.redirect(`${redirectBase}?error=${encodeURIComponent('Credentials Google manquantes')}`)
    }
    const redirectUri = `${appUrl}/api/integrations/youtube/callback`

    // Exchange code
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })
    if (!tokenRes.ok) {
      console.error('[YouTube OAuth] token exchange failed:', await tokenRes.text())
      return NextResponse.redirect(`${redirectBase}?error=${encodeURIComponent('Échec échange tokens')}`)
    }
    const { access_token, refresh_token, expires_in } = await tokenRes.json()
    if (!access_token) {
      return NextResponse.redirect(`${redirectBase}?error=${encodeURIComponent('Token d\'accès manquant')}`)
    }
    const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString()

    const credsEncrypted = encrypt(JSON.stringify({ access_token, refresh_token, expires_at: expiresAt }))
    const supabase = createServiceClient()

    const { data: existing } = await supabase
      .from('integrations')
      .select('id')
      .eq('workspace_id', state)
      .eq('type', 'youtube')
      .maybeSingle()

    if (existing) {
      await supabase
        .from('integrations')
        .update({
          credentials_encrypted: credsEncrypted,
          is_active: true,
          connected_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
    } else {
      await supabase.from('integrations').insert({
        workspace_id: state,
        type: 'youtube',
        credentials_encrypted: credsEncrypted,
        is_active: true,
        connected_at: new Date().toISOString(),
      })
    }

    // Premier sync en fire-and-forget : 200+ vidéos × 2 calls Analytics ferait
    // timeout le callback (Vercel max 60s). On ne bloque pas le redirect — le
    // sync tourne en background et le cron quotidien rattrape le reste.
    void syncYoutubeAccount(state, access_token).catch((e) => {
      console.error('[YouTube OAuth] first sync failed:', e)
    })

    return NextResponse.redirect(`${redirectBase}?success=${encodeURIComponent('YouTube connecté')}`)
  } catch (err) {
    console.error('[YouTube OAuth] callback error:', err)
    return NextResponse.redirect(`${redirectBase}?error=${encodeURIComponent('Erreur inattendue')}`)
  }
}

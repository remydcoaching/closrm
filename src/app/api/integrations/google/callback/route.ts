import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { encrypt } from '@/lib/crypto'

const COLORS = ['#4285F4', '#34A853', '#EA4335', '#FBBC04', '#8E24AA', '#00ACC1', '#FF7043']

export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const redirectBase = `${appUrl}/parametres/integrations`

  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state') // workspaceId
    const error = searchParams.get('error')

    if (error) {
      return NextResponse.redirect(
        `${redirectBase}?error=${encodeURIComponent(error)}`
      )
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `${redirectBase}?error=${encodeURIComponent('Paramètres manquants')}`
      )
    }

    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET
    if (!clientId || !clientSecret) {
      return NextResponse.redirect(
        `${redirectBase}?error=${encodeURIComponent('Configuration Google manquante')}`
      )
    }

    const redirectUri = `${appUrl}/api/integrations/google/callback`

    // Exchange authorization code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
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

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text()
      console.error('Google token exchange failed:', errorData)
      return NextResponse.redirect(
        `${redirectBase}?error=${encodeURIComponent('Échec de l\'échange de tokens Google')}`
      )
    }

    const tokens = await tokenResponse.json()
    const { access_token, refresh_token, expires_in } = tokens

    if (!access_token) {
      return NextResponse.redirect(
        `${redirectBase}?error=${encodeURIComponent('Token d\'accès manquant')}`
      )
    }

    // Fetch the Google account email
    const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    })
    let email = 'unknown@gmail.com'
    if (userinfoRes.ok) {
      const userinfo = await userinfoRes.json()
      email = userinfo.email || email
    }

    const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString()

    const credentialsEncrypted = encrypt(
      JSON.stringify({
        access_token,
        refresh_token,
        expires_at: expiresAt,
      })
    )

    const supabase = createServiceClient()

    // Count existing accounts to pick a color
    const { count } = await supabase
      .from('google_calendar_accounts')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', state)

    const colorIndex = (count ?? 0) % COLORS.length

    // Upsert into google_calendar_accounts (on conflict email per workspace)
    const { error: upsertError } = await supabase
      .from('google_calendar_accounts')
      .upsert(
        {
          workspace_id: state,
          email,
          label: email.split('@')[0],
          color: COLORS[colorIndex],
          credentials_encrypted: credentialsEncrypted,
          is_active: true,
          connected_at: new Date().toISOString(),
        },
        { onConflict: 'workspace_id,email' }
      )

    if (upsertError) {
      console.error('Failed to save Google account:', upsertError)
      return NextResponse.redirect(
        `${redirectBase}?error=${encodeURIComponent('Erreur lors de la sauvegarde')}`
      )
    }

    // Also keep the legacy integrations row for backward compat
    const { data: existing } = await supabase
      .from('integrations')
      .select('id')
      .eq('workspace_id', state)
      .eq('type', 'google_calendar')
      .maybeSingle()

    if (existing) {
      await supabase
        .from('integrations')
        .update({
          credentials_encrypted: credentialsEncrypted,
          is_active: true,
          connected_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
    } else {
      await supabase
        .from('integrations')
        .insert({
          workspace_id: state,
          type: 'google_calendar',
          credentials_encrypted: credentialsEncrypted,
          is_active: true,
          connected_at: new Date().toISOString(),
        })
    }

    return NextResponse.redirect(
      `${redirectBase}?success=${encodeURIComponent('Google Agenda connecté avec succès')}`
    )
  } catch (err) {
    console.error('Google OAuth callback error:', err)
    return NextResponse.redirect(
      `${redirectBase}?error=${encodeURIComponent('Erreur inattendue')}`
    )
  }
}

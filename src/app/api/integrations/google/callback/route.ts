import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { encrypt } from '@/lib/crypto'

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

    // Calculate expiry timestamp
    const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString()

    // Encrypt credentials
    const credentialsEncrypted = encrypt(
      JSON.stringify({
        access_token,
        refresh_token,
        expires_at: expiresAt,
      })
    )

    // Upsert into integrations table using service client (no user session in OAuth callback)
    const supabase = createServiceClient()

    // Try update first, then insert if not exists
    const { data: existing } = await supabase
      .from('integrations')
      .select('id')
      .eq('workspace_id', state)
      .eq('type', 'google_calendar')
      .maybeSingle()

    let upsertError
    if (existing) {
      const { error } = await supabase
        .from('integrations')
        .update({
          credentials_encrypted: credentialsEncrypted,
          is_active: true,
          connected_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
      upsertError = error
    } else {
      const { error } = await supabase
        .from('integrations')
        .insert({
          workspace_id: state,
          type: 'google_calendar',
          credentials_encrypted: credentialsEncrypted,
          is_active: true,
          connected_at: new Date().toISOString(),
        })
      upsertError = error
    }

    if (upsertError) {
      console.error('Failed to save Google credentials:', upsertError)
      return NextResponse.redirect(
        `${redirectBase}?error=${encodeURIComponent('Erreur lors de la sauvegarde')}`
      )
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

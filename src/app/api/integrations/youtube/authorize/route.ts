import { NextResponse } from 'next/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'

const SCOPES = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube',
  'https://www.googleapis.com/auth/yt-analytics.readonly',
  'https://www.googleapis.com/auth/yt-analytics-monetary.readonly',
]

export async function GET() {
  try {
    const { workspaceId } = await getWorkspaceId()
    const clientId = process.env.YOUTUBE_CLIENT_ID ?? process.env.GOOGLE_CLIENT_ID
    if (!clientId) return NextResponse.json({ error: 'YOUTUBE_CLIENT_ID not configured' }, { status: 500 })

    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/youtube/callback`
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: SCOPES.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state: workspaceId,
      include_granted_scopes: 'true',
    })
    return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`)
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/login`)
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

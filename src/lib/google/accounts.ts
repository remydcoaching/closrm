import { createServiceClient } from '@/lib/supabase/service'
import { decrypt, encrypt } from '@/lib/crypto'
import type { GoogleCalendarAccount } from '@/types'

export async function getGoogleAccounts(workspaceId: string): Promise<GoogleCalendarAccount[]> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('google_calendar_accounts')
    .select('id, workspace_id, email, label, color, is_active, connected_at, created_at')
    .eq('workspace_id', workspaceId)
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  return (data ?? []) as GoogleCalendarAccount[]
}

export async function getGoogleAccountCredentials(
  accountId: string
): Promise<{ access_token: string; refresh_token: string; expires_at: string } | null> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('google_calendar_accounts')
    .select('credentials_encrypted, is_active')
    .eq('id', accountId)
    .single()

  if (!data || !data.is_active || !data.credentials_encrypted) return null

  try {
    return JSON.parse(decrypt(data.credentials_encrypted))
  } catch {
    return null
  }
}

export async function getValidAccessTokenForAccount(accountId: string): Promise<string | null> {
  const creds = await getGoogleAccountCredentials(accountId)
  if (!creds) return null

  const { access_token, refresh_token, expires_at } = creds

  if (new Date(expires_at) > new Date(Date.now() + 60_000)) {
    return access_token
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret || !refresh_token) return null

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token,
    }),
  })

  if (!res.ok) {
    console.error('[Google Account] Token refresh failed for account', accountId, await res.text())
    return null
  }

  const data = await res.json()

  const supabase = createServiceClient()
  const newCreds = {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? refresh_token,
    expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
  }

  await supabase
    .from('google_calendar_accounts')
    .update({ credentials_encrypted: encrypt(JSON.stringify(newCreds)) })
    .eq('id', accountId)

  return data.access_token
}

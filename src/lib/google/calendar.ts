import { getIntegrationCredentials } from '@/lib/integrations/get-credentials'
import { createServiceClient } from '@/lib/supabase/service'
import { encrypt } from '@/lib/crypto'
import { getValidAccessTokenForAccount } from './accounts'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GoogleCalendarEvent {
  id: string
  summary?: string
  description?: string
  start: { dateTime?: string; date?: string }
  end: { dateTime?: string; date?: string }
  status?: string
  hangoutLink?: string
  conferenceData?: {
    entryPoints?: Array<{ uri?: string; entryPointType?: string }>
  }
}

interface CreateEventPayload {
  summary: string
  description?: string
  start: { dateTime: string; timeZone?: string }
  end: { dateTime: string; timeZone?: string }
  status?: 'confirmed' | 'tentative' | 'cancelled'
}

export interface CreateEventResult {
  eventId: string
  meetUrl: string | null
}

interface UpdateEventPayload {
  summary?: string
  description?: string
  start?: { dateTime: string; timeZone?: string }
  end?: { dateTime: string; timeZone?: string }
  status?: 'confirmed' | 'tentative' | 'cancelled'
}

// ─── Token Management ───────────────────────────────────────────────────────

async function getValidAccessToken(workspaceId: string): Promise<string | null> {
  const creds = await getIntegrationCredentials(workspaceId, 'google_calendar')
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
    console.error('[Google Calendar] Token refresh failed:', await res.text())
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
    .from('integrations')
    .update({ credentials_encrypted: encrypt(JSON.stringify(newCreds)) })
    .eq('workspace_id', workspaceId)
    .eq('type', 'google_calendar')

  return data.access_token
}

async function resolveAccessToken(
  opts: { workspaceId: string } | { accountId: string }
): Promise<string | null> {
  if ('accountId' in opts) return getValidAccessTokenForAccount(opts.accountId)
  return getValidAccessToken(opts.workspaceId)
}

// ─── API Helpers ────────────────────────────────────────────────────────────

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'

export async function getGoogleCalendarEvents(
  target: string | { accountId: string },
  timeMin: string,
  timeMax: string
): Promise<GoogleCalendarEvent[]> {
  const accessToken = typeof target === 'string'
    ? await resolveAccessToken({ workspaceId: target })
    : await resolveAccessToken(target)
  if (!accessToken) return []

  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
  })

  const res = await fetch(`${CALENDAR_API}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    console.error('[Google Calendar] Failed to fetch events:', res.status, await res.text())
    return []
  }

  const data = await res.json()
  return (data.items ?? []) as GoogleCalendarEvent[]
}

export async function createGoogleCalendarEvent(
  target: string | { accountId: string },
  event: CreateEventPayload,
  options?: { withMeet?: boolean }
): Promise<CreateEventResult | null> {
  const accessToken = typeof target === 'string'
    ? await resolveAccessToken({ workspaceId: target })
    : await resolveAccessToken(target)
  if (!accessToken) return null

  const withMeet = options?.withMeet ?? false

  const payload: Record<string, unknown> = { ...event }
  if (withMeet) {
    payload.conferenceData = {
      createRequest: {
        requestId: crypto.randomUUID(),
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    }
  }

  const url = withMeet
    ? `${CALENDAR_API}?conferenceDataVersion=1`
    : CALENDAR_API

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    console.error('[Google Calendar] Failed to create event:', res.status, await res.text())
    return null
  }

  const responseData = (await res.json()) as GoogleCalendarEvent

  const meetUrl = responseData.hangoutLink
    ?? responseData.conferenceData?.entryPoints?.[0]?.uri
    ?? null

  return { eventId: responseData.id, meetUrl }
}

export async function updateGoogleCalendarEvent(
  target: string | { accountId: string },
  eventId: string,
  event: UpdateEventPayload
): Promise<GoogleCalendarEvent | null> {
  const accessToken = typeof target === 'string'
    ? await resolveAccessToken({ workspaceId: target })
    : await resolveAccessToken(target)
  if (!accessToken) return null

  const res = await fetch(`${CALENDAR_API}/${encodeURIComponent(eventId)}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  })

  if (!res.ok) {
    console.error('[Google Calendar] Failed to update event:', res.status, await res.text())
    return null
  }

  return (await res.json()) as GoogleCalendarEvent
}

export async function deleteGoogleCalendarEvent(
  target: string | { accountId: string },
  eventId: string
): Promise<boolean> {
  const accessToken = typeof target === 'string'
    ? await resolveAccessToken({ workspaceId: target })
    : await resolveAccessToken(target)
  if (!accessToken) return false

  const res = await fetch(`${CALENDAR_API}/${encodeURIComponent(eventId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok && res.status !== 410) {
    console.error('[Google Calendar] Failed to delete event:', res.status, await res.text())
    return false
  }

  return true
}

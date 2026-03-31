import { getIntegrationCredentials } from '@/lib/integrations/get-credentials'
import { createServiceClient } from '@/lib/supabase/service'
import { encrypt } from '@/lib/crypto'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GoogleCalendarEvent {
  id: string
  summary?: string
  description?: string
  start: { dateTime?: string; date?: string }
  end: { dateTime?: string; date?: string }
  status?: string
}

interface CreateEventPayload {
  summary: string
  description?: string
  start: { dateTime: string; timeZone?: string }
  end: { dateTime: string; timeZone?: string }
}

interface UpdateEventPayload {
  summary?: string
  description?: string
  start?: { dateTime: string; timeZone?: string }
  end?: { dateTime: string; timeZone?: string }
}

// ─── Token Management ───────────────────────────────────────────────────────

async function getValidAccessToken(workspaceId: string): Promise<string | null> {
  const creds = await getIntegrationCredentials(workspaceId, 'google_calendar')
  if (!creds) return null

  const { access_token, refresh_token, expires_at } = creds

  // If token still valid (with 60s buffer), return it
  if (new Date(expires_at) > new Date(Date.now() + 60_000)) {
    return access_token
  }

  // Refresh the token
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

  // Save new tokens (keep existing refresh_token if Google doesn't return a new one)
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

// ─── API Helpers ────────────────────────────────────────────────────────────

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'

/**
 * Fetch events from Google Calendar within a time range.
 */
export async function getGoogleCalendarEvents(
  workspaceId: string,
  timeMin: string,
  timeMax: string
): Promise<GoogleCalendarEvent[]> {
  const accessToken = await getValidAccessToken(workspaceId)
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

/**
 * Create a new event on Google Calendar. Returns the created event or null on failure.
 */
export async function createGoogleCalendarEvent(
  workspaceId: string,
  event: CreateEventPayload
): Promise<GoogleCalendarEvent | null> {
  const accessToken = await getValidAccessToken(workspaceId)
  if (!accessToken) return null

  const res = await fetch(CALENDAR_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  })

  if (!res.ok) {
    console.error('[Google Calendar] Failed to create event:', res.status, await res.text())
    return null
  }

  return (await res.json()) as GoogleCalendarEvent
}

/**
 * Update an existing Google Calendar event. Returns updated event or null.
 */
export async function updateGoogleCalendarEvent(
  workspaceId: string,
  eventId: string,
  event: UpdateEventPayload
): Promise<GoogleCalendarEvent | null> {
  const accessToken = await getValidAccessToken(workspaceId)
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

/**
 * Delete a Google Calendar event. Returns true on success.
 */
export async function deleteGoogleCalendarEvent(
  workspaceId: string,
  eventId: string
): Promise<boolean> {
  const accessToken = await getValidAccessToken(workspaceId)
  if (!accessToken) return false

  const res = await fetch(`${CALENDAR_API}/${encodeURIComponent(eventId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok && res.status !== 410) {
    // 410 Gone = already deleted, treat as success
    console.error('[Google Calendar] Failed to delete event:', res.status, await res.text())
    return false
  }

  return true
}

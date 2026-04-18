import { NextResponse } from 'next/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { getIntegrationCredentials } from '@/lib/integrations/get-credentials'
import { createServiceClient } from '@/lib/supabase/service'
import { encrypt } from '@/lib/crypto'

type Step = { step: string; ok: boolean; detail?: unknown }

export async function GET() {
  const steps: Step[] = []
  let workspaceId: string | null = null

  try {
    const ctx = await getWorkspaceId()
    workspaceId = ctx.workspaceId
    steps.push({ step: 'auth', ok: true, detail: { workspaceId, role: ctx.role } })
  } catch (err) {
    steps.push({ step: 'auth', ok: false, detail: String(err) })
    return NextResponse.json({ steps }, { status: 200 })
  }

  // Step 1: integration row exists?
  const supabase = createServiceClient()
  const { data: integration, error: integErr } = await supabase
    .from('integrations')
    .select('id, is_active, connected_at, credentials_encrypted')
    .eq('workspace_id', workspaceId)
    .eq('type', 'google_calendar')
    .maybeSingle()

  if (integErr || !integration) {
    steps.push({ step: 'integration_row', ok: false, detail: integErr?.message || 'not found' })
    return NextResponse.json({ steps }, { status: 200 })
  }
  steps.push({
    step: 'integration_row',
    ok: true,
    detail: {
      is_active: integration.is_active,
      connected_at: integration.connected_at,
      has_credentials: !!integration.credentials_encrypted,
    },
  })

  // Step 2: decrypt credentials
  const creds = await getIntegrationCredentials(workspaceId, 'google_calendar')
  if (!creds) {
    steps.push({ step: 'decrypt_creds', ok: false, detail: 'Failed to decrypt or empty' })
    return NextResponse.json({ steps }, { status: 200 })
  }
  steps.push({
    step: 'decrypt_creds',
    ok: true,
    detail: {
      has_access_token: !!creds.access_token,
      has_refresh_token: !!creds.refresh_token,
      expires_at: creds.expires_at,
      expired: new Date(creds.expires_at) <= new Date(),
    },
  })

  // Step 3: refresh access token if needed
  let accessToken = creds.access_token
  if (new Date(creds.expires_at) <= new Date(Date.now() + 60_000)) {
    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET
    if (!clientId || !clientSecret) {
      steps.push({ step: 'refresh_token', ok: false, detail: 'Missing GOOGLE_CLIENT_ID/SECRET env vars' })
      return NextResponse.json({ steps }, { status: 200 })
    }
    if (!creds.refresh_token) {
      steps.push({ step: 'refresh_token', ok: false, detail: 'No refresh_token stored — reconnect with prompt=consent' })
      return NextResponse.json({ steps }, { status: 200 })
    }
    const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: creds.refresh_token,
      }),
    })
    if (!refreshRes.ok) {
      steps.push({ step: 'refresh_token', ok: false, detail: { status: refreshRes.status, body: await refreshRes.text() } })
      return NextResponse.json({ steps }, { status: 200 })
    }
    const refreshData = await refreshRes.json()
    accessToken = refreshData.access_token
    // Persist
    const newCreds = {
      access_token: refreshData.access_token,
      refresh_token: refreshData.refresh_token ?? creds.refresh_token,
      expires_at: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
    }
    await supabase
      .from('integrations')
      .update({ credentials_encrypted: encrypt(JSON.stringify(newCreds)) })
      .eq('id', integration.id)
    steps.push({ step: 'refresh_token', ok: true, detail: 'refreshed' })
  } else {
    steps.push({ step: 'refresh_token', ok: true, detail: 'still valid, no refresh needed' })
  }

  // Step 4: call Google Calendar API — list calendars
  const listRes = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!listRes.ok) {
    steps.push({
      step: 'list_calendars',
      ok: false,
      detail: { status: listRes.status, body: await listRes.text() },
    })
    return NextResponse.json({ steps }, { status: 200 })
  }
  const listData = await listRes.json()
  const calendars = (listData.items ?? []).map((c: { id: string; summary: string; primary?: boolean; accessRole?: string }) => ({
    id: c.id,
    summary: c.summary,
    primary: c.primary,
    accessRole: c.accessRole,
  }))
  steps.push({ step: 'list_calendars', ok: true, detail: { count: calendars.length, calendars } })

  // Step 5: try to read events from primary
  const timeMin = new Date(Date.now() - 7 * 86400000).toISOString()
  const timeMax = new Date(Date.now() + 30 * 86400000).toISOString()
  const eventsRes = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: 'true',
      maxResults: '10',
    })}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  if (!eventsRes.ok) {
    steps.push({
      step: 'read_events',
      ok: false,
      detail: { status: eventsRes.status, body: await eventsRes.text() },
    })
  } else {
    const evData = await eventsRes.json()
    steps.push({ step: 'read_events', ok: true, detail: { count: (evData.items ?? []).length } })
  }

  // Step 6: try to create a throwaway test event
  const testStart = new Date(Date.now() + 365 * 86400000) // 1 year in future
  const testEnd = new Date(testStart.getTime() + 15 * 60000)
  const createRes = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      summary: '[ClosRM Diagnose] Test event (safe to delete)',
      start: { dateTime: testStart.toISOString() },
      end: { dateTime: testEnd.toISOString() },
    }),
  })
  if (!createRes.ok) {
    steps.push({
      step: 'create_event',
      ok: false,
      detail: { status: createRes.status, body: await createRes.text() },
    })
  } else {
    const createData = await createRes.json()
    steps.push({ step: 'create_event', ok: true, detail: { id: createData.id, htmlLink: createData.htmlLink } })
    // Clean up — delete the test event
    await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${createData.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    })
  }

  return NextResponse.json({ steps }, { status: 200 })
}

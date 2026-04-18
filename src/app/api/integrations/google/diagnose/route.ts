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

  // Step 5b: actually run the sync logic and surface insert errors
  try {
    const timeMinSync = new Date().toISOString()
    const timeMaxSync = new Date(Date.now() + 30 * 86400000).toISOString()
    const syncEventsRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${new URLSearchParams({
        timeMin: timeMinSync,
        timeMax: timeMaxSync,
        singleEvents: 'true',
        orderBy: 'startTime',
        maxResults: '250',
      })}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    const syncData = await syncEventsRes.json()
    const events = (syncData.items ?? []) as Array<{
      id: string
      summary?: string
      description?: string
      status?: string
      start: { dateTime?: string; date?: string }
      end: { dateTime?: string; date?: string }
    }>

    const skipped = { noDateTime: 0, cancelled: 0 }
    const sampleEvents: Array<Record<string, unknown>> = []
    let inserted = 0
    let updated = 0
    const insertErrors: Array<{ summary: string; error: string }> = []

    // Fetch existing bookings for deduplication
    const eventIds = events.map((e) => e.id)
    const { data: existingBookings } = await supabase
      .from('bookings')
      .select('id, google_event_id')
      .eq('workspace_id', workspaceId)
      .in('google_event_id', eventIds)

    const existingMap = new Map(
      (existingBookings ?? []).map((b) => [b.google_event_id, b.id])
    )

    for (const event of events) {
      if (!event.start.dateTime || !event.end.dateTime) {
        skipped.noDateTime++
        if (sampleEvents.length < 3) sampleEvents.push({ summary: event.summary, reason: 'no dateTime', start: event.start })
        continue
      }
      if (event.status === 'cancelled') {
        skipped.cancelled++
        continue
      }
      const startDate = new Date(event.start.dateTime)
      const endDate = new Date(event.end.dateTime)
      const durationMinutes = Math.round((endDate.getTime() - startDate.getTime()) / 60_000)

      if (existingMap.has(event.id)) {
        const bookingId = existingMap.get(event.id)!
        const { error } = await supabase
          .from('bookings')
          .update({
            title: event.summary || 'Google Calendar',
            scheduled_at: event.start.dateTime,
            duration_minutes: durationMinutes > 0 ? durationMinutes : 30,
            notes: event.description || null,
          })
          .eq('id', bookingId)
          .eq('workspace_id', workspaceId)
        if (error) insertErrors.push({ summary: event.summary || '?', error: `update: ${error.message}` })
        else updated++
      } else {
        const { error } = await supabase
          .from('bookings')
          .insert({
            workspace_id: workspaceId,
            title: event.summary || 'Google Calendar',
            scheduled_at: event.start.dateTime,
            duration_minutes: durationMinutes > 0 ? durationMinutes : 30,
            notes: event.description || null,
            source: 'google_sync',
            is_personal: true,
            google_event_id: event.id,
            calendar_id: null,
            lead_id: null,
            status: 'confirmed',
            form_data: {},
            location_id: null,
          })
        if (error) insertErrors.push({ summary: event.summary || '?', error: `insert: ${error.message}` })
        else inserted++
      }
    }

    steps.push({
      step: 'run_sync',
      ok: insertErrors.length === 0,
      detail: {
        total_events: events.length,
        inserted,
        updated,
        skipped,
        sample_skipped: sampleEvents,
        insert_errors: insertErrors.slice(0, 5),
      },
    })
  } catch (err) {
    steps.push({ step: 'run_sync', ok: false, detail: String(err) })
  }

  // Step 5c: inspect bookings in DB
  try {
    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - 7)
    const weekEnd = new Date()
    weekEnd.setDate(weekEnd.getDate() + 30)

    const { data: allBookings, count: totalCount } = await supabase
      .from('bookings')
      .select('id, title, scheduled_at, is_personal, source, status, calendar_id, google_event_id', { count: 'exact' })
      .eq('workspace_id', workspaceId)
      .gte('scheduled_at', weekStart.toISOString())
      .lte('scheduled_at', weekEnd.toISOString())
      .order('scheduled_at', { ascending: true })

    const googleSynced = (allBookings ?? []).filter((b) => b.source === 'google_sync')
    const byStatus = (allBookings ?? []).reduce((acc: Record<string, number>, b) => {
      acc[b.status || 'null'] = (acc[b.status || 'null'] || 0) + 1
      return acc
    }, {})
    const bySource = (allBookings ?? []).reduce((acc: Record<string, number>, b) => {
      acc[b.source || 'null'] = (acc[b.source || 'null'] || 0) + 1
      return acc
    }, {})

    steps.push({
      step: 'inspect_db_bookings',
      ok: true,
      detail: {
        total_in_range: totalCount,
        by_status: byStatus,
        by_source: bySource,
        google_sync_count: googleSynced.length,
        sample_google_synced: googleSynced.slice(0, 5).map((b) => ({
          id: b.id,
          title: b.title,
          scheduled_at: b.scheduled_at,
          is_personal: b.is_personal,
          status: b.status,
        })),
      },
    })
  } catch (err) {
    steps.push({ step: 'inspect_db_bookings', ok: false, detail: String(err) })
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

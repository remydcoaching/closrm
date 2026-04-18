import { NextResponse } from 'next/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { getIntegrationCredentials } from '@/lib/integrations/get-credentials'
import { createServiceClient } from '@/lib/supabase/service'
import { encrypt } from '@/lib/crypto'

type Report = Record<string, unknown>

async function getAccessToken(workspaceId: string, supabase: ReturnType<typeof createServiceClient>): Promise<string | null> {
  const creds = await getIntegrationCredentials(workspaceId, 'google_calendar')
  if (!creds) return null

  if (new Date(creds.expires_at) > new Date(Date.now() + 60_000)) {
    return creds.access_token
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret || !creds.refresh_token) return null

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: creds.refresh_token,
    }),
  })
  if (!res.ok) return null
  const data = await res.json()

  const newCreds = {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? creds.refresh_token,
    expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
  }
  await supabase
    .from('integrations')
    .update({ credentials_encrypted: encrypt(JSON.stringify(newCreds)) })
    .eq('workspace_id', workspaceId)
    .eq('type', 'google_calendar')

  return data.access_token
}

export async function GET() {
  const report: Report = {}

  try {
    const { workspaceId, role } = await getWorkspaceId()
    report.workspace = { workspaceId, role }

    const supabase = createServiceClient()

    // === DB INSPECTION ===

    // 1. All bookings for workspace
    const { data: allBookings, count: totalAll } = await supabase
      .from('bookings')
      .select('id, title, scheduled_at, is_personal, source, status, calendar_id, google_event_id, assigned_to', { count: 'exact' })
      .eq('workspace_id', workspaceId)
      .order('scheduled_at', { ascending: true })

    const bookingsArr = allBookings ?? []

    // Group stats
    const bySource: Record<string, number> = {}
    const byStatus: Record<string, number> = {}
    let withGoogleId = 0
    let withAssignedTo = 0
    let personalCount = 0
    for (const b of bookingsArr) {
      bySource[b.source || 'null'] = (bySource[b.source || 'null'] || 0) + 1
      byStatus[b.status || 'null'] = (byStatus[b.status || 'null'] || 0) + 1
      if (b.google_event_id) withGoogleId++
      if (b.assigned_to) withAssignedTo++
      if (b.is_personal) personalCount++
    }

    report.db_total = {
      total: totalAll,
      by_source: bySource,
      by_status: byStatus,
      with_google_event_id: withGoogleId,
      with_assigned_to: withAssignedTo,
      is_personal: personalCount,
    }

    // 2. Bookings in current week (UTC frame)
    const now = new Date()
    const mondayParis = new Date(now)
    const day = mondayParis.getDay() || 7
    mondayParis.setDate(mondayParis.getDate() - (day - 1))
    mondayParis.setHours(0, 0, 0, 0)
    const sundayParis = new Date(mondayParis)
    sundayParis.setDate(sundayParis.getDate() + 6)
    sundayParis.setHours(23, 59, 59, 999)

    const { data: weekBookings } = await supabase
      .from('bookings')
      .select('id, title, scheduled_at, is_personal, source, status, calendar_id, google_event_id')
      .eq('workspace_id', workspaceId)
      .gte('scheduled_at', mondayParis.toISOString())
      .lte('scheduled_at', sundayParis.toISOString())
      .order('scheduled_at', { ascending: true })

    report.current_week_range = {
      monday: mondayParis.toISOString(),
      sunday: sundayParis.toISOString(),
    }
    report.current_week_bookings = {
      count: weekBookings?.length ?? 0,
      items: weekBookings ?? [],
    }

    // 3. Bookings grouped by day over the past 30 days to see distribution
    const thirtyDaysAgo = new Date(now)
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const thirtyDaysAhead = new Date(now)
    thirtyDaysAhead.setDate(thirtyDaysAhead.getDate() + 30)

    const { data: rangeBookings } = await supabase
      .from('bookings')
      .select('scheduled_at, source, is_personal')
      .eq('workspace_id', workspaceId)
      .gte('scheduled_at', thirtyDaysAgo.toISOString())
      .lte('scheduled_at', thirtyDaysAhead.toISOString())
      .order('scheduled_at', { ascending: true })

    const byDay: Record<string, { total: number; google: number }> = {}
    for (const b of rangeBookings ?? []) {
      const day = new Date(b.scheduled_at).toISOString().slice(0, 10)
      if (!byDay[day]) byDay[day] = { total: 0, google: 0 }
      byDay[day].total++
      if (b.source === 'google_sync') byDay[day].google++
    }
    report.bookings_by_day_60d = byDay

    // === TRIGGER NEW SYNC WITH EXPANDED WINDOW ===

    const accessToken = await getAccessToken(workspaceId, supabase)
    if (!accessToken) {
      report.sync_result = { ok: false, error: 'Failed to get access token' }
      return NextResponse.json(report, { status: 200 })
    }

    const timeMin = new Date(Date.now() - 14 * 86400000).toISOString()
    const timeMax = new Date(Date.now() + 30 * 86400000).toISOString()

    const gcalRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${new URLSearchParams({
        timeMin,
        timeMax,
        singleEvents: 'true',
        orderBy: 'startTime',
        maxResults: '250',
      })}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    if (!gcalRes.ok) {
      report.sync_result = { ok: false, error: await gcalRes.text() }
      return NextResponse.json(report, { status: 200 })
    }
    const gcalData = await gcalRes.json()
    const events = (gcalData.items ?? []) as Array<{
      id: string
      summary?: string
      description?: string
      status?: string
      start: { dateTime?: string; date?: string }
      end: { dateTime?: string; date?: string }
    }>

    const eventIds = events.map((e) => e.id)
    const { data: existing } = await supabase
      .from('bookings')
      .select('id, google_event_id')
      .eq('workspace_id', workspaceId)
      .in('google_event_id', eventIds)
    const existingMap = new Map((existing ?? []).map((b) => [b.google_event_id, b.id]))

    let inserted = 0, updated = 0, skipped = 0
    const insertErrors: Array<{ summary: string; error: string }> = []
    const firstFiveInserted: Array<Record<string, unknown>> = []

    for (const event of events) {
      if (!event.start.dateTime || !event.end.dateTime) { skipped++; continue }
      if (event.status === 'cancelled') { skipped++; continue }

      const startDate = new Date(event.start.dateTime)
      const endDate = new Date(event.end.dateTime)
      const duration = Math.round((endDate.getTime() - startDate.getTime()) / 60_000)

      if (existingMap.has(event.id)) {
        const { error } = await supabase
          .from('bookings')
          .update({
            title: event.summary || 'Google Calendar',
            scheduled_at: event.start.dateTime,
            duration_minutes: duration > 0 ? duration : 30,
            notes: event.description || null,
          })
          .eq('id', existingMap.get(event.id)!)
          .eq('workspace_id', workspaceId)
        if (error) insertErrors.push({ summary: event.summary || '?', error: `update: ${error.message}` })
        else updated++
      } else {
        const { data: newRow, error } = await supabase
          .from('bookings')
          .insert({
            workspace_id: workspaceId,
            title: event.summary || 'Google Calendar',
            scheduled_at: event.start.dateTime,
            duration_minutes: duration > 0 ? duration : 30,
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
          .select('id, scheduled_at, title')
          .single()
        if (error) insertErrors.push({ summary: event.summary || '?', error: `insert: ${error.message}` })
        else {
          inserted++
          if (firstFiveInserted.length < 5) firstFiveInserted.push(newRow)
        }
      }
    }

    report.sync_result = {
      window: { timeMin, timeMax },
      total_google_events: events.length,
      inserted,
      updated,
      skipped,
      first_five_inserted: firstFiveInserted,
      insert_errors: insertErrors.slice(0, 10),
    }

    // 4. Re-query week bookings AFTER sync
    const { data: weekAfter } = await supabase
      .from('bookings')
      .select('id, title, scheduled_at, is_personal, source')
      .eq('workspace_id', workspaceId)
      .gte('scheduled_at', mondayParis.toISOString())
      .lte('scheduled_at', sundayParis.toISOString())
      .order('scheduled_at', { ascending: true })
    report.current_week_bookings_after_sync = {
      count: weekAfter?.length ?? 0,
      items: weekAfter ?? [],
    }

    return NextResponse.json(report, { status: 200 })
  } catch (err) {
    report.fatal_error = err instanceof Error ? err.message : String(err)
    return NextResponse.json(report, { status: 500 })
  }
}

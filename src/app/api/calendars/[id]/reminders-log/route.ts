import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface ReminderRow {
  id: string
  channel: string
  message: string
  send_at: string
  status: string
  error: string | null
  created_at: string
  booking: { id: string; scheduled_at: string; calendar_id: string | null } | null
  lead: { id: string; first_name: string | null; last_name: string | null; email: string | null } | null
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let workspaceId: string
  try {
    ;({ workspaceId } = await getWorkspaceId())
  } catch {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { id: calendarId } = await params
  const supabase = await createClient()

  // We can't filter directly on bookings.calendar_id from booking_reminders,
  // so fetch the booking IDs first then filter reminders.
  const { data: bookings } = await supabase
    .from('bookings')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('calendar_id', calendarId)
    .limit(500)

  const bookingIds = (bookings ?? []).map((b) => b.id)
  if (bookingIds.length === 0) {
    return NextResponse.json({ reminders: [] })
  }

  const { data: reminders, error } = await supabase
    .from('booking_reminders')
    .select(
      'id, channel, message, send_at, status, error, created_at, ' +
      'booking:bookings(id, scheduled_at, calendar_id), ' +
      'lead:leads(id, first_name, last_name, email)'
    )
    .in('booking_id', bookingIds)
    .eq('workspace_id', workspaceId)
    .order('send_at', { ascending: false })
    .limit(100)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ reminders: (reminders ?? []) as unknown as ReminderRow[] })
}

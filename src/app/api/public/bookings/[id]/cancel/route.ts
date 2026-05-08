import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { cancelBookingReminders } from '@/lib/bookings/reminders'
import { deleteGoogleCalendarEvent } from '@/lib/google/calendar'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  let body: { token?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corps invalide' }, { status: 400 })
  }
  const token = body.token

  if (!token || !id) {
    return NextResponse.json({ error: 'Token manquant' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data: booking, error } = await supabase
    .from('bookings')
    .select('id, status, manage_token, workspace_id, google_event_id, call_id')
    .eq('id', id)
    .maybeSingle()

  if (error || !booking) {
    return NextResponse.json({ error: 'Rendez-vous introuvable' }, { status: 404 })
  }
  if (booking.manage_token !== token) {
    return NextResponse.json({ error: 'Token invalide' }, { status: 403 })
  }
  if (booking.status === 'cancelled') {
    return NextResponse.json({ ok: true, alreadyCancelled: true })
  }

  // Cancel pending reminders
  await cancelBookingReminders(id)

  // Delete Google Calendar event if present
  if (booking.google_event_id && booking.workspace_id) {
    deleteGoogleCalendarEvent(booking.workspace_id, booking.google_event_id).catch((err) => {
      console.error('[cancel-booking] Google Calendar delete failed:', err instanceof Error ? err.message : err)
    })
  }

  // Delete linked call if any
  if (booking.call_id && booking.workspace_id) {
    supabase.from('calls').delete().eq('id', booking.call_id).eq('workspace_id', booking.workspace_id).then(() => {})
  }

  // Delete the booking entirely
  const { error: delErr } = await supabase
    .from('bookings')
    .delete()
    .eq('id', id)

  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

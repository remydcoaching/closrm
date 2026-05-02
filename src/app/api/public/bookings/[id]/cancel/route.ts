import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { cancelBookingReminders } from '@/lib/bookings/reminders'

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
    .select('id, status, manage_token')
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

  const { error: updErr } = await supabase
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('id', id)

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 })
  }

  await cancelBookingReminders(id)

  return NextResponse.json({ ok: true })
}

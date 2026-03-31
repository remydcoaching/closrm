import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { updateBookingSchema } from '@/lib/validations/bookings'
import { deleteGoogleCalendarEvent } from '@/lib/google/calendar'

const BOOKING_SELECT = '*, booking_calendar:booking_calendars(name, color, location), lead:leads(id, first_name, last_name, phone, email)'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('bookings')
      .select(BOOKING_SELECT)
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .single()

    if (error || !data) return NextResponse.json({ error: 'Réservation non trouvée' }, { status: 404 })
    return NextResponse.json({ data })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const body = await request.json()
    const parsed = updateBookingSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    const { data: existing } = await supabase
      .from('bookings')
      .select('id, google_event_id, status')
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .single()
    if (!existing) return NextResponse.json({ error: 'Réservation non trouvée' }, { status: 404 })

    const { data, error } = await supabase
      .from('bookings')
      .update(parsed.data)
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .select(BOOKING_SELECT)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // If status changed to cancelled and has a Google event, delete it (non-blocking)
    if (
      parsed.data.status === 'cancelled' &&
      existing.status !== 'cancelled' &&
      existing.google_event_id
    ) {
      deleteGoogleCalendarEvent(workspaceId, existing.google_event_id).catch(() => {})
    }

    return NextResponse.json({ data })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    // Fetch the booking first to get google_event_id before deleting
    const { data: bookingToDelete } = await supabase
      .from('bookings')
      .select('id, google_event_id')
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .single()

    if (!bookingToDelete) return NextResponse.json({ error: 'Réservation non trouvée' }, { status: 404 })

    const { data, error } = await supabase
      .from('bookings')
      .delete()
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .select()
      .single()

    if (error || !data) return NextResponse.json({ error: 'Réservation non trouvée' }, { status: 404 })

    // Delete Google Calendar event if linked (non-blocking)
    if (bookingToDelete.google_event_id) {
      deleteGoogleCalendarEvent(workspaceId, bookingToDelete.google_event_id).catch(() => {})
    }

    return NextResponse.json({ data })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../services/supabase'
import type { AgendaItem } from '../types/agenda'

const startOfDay = (d: Date) => {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}
const endOfDay = (d: Date) => {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}

interface BookingRow {
  id: string
  title: string
  scheduled_at: string
  duration_minutes: number
  status: string
  is_personal: boolean | null
  call_id: string | null
  lead_id: string | null
  color: string | null
  notes: string | null
  form_data: Record<string, string> | null
  location: { name: string } | null
  booking_calendar: { name: string; color: string } | null
  lead: { id: string; first_name: string | null; last_name: string | null } | null
}

interface CallRow {
  id: string
  scheduled_at: string
  duration_seconds: number | null
  type: 'setting' | 'closing'
  outcome: 'pending' | 'done' | 'no_show' | 'cancelled'
  notes: string | null
  lead: {
    id: string
    first_name: string | null
    last_name: string | null
    deal_amount: number | null
  } | null
}

export function useAgenda(date: Date) {
  const [items, setItems] = useState<AgendaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    const from = startOfDay(date).toISOString()
    const to = endOfDay(date).toISOString()

    const [bookingsRes, callsRes] = await Promise.all([
      supabase
        .from('bookings')
        .select(
          'id, title, scheduled_at, duration_minutes, status, is_personal, call_id, lead_id, color, notes, form_data, ' +
            'location:booking_locations(name), ' +
            'booking_calendar:booking_calendars(name, color), ' +
            'lead:leads(id, first_name, last_name)'
        )
        .gte('scheduled_at', from)
        .lte('scheduled_at', to)
        .neq('status', 'cancelled')
        .order('scheduled_at', { ascending: true }),
      supabase
        .from('calls')
        .select(
          'id, scheduled_at, duration_seconds, type, outcome, notes, ' +
            'lead:leads(id, first_name, last_name, deal_amount)'
        )
        .gte('scheduled_at', from)
        .lte('scheduled_at', to)
        .order('scheduled_at', { ascending: true }),
    ])

    if (bookingsRes.error || callsRes.error) {
      setError(bookingsRes.error?.message ?? callsRes.error?.message ?? 'Erreur')
      setItems([])
      setLoading(false)
      return
    }

    const bookings = (bookingsRes.data ?? []) as unknown as BookingRow[]
    const calls = (callsRes.data ?? []) as unknown as CallRow[]

    // Skip les bookings qui ont un call_id (on les affichera via la ligne calls
    // pour éviter le doublon — c'est le call qui porte l'outcome).
    // Couleur résolue : mêmes règles que web bookingToAgendaEvent —
    //   booking.color (override explicite)
    //   > form_data.color (template import)
    //   > booking_calendar.color (calendrier source)
    //   > #6b7280 (gris) si is_personal, sinon #3b82f6 (bleu).
    const bookingItems: AgendaItem[] = bookings
      .filter((b) => !b.call_id)
      .map((b) => {
        const formColor =
          typeof b.form_data?.color === 'string' && b.form_data.color.length > 0
            ? b.form_data.color
            : null
        const personalFallback = '#6b7280'
        const meetingFallback = '#3b82f6'
        const resolvedColor =
          b.color ??
          formColor ??
          b.booking_calendar?.color ??
          (b.is_personal ? personalFallback : meetingFallback)
        return {
          id: `booking:${b.id}`,
          source: 'booking',
          kind: b.is_personal ? 'personal' : 'meeting',
          title: b.title,
          scheduled_at: b.scheduled_at,
          duration_minutes: b.duration_minutes,
          booking_id: b.id,
          lead_id: b.lead_id,
          lead_name: b.lead
            ? `${b.lead.first_name ?? ''} ${b.lead.last_name ?? ''}`.trim() || null
            : null,
          status: b.status,
          color: resolvedColor,
          location_name: b.location?.name ?? null,
          notes: b.notes ?? null,
        }
      })

    const callItems: AgendaItem[] = calls
      .filter((c) => c.outcome !== 'cancelled')
      .map((c) => {
        const lead = c.lead
        const leadName = lead
          ? `${lead.first_name ?? ''} ${lead.last_name ?? ''}`.trim() || null
          : null
        // Couleurs alignées sur web src/types/agenda.ts CALL_COLORS.
        const callColor = c.type === 'closing' ? '#a855f7' : '#3b82f6'
        return {
          id: `call:${c.id}`,
          source: 'call',
          kind: c.type,
          title: leadName ?? (c.type === 'closing' ? 'Closing' : 'Setting'),
          scheduled_at: c.scheduled_at,
          duration_minutes: c.duration_seconds
            ? Math.max(15, Math.round(c.duration_seconds / 60))
            : 30,
          call_id: c.id,
          lead_id: lead?.id ?? null,
          lead_name: leadName,
          amount: lead?.deal_amount ?? null,
          outcome: c.outcome,
          color: callColor,
          notes: c.notes ?? null,
        }
      })

    const merged = [...bookingItems, ...callItems].sort(
      (a, b) =>
        new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
    )
    setItems(merged)
    setLoading(false)
  }, [date])

  useEffect(() => {
    void fetchAll()
  }, [fetchAll])

  // Realtime : on écoute calls + bookings et on refetch.
  useEffect(() => {
    const channel = supabase
      .channel('agenda-day-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calls' }, () => {
        void fetchAll()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        void fetchAll()
      })
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [fetchAll])

  return { items, loading, error, refetch: fetchAll }
}

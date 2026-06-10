import { useEffect } from 'react'
import { supabase } from '../services/supabase'
import {
  cancelAllAgendaReminders,
  scheduleAgendaReminders,
} from '../services/agenda-reminders'
import { useAuth } from './useAuth'

/**
 * Hook root : maintient les rappels locaux iOS pour les prochains events.
 *
 * Logique :
 * 1. Au mount (et sur changement d'auth), fetch les events à venir (next 24h).
 * 2. Cancel tous les rappels locaux précédents (idempotence).
 * 3. Schedule un rappel par lead-time configuré × event.
 * 4. Re-run quand bookings/calls changent (realtime channel).
 *
 * Appelé une seule fois dans App.tsx — pas dans un screen, sinon les rappels
 * disparaissent quand le screen unmount.
 */
export function useAgendaReminders() {
  const { user } = useAuth()

  useEffect(() => {
    if (!user) return
    let cancelled = false

    const refresh = async () => {
      const now = new Date()
      const horizon = new Date(now.getTime() + 24 * 60 * 60 * 1000)

      const [bookingsRes, callsRes] = await Promise.all([
        supabase
          .from('bookings')
          .select(
            'id, title, scheduled_at, status, call_id, lead:leads(first_name, last_name)'
          )
          .gte('scheduled_at', now.toISOString())
          .lte('scheduled_at', horizon.toISOString())
          .neq('status', 'cancelled'),
        supabase
          .from('calls')
          .select(
            'id, scheduled_at, type, outcome, lead:leads(first_name, last_name)'
          )
          .gte('scheduled_at', now.toISOString())
          .lte('scheduled_at', horizon.toISOString())
          .eq('outcome', 'pending'),
      ])

      if (cancelled) return

      type BookingR = {
        id: string
        title: string
        scheduled_at: string
        call_id: string | null
        lead: { first_name: string | null; last_name: string | null } | null
      }
      type CallR = {
        id: string
        scheduled_at: string
        type: 'setting' | 'closing'
        lead: { first_name: string | null; last_name: string | null } | null
      }

      const bookings = (bookingsRes.data ?? []) as unknown as BookingR[]
      const calls = (callsRes.data ?? []) as unknown as CallR[]

      const events = [
        ...bookings
          .filter((b) => !b.call_id)
          .map((b) => {
            const leadName = b.lead
              ? `${b.lead.first_name ?? ''} ${b.lead.last_name ?? ''}`.trim()
              : ''
            return {
              id: `booking:${b.id}`,
              scheduledAt: new Date(b.scheduled_at),
              title: b.title || 'RDV',
              body: leadName ? `${leadName} · ${formatTime(b.scheduled_at)}` : formatTime(b.scheduled_at),
              data: { entity_type: 'lead' as const, entity_id: '' },
            }
          }),
        ...calls.map((c) => {
          const leadName = c.lead
            ? `${c.lead.first_name ?? ''} ${c.lead.last_name ?? ''}`.trim()
            : 'Appel'
          const kindLabel = c.type === 'closing' ? 'Closing' : 'Setting'
          return {
            id: `call:${c.id}`,
            scheduledAt: new Date(c.scheduled_at),
            title: `${kindLabel} · ${leadName}`,
            body: `À ${formatTime(c.scheduled_at)}`,
            data: { entity_type: 'call' as const, entity_id: c.id },
          }
        }),
      ]

      await cancelAllAgendaReminders()
      await scheduleAgendaReminders(events)
    }

    void refresh()

    // Realtime : si un booking ou call est créé/modifié, on reschedule.
    const channel = supabase
      .channel('agenda-reminders-watch')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        void refresh()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calls' }, () => {
        void refresh()
      })
      .subscribe()

    // Refresh aussi périodiquement (toutes les 15min) pour purger les rappels
    // expirés et capter d'éventuels imports Google sync.
    const interval = setInterval(() => {
      void refresh()
    }, 15 * 60 * 1000)

    return () => {
      cancelled = true
      void supabase.removeChannel(channel)
      clearInterval(interval)
    }
  }, [user])
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

/**
 * Type discriminé central pour le module agenda (Phase 2 refonte).
 *
 * Le coach affiche dans la même grille deux entités sémantiquement distinctes :
 *  - `booking` : un RDV concret (booking_calendars + booking page publique ou
 *    création manuelle), avec lead/location/Meet URL.
 *  - `call` : un appel pipeline interne (setting / closing) lié à un lead, sans
 *    booking_calendar associé.
 *
 * On garde les deux comme des `kind` distincts au lieu de coercer les calls en
 * BookingWithCalendar bidouillé (préfixe `'call-'`, type coercion outcome→status,
 * etc.) — ça évite les bugs de routage `/api/calls/[id]` vs `/api/bookings/[id]`
 * et laisse chaque vue afficher l'événement avec ses propres affordances.
 */

import type { Booking, BookingWithCalendar, Call, Lead } from '@/types'

export type AgendaEventKind = 'booking' | 'call'

interface AgendaEventBase {
  /** Identifiant unique pour React keys et sélection. Préfixé par kind pour
   *  garantir l'unicité même si un booking et un call avaient le même UUID. */
  id: string
  kind: AgendaEventKind
  /** ISO 8601 — début du créneau */
  start: string
  /** Durée en minutes — déjà résolue (calls passent par leur duration_seconds) */
  durationMinutes: number
  /** Couleur affichage : color du booking_calendar pour `booking`, ou couleur
   *  conventionnelle setting/closing pour `call`. */
  color: string
  /** Titre court affiché dans la card. */
  title: string
  /** Sous-titre optionnel (calendar name, type call label, etc.) */
  subtitle: string | null
  /** Lead associé si présent (hover preview, side panel). */
  lead: Pick<Lead, 'id' | 'first_name' | 'last_name' | 'phone' | 'email'> | null
}

export interface AgendaBookingEvent extends AgendaEventBase {
  kind: 'booking'
  booking: BookingWithCalendar
}

export interface AgendaCallEvent extends AgendaEventBase {
  kind: 'call'
  call: Call
}

export type AgendaEvent = AgendaBookingEvent | AgendaCallEvent

/* ─── Helpers de construction ──────────────────────────────────────────────── */

const CALL_COLORS: Record<Call['type'], string> = {
  setting: '#3b82f6',
  closing: '#a855f7',
}

const CALL_LABELS: Record<Call['type'], string> = {
  setting: 'Setting',
  closing: 'Closing',
}

export function bookingToAgendaEvent(b: BookingWithCalendar): AgendaBookingEvent {
  const leadName = b.lead
    ? `${b.lead.first_name} ${b.lead.last_name}`.trim()
    : null
  // Pour les bookings perso (créés via import de template, ou bloqués
  // manuellement), la couleur du bloc d'origine est stockée dans
  // `form_data.color` au moment de l'import. On la respecte si présente —
  // sinon fallback sur le gris neutre.
  const personalColor =
    typeof b.form_data?.color === 'string' && b.form_data.color.length > 0
      ? b.form_data.color
      : '#6b7280'
  return {
    id: `booking-${b.id}`,
    kind: 'booking',
    start: b.scheduled_at,
    durationMinutes: b.duration_minutes,
    color: b.is_personal
      ? personalColor
      : b.booking_calendar?.color ?? '#3b82f6',
    title: b.is_personal ? b.title : leadName ?? b.title,
    subtitle: b.booking_calendar?.name ?? null,
    lead: b.lead,
    booking: b,
  }
}

export function callToAgendaEvent(c: Call & { lead?: AgendaCallEvent['lead'] }): AgendaCallEvent {
  const lead = c.lead ?? null
  const leadName = lead ? `${lead.first_name} ${lead.last_name}`.trim() : 'Appel'
  return {
    id: `call-${c.id}`,
    kind: 'call',
    start: c.scheduled_at,
    durationMinutes: c.duration_seconds ? Math.max(1, Math.ceil(c.duration_seconds / 60)) : 30,
    color: CALL_COLORS[c.type],
    title: leadName,
    subtitle: CALL_LABELS[c.type],
    lead,
    call: c,
  }
}

/**
 * Map un `AgendaEvent` vers le `Booking['status']` équivalent pour l'affichage
 * (badge confirmé/annulé/etc.). Les calls n'ont pas de `status` mais un
 * `outcome` — on convertit ici. Source de vérité unique.
 */
export function eventStatus(e: AgendaEvent): Booking['status'] {
  if (e.kind === 'booking') return e.booking.status
  switch (e.call.outcome) {
    case 'done':
      return 'completed'
    case 'cancelled':
      return 'cancelled'
    case 'no_show':
      return 'no_show'
    case 'pending':
    default:
      return 'confirmed'
  }
}

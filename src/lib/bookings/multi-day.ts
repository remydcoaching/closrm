/**
 * Helpers pour afficher correctement les bookings qui s'étalent sur plusieurs
 * jours (ex: bloc "vacances 5 jours", ou créneau "toute la journée").
 *
 * Le modèle DB reste simple : `scheduled_at` + `duration_minutes`. Pas de
 * colonne end_at / all_day. Quand un booking franchit minuit, les vues
 * (DayView, WeekView, MonthView) doivent l'afficher sur chacun des jours
 * traversés, avec un titre uniquement sur le 1er jour ("(suite)" sinon) et
 * une position/hauteur clamp au quart courant de la journée.
 */

import { startOfDay, endOfDay, isSameDay, parseISO } from 'date-fns'
import type { BookingWithCalendar } from '@/types'

/**
 * Vrai si le booking est un évènement "toute la journée" / multi-jours :
 * durée ≥ 24h. On évite d'exiger un alignement strict à minuit pour ne pas
 * rater les bookings créés avec un léger décalage timezone (parseISO d'un
 * timestamp Postgres peut renvoyer 23:00 au lieu de 00:00 selon la TZ).
 * Tous les bookings ≥ 1 journée passent dans la lane horizontale en haut
 * de l'agenda (style Google Calendar) plutôt que dans la grille horaire.
 */
export function isAllDayBooking(b: { scheduled_at: string; duration_minutes: number }): boolean {
  return b.duration_minutes >= 1440
}

export interface BookingDaySegment {
  /** Le booking original (pas une copie — les props comme id/title restent). */
  booking: BookingWithCalendar
  /** Date du jour pour lequel on calcule le segment. */
  day: Date
  /** Heure de début du segment dans le jour (0..24, fractions autorisées). */
  startHour: number
  /** Heure de fin du segment dans le jour (0..24, exclusive). */
  endHour: number
  /** Vrai si le segment commence ce jour-là (donc afficher le titre complet). */
  isFirstDay: boolean
  /** Vrai si le segment se termine ce jour-là (sinon "↓" pour signaler la suite). */
  isLastDay: boolean
}

/**
 * Retourne true si le booking touche ce jour (overlap, pas juste démarrage).
 */
export function bookingTouchesDay(b: BookingWithCalendar, day: Date): boolean {
  const start = parseISO(b.scheduled_at)
  const end = new Date(start.getTime() + b.duration_minutes * 60_000)
  const dayStart = startOfDay(day)
  const dayEnd = endOfDay(day)
  // Overlap si start < dayEnd ET end > dayStart
  return start < dayEnd && end > dayStart
}

/**
 * Calcule le segment d'un booking pour un jour donné — bornes clampées à
 * [00:00, 24:00). Si le booking ne touche pas ce jour, retourne `null`.
 */
export function getBookingDaySegment(
  b: BookingWithCalendar,
  day: Date,
): BookingDaySegment | null {
  const start = parseISO(b.scheduled_at)
  const end = new Date(start.getTime() + b.duration_minutes * 60_000)
  const dayStart = startOfDay(day)
  const dayEnd = endOfDay(day) // 23:59:59.999 du jour
  const dayEndExclusive = new Date(dayEnd.getTime() + 1) // 00:00 du lendemain

  if (start >= dayEndExclusive || end <= dayStart) return null

  const segStart = start < dayStart ? dayStart : start
  const segEnd = end > dayEndExclusive ? dayEndExclusive : end

  const startHour =
    (segStart.getTime() - dayStart.getTime()) / (60 * 60 * 1000)
  const endHour =
    (segEnd.getTime() - dayStart.getTime()) / (60 * 60 * 1000)

  return {
    booking: b,
    day,
    startHour,
    endHour,
    isFirstDay: isSameDay(start, day),
    isLastDay: isSameDay(end, day) || end <= dayEndExclusive,
  }
}

/**
 * Filtre + segmente une liste de bookings pour un jour donné. Pratique pour
 * `DayView.tsx` et chaque colonne de `WeekView.tsx`.
 */
export function getBookingSegmentsForDay(
  bookings: BookingWithCalendar[],
  day: Date,
): BookingDaySegment[] {
  const segments: BookingDaySegment[] = []
  for (const b of bookings) {
    const seg = getBookingDaySegment(b, day)
    if (seg) segments.push(seg)
  }
  return segments
}

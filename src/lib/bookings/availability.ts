import { addMinutes, isBefore, isAfter, parseISO } from 'date-fns'
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import type { WeekAvailability, DayOfWeek } from '@/types'

const DAY_NAMES: DayOfWeek[] = [
  'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
]

interface ExistingBooking {
  scheduled_at: string
  duration_minutes: number
  /** Si false, ce booking ne bloque pas les créneaux disponibles. */
  blocks_availability?: boolean
}

/**
 * Generate available time slots for a date range, given a calendar's
 * weekly availability and existing bookings.
 *
 * Toute la génération se fait dans `timezone` (par défaut Europe/Paris).
 * Sans ça, sur Vercel (runtime UTC), `setHours(13)` produisait un slot
 * 13:00 UTC = 15:00 CEST, alors que l'utilisateur attendait 13:00 LOCAL.
 * Résultat visible : la booking page proposait des slots qui chevauchaient
 * en fait les events bloqués côté coach (décalage de 2h en été).
 */
export function getAvailableSlots(
  availability: WeekAvailability,
  durationMinutes: number,
  bufferMinutes: number,
  existingBookings: ExistingBooking[],
  rangeStart: Date,
  rangeEnd: Date,
  timezone: string = 'Europe/Paris',
): { date: string; slots: string[] }[] {
  const now = new Date()
  const result: { date: string; slots: string[] }[] = []

  // Garde-fou : ignore les bookings marqués "disponible" (blocks_availability=false).
  const blockingBookings = existingBookings.filter(
    (b) => b.blocks_availability !== false,
  )

  // Itère jour par jour en se basant sur les dates calendaires du `timezone`.
  // L'ancre 12:00 UTC évite les sauts DST (un jour ne fait jamais < 23h ou > 25h
  // si on prend un point milieu de journée).
  const startDateStr = formatInTimeZone(rangeStart, timezone, 'yyyy-MM-dd')
  const endDateStr = formatInTimeZone(rangeEnd, timezone, 'yyyy-MM-dd')
  let cursorDay = new Date(`${startDateStr}T12:00:00Z`)
  const stopDay = new Date(`${endDateStr}T12:00:00Z`)

  while (cursorDay.getTime() <= stopDay.getTime()) {
    const dateStr = formatInTimeZone(cursorDay, timezone, 'yyyy-MM-dd')
    // Day-of-week dans la TZ cible.
    const dayIdx = new Date(`${dateStr}T12:00:00Z`).getUTCDay()
    const dayOfWeek = DAY_NAMES[dayIdx]
    const daySlots = availability[dayOfWeek] || []

    if (daySlots.length > 0) {
      const slots: string[] = []

      for (const slot of daySlots) {
        // Interprète "HH:mm" comme heure locale dans la TZ → UTC moment.
        const slotRangeStart = fromZonedTime(`${dateStr}T${slot.start}:00`, timezone)
        const slotRangeEnd = fromZonedTime(`${dateStr}T${slot.end}:00`, timezone)

        let slotStart = slotRangeStart

        while (
          isBefore(addMinutes(slotStart, durationMinutes), slotRangeEnd) ||
          addMinutes(slotStart, durationMinutes).getTime() === slotRangeEnd.getTime()
        ) {
          const candidateEnd = addMinutes(slotStart, durationMinutes)

          // Skip past slots
          if (isBefore(slotStart, now)) {
            slotStart = addMinutes(slotStart, durationMinutes + bufferMinutes)
            continue
          }

          // Check overlap with existing bookings
          const hasConflict = blockingBookings.some((b) => {
            const bStart = parseISO(b.scheduled_at)
            const bEnd = addMinutes(bStart, b.duration_minutes)
            const blockedStart = addMinutes(bStart, -bufferMinutes)
            const blockedEnd = addMinutes(bEnd, bufferMinutes)
            return isBefore(slotStart, blockedEnd) && isAfter(candidateEnd, blockedStart)
          })

          if (!hasConflict) {
            // Sortie au format HH:mm dans la TZ — c'est ce que le client affiche.
            slots.push(formatInTimeZone(slotStart, timezone, 'HH:mm'))
          }

          slotStart = addMinutes(slotStart, durationMinutes + bufferMinutes)
        }
      }

      if (slots.length > 0) {
        result.push({ date: dateStr, slots })
      }
    }

    // Avance d'un jour (24h depuis 12:00 UTC, robuste face aux DST).
    cursorDay = new Date(cursorDay.getTime() + 24 * 60 * 60 * 1000)
  }

  return result
}

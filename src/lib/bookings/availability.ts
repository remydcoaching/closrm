import {
  addMinutes, isBefore, isAfter, parseISO, format,
  setHours, setMinutes, eachDayOfInterval, getDay,
} from 'date-fns'
import type { WeekAvailability, DayOfWeek, TimeSlot } from '@/types'

const DAY_MAP: Record<number, DayOfWeek> = {
  1: 'monday', 2: 'tuesday', 3: 'wednesday', 4: 'thursday',
  5: 'friday', 6: 'saturday', 0: 'sunday',
}

interface ExistingBooking {
  scheduled_at: string
  duration_minutes: number
}

/**
 * Generate available time slots for a date range, given a calendar's
 * weekly availability and existing bookings.
 */
export function getAvailableSlots(
  availability: WeekAvailability,
  durationMinutes: number,
  bufferMinutes: number,
  existingBookings: ExistingBooking[],
  rangeStart: Date,
  rangeEnd: Date,
): { date: string; slots: string[] }[] {
  const now = new Date()
  const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd })
  const result: { date: string; slots: string[] }[] = []

  for (const day of days) {
    const dayOfWeek = DAY_MAP[getDay(day)]
    const daySlots = availability[dayOfWeek] || []
    if (daySlots.length === 0) continue

    const slots: string[] = []

    for (const slot of daySlots) {
      const [startH, startM] = slot.start.split(':').map(Number)
      const [endH, endM] = slot.end.split(':').map(Number)

      let slotStart = setMinutes(setHours(day, startH), startM)
      const slotEnd = setMinutes(setHours(day, endH), endM)

      while (isBefore(addMinutes(slotStart, durationMinutes), slotEnd) ||
             addMinutes(slotStart, durationMinutes).getTime() === slotEnd.getTime()) {
        const candidateEnd = addMinutes(slotStart, durationMinutes)

        // Skip past slots
        if (isBefore(slotStart, now)) {
          slotStart = addMinutes(slotStart, durationMinutes + bufferMinutes)
          continue
        }

        // Check overlap with existing bookings
        const hasConflict = existingBookings.some((b) => {
          const bStart = parseISO(b.scheduled_at)
          const bEnd = addMinutes(bStart, b.duration_minutes)
          // Apply buffer: expand the blocked range
          const blockedStart = addMinutes(bStart, -bufferMinutes)
          const blockedEnd = addMinutes(bEnd, bufferMinutes)
          return isBefore(slotStart, blockedEnd) && isAfter(candidateEnd, blockedStart)
        })

        if (!hasConflict) {
          slots.push(format(slotStart, 'HH:mm'))
        }

        slotStart = addMinutes(slotStart, durationMinutes + bufferMinutes)
      }
    }

    if (slots.length > 0) {
      result.push({ date: format(day, 'yyyy-MM-dd'), slots })
    }
  }

  return result
}

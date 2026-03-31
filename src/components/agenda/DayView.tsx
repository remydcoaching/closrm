'use client'

import { isSameDay, parseISO, format, getHours, getMinutes } from 'date-fns'
import { fr } from 'date-fns/locale'
import { BookingWithCalendar } from '@/types'
import { BookingBlock } from './BookingBlock'

interface DayViewProps {
  date: Date
  bookings: BookingWithCalendar[]
  onBookingClick: (booking: BookingWithCalendar) => void
  onSlotClick: (date: Date, hour: number) => void
}

const CELL_HEIGHT = 60
const START_HOUR = 7
const END_HOUR = 21
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => i + START_HOUR)
const TOTAL_HEIGHT = HOURS.length * CELL_HEIGHT

function getBookingPosition(booking: BookingWithCalendar) {
  const d = parseISO(booking.scheduled_at)
  const hour = getHours(d)
  const minutes = getMinutes(d)
  const top = (hour - START_HOUR) * CELL_HEIGHT + (minutes / 60) * CELL_HEIGHT
  const height = Math.max((booking.duration_minutes / 60) * CELL_HEIGHT, 20)
  return { top, height }
}

export function DayView({ date, bookings, onBookingClick, onSlotClick }: DayViewProps) {
  const dayBookings = bookings.filter((b) => isSameDay(parseISO(b.scheduled_at), date))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>
      {/* Day header */}
      <div style={{
        textAlign: 'center', padding: '12px 0', fontSize: 14, fontWeight: 600,
        color: 'var(--text-primary)', borderBottom: '1px solid var(--border-secondary)',
        textTransform: 'capitalize', position: 'sticky', top: 0, zIndex: 5,
        background: 'var(--bg-primary)',
      }}>
        {format(date, 'EEEE d MMMM yyyy', { locale: fr })}
      </div>

      {/* Time grid */}
      <div style={{ position: 'relative', flex: 1 }}>
        {HOURS.map((hour) => (
          <div
            key={hour}
            onClick={() => onSlotClick(date, hour)}
            style={{
              display: 'flex', height: CELL_HEIGHT, cursor: 'pointer',
              borderBottom: '1px solid var(--border-secondary)',
            }}
          >
            <div style={{
              width: 60, flexShrink: 0, textAlign: 'right', paddingRight: 8, paddingTop: 2,
              fontSize: 10, color: 'var(--text-muted)',
              borderRight: '1px solid var(--border-secondary)',
            }}>
              {String(hour).padStart(2, '0')}:00
            </div>
            <div style={{ flex: 1 }} />
          </div>
        ))}

        {/* Bookings overlay */}
        <div style={{ position: 'absolute', top: 0, left: 60, right: 0, height: TOTAL_HEIGHT, pointerEvents: 'none' }}>
          <div style={{ position: 'relative', height: '100%', pointerEvents: 'auto' }}>
            {dayBookings.map((b) => {
              const pos = getBookingPosition(b)
              return (
                <BookingBlock
                  key={b.id}
                  booking={b}
                  onClick={onBookingClick}
                  style={{ top: pos.top, height: pos.height, left: 4, right: 4 }}
                />
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

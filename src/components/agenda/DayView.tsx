import { isSameDay, getHours, parseISO, format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { BookingWithCalendar } from '@/types'
import { BookingBlock } from './BookingBlock'

interface DayViewProps {
  date: Date
  bookings: BookingWithCalendar[]
  onBookingClick: (booking: BookingWithCalendar) => void
  onSlotClick: (date: Date, hour: number) => void
}

const HOURS = Array.from({ length: 14 }, (_, i) => i + 8)

export function DayView({ date, bookings, onBookingClick, onSlotClick }: DayViewProps) {
  const dayLabel = format(date, 'EEEE d MMMM yyyy', { locale: fr })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Day header */}
      <div
        style={{
          padding: '12px 16px',
          fontWeight: 'bold',
          fontSize: 14,
          textTransform: 'capitalize',
          borderBottom: '1px solid var(--border-secondary)',
          color: 'var(--text-primary)',
        }}
      >
        {dayLabel}
      </div>

      {/* Time grid */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {HOURS.map((hour) => {
          const hourBookings = bookings.filter((booking) => {
            const bookingDate = parseISO(booking.scheduled_at)
            return isSameDay(bookingDate, date) && getHours(bookingDate) === hour
          })

          const hasBookings = hourBookings.length > 0

          return (
            <div
              key={hour}
              style={{
                display: 'flex',
                minHeight: 48,
                borderBottom: '1px solid var(--bg-input)',
              }}
            >
              {/* Hour label */}
              <div
                style={{
                  width: 60,
                  flexShrink: 0,
                  padding: '4px 8px',
                  fontSize: 11,
                  color: 'var(--text-secondary)',
                  textAlign: 'right',
                  userSelect: 'none',
                  borderRight: '1px solid var(--border-secondary)',
                }}
              >
                {String(hour).padStart(2, '0')}:00
              </div>

              {/* Booking slot */}
              <div
                style={{
                  flex: 1,
                  padding: 4,
                  cursor: hasBookings ? 'default' : 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
                onClick={() => {
                  if (!hasBookings) {
                    onSlotClick(date, hour)
                  }
                }}
              >
                {hourBookings.map((booking) => (
                  <BookingBlock
                    key={booking.id}
                    booking={booking}
                    onClick={onBookingClick}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

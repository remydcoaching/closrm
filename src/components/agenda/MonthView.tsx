import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  parseISO,
  format,
} from 'date-fns'
import { fr } from 'date-fns/locale'
import { BookingWithCalendar } from '@/types'
import { BookingBlock } from './BookingBlock'

interface MonthViewProps {
  date: Date
  bookings: BookingWithCalendar[]
  onBookingClick: (booking: BookingWithCalendar) => void
  onDayClick: (date: Date) => void
}

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const MAX_VISIBLE = 3

export function MonthView({ date, bookings, onBookingClick, onDayClick }: MonthViewProps) {
  const monthStart = startOfMonth(date)
  const monthEnd = endOfMonth(date)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })

  function bookingsForDay(day: Date): BookingWithCalendar[] {
    return bookings.filter((b) => isSameDay(parseISO(b.scheduled_at), day))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          borderBottom: '1px solid var(--border-secondary)',
        }}
      >
        {DAY_LABELS.map((label) => (
          <div
            key={label}
            style={{
              padding: '8px 0',
              textAlign: 'center',
              fontSize: 12,
              color: 'var(--text-secondary)',
              fontWeight: 600,
              textTransform: 'uppercase',
            }}
          >
            {label}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          flex: 1,
          gridAutoRows: 'minmax(80px, 1fr)',
        }}
      >
        {days.map((day) => {
          const inMonth = isSameMonth(day, date)
          const today = isToday(day)
          const dayBookings = bookingsForDay(day)
          const visible = dayBookings.slice(0, MAX_VISIBLE)
          const overflow = dayBookings.length - MAX_VISIBLE

          return (
            <div
              key={day.toISOString()}
              onClick={() => onDayClick(day)}
              style={{
                border: '1px solid var(--border-secondary)',
                padding: '4px 6px',
                cursor: 'pointer',
                opacity: inMonth ? 1 : 0.3,
                background: today ? 'rgba(229,62,62,0.05)' : 'transparent',
                minHeight: 80,
                boxSizing: 'border-box',
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
            >
              {/* Day number */}
              <div
                style={{
                  fontSize: 12,
                  fontWeight: today ? 700 : 400,
                  color: today ? '#E53E3E' : 'var(--text-primary)',
                  marginBottom: 2,
                  lineHeight: 1,
                }}
              >
                {format(day, 'd', { locale: fr })}
              </div>

              {/* Booking blocks */}
              {visible.map((booking) => (
                <BookingBlock
                  key={booking.id}
                  booking={booking}
                  onClick={(b) => {
                    // stop click from bubbling to day cell
                    onBookingClick(b)
                  }}
                  compact
                />
              ))}

              {/* Overflow indicator */}
              {overflow > 0 && (
                <div
                  style={{
                    fontSize: 10,
                    color: 'var(--text-secondary)',
                    marginTop: 1,
                  }}
                >
                  +{overflow} autre{overflow > 1 ? 's' : ''}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

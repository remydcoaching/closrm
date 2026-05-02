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

interface MonthViewProps {
  date: Date
  bookings: BookingWithCalendar[]
  onBookingClick: (booking: BookingWithCalendar) => void
  onDayClick: (date: Date) => void
}

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

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
          const overflow = dayBookings.length - 3

          return (
            <div
              key={day.toISOString()}
              onClick={() => onDayClick(day)}
              style={{
                border: '1px solid var(--border-secondary)',
                padding: '4px 6px',
                cursor: 'pointer',
                opacity: inMonth ? 1 : 0.3,
                background: today ? 'color-mix(in srgb, var(--color-primary) 5%, transparent)' : 'transparent',
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
                  color: today ? 'var(--color-primary)' : 'var(--text-primary)',
                  marginBottom: 2,
                  lineHeight: 1,
                }}
              >
                {format(day, 'd', { locale: fr })}
              </div>

              {/* Booking blocks */}
              {dayBookings.slice(0, 3).map((b) => {
                const color = b.is_personal ? '#6b7280' : b.booking_calendar?.color || '#3b82f6'
                const title = b.lead ? `${b.lead.first_name} ${b.lead.last_name}`.trim() : b.title
                return (
                  <div
                    key={b.id}
                    onClick={(e) => { e.stopPropagation(); onBookingClick(b) }}
                    style={{
                      background: color, color: '#fff', padding: '1px 4px', borderRadius: 2,
                      fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      marginBottom: 1, cursor: 'pointer',
                    }}
                  >
                    <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                      {format(parseISO(b.scheduled_at), 'HH:mm')}
                    </span>{' '}{title}
                  </div>
                )
              })}

              {/* Overflow indicator — clicking opens the day view so events are not silently lost */}
              {overflow > 0 && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onDayClick(day) }}
                  style={{
                    fontSize: 10,
                    color: 'var(--text-secondary)',
                    marginTop: 1,
                    background: 'transparent',
                    border: 'none',
                    padding: '1px 4px',
                    borderRadius: 2,
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontWeight: 500,
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)' }}
                >
                  +{overflow} autre{overflow > 1 ? 's' : ''}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

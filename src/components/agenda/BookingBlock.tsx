import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { MapPin } from 'lucide-react'
import { BookingWithCalendar } from '@/types'

interface BookingBlockProps {
  booking: BookingWithCalendar
  onClick: (booking: BookingWithCalendar) => void
  compact?: boolean
}

export function BookingBlock({ booking, onClick, compact = false }: BookingBlockProps) {
  const color = booking.booking_calendar?.color ?? '#6b7280'

  const displayTitle = booking.lead
    ? `${booking.lead.first_name} ${booking.lead.last_name}`.trim()
    : booking.title

  const startTime = format(parseISO(booking.scheduled_at), 'HH:mm', { locale: fr })

  if (compact) {
    return (
      <div
        onClick={() => onClick(booking)}
        style={{
          background: color,
          color: '#ffffff',
          padding: '2px 6px',
          borderRadius: 3,
          fontSize: 10,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          cursor: 'pointer',
        }}
        title={displayTitle}
      >
        {startTime} {displayTitle}
      </div>
    )
  }

  return (
    <div
      onClick={() => onClick(booking)}
      style={{
        background: `${color}22`,
        borderLeft: `3px solid ${color}`,
        color: '#ffffff',
        padding: '4px 8px',
        cursor: 'pointer',
      }}
    >
      <div style={{ fontWeight: 'bold', fontSize: 13 }}>{displayTitle}</div>
      {booking.booking_calendar?.name && (
        <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>
          {booking.booking_calendar.name}
        </div>
      )}
      {booking.booking_calendar?.location && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, opacity: 0.7, marginTop: 2 }}>
          <MapPin size={10} />
          {booking.booking_calendar.location}
        </div>
      )}
    </div>
  )
}

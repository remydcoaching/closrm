'use client'

import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { X, MapPin, Clock, Calendar, User, Trash2 } from 'lucide-react'
import { BookingWithCalendar, BookingStatus } from '@/types'

interface BookingDetailPanelProps {
  booking: BookingWithCalendar
  onClose: () => void
  onDelete: (id: string) => void
  onStatusChange: (id: string, status: string) => void
}

const STATUS_CONFIG: Record<BookingStatus, { label: string; color: string; bg: string }> = {
  confirmed: { label: 'Confirmé', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  completed: { label: 'Terminé', color: '#38A169', bg: 'rgba(56,161,105,0.12)' },
  cancelled: { label: 'Annulé', color: '#E53E3E', bg: 'rgba(229,62,62,0.12)' },
  no_show: { label: 'Absent', color: '#D69E2E', bg: 'rgba(214,158,46,0.12)' },
}

export function BookingDetailPanel({
  booking,
  onClose,
  onDelete,
  onStatusChange,
}: BookingDetailPanelProps) {
  const color = booking.booking_calendar?.color ?? '#6b7280'

  const startDate = parseISO(booking.scheduled_at)
  const formattedDate = format(startDate, 'EEEE d MMMM yyyy', { locale: fr })
  const formattedTime = format(startDate, 'HH:mm', { locale: fr })

  const displayTitle = booking.lead
    ? `${booking.lead.first_name} ${booking.lead.last_name}`.trim()
    : booking.title

  return (
    <div
      style={{
        position: 'fixed',
        right: 0,
        top: 0,
        bottom: 0,
        width: 360,
        background: '#141416',
        borderLeft: '1px solid #262626',
        zIndex: 40,
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
      }}
    >
      {/* Color bar + title + close */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 24 }}>
        <div
          style={{
            width: 4,
            minHeight: 40,
            borderRadius: 2,
            background: color,
            flexShrink: 0,
            marginTop: 2,
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: '#FFFFFF',
              lineHeight: 1.3,
              wordBreak: 'break-word',
            }}
          >
            {displayTitle}
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#A0A0A0',
            display: 'flex',
            alignItems: 'center',
            padding: 2,
            flexShrink: 0,
          }}
          aria-label="Fermer"
        >
          <X size={18} />
        </button>
      </div>

      {/* Details */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
        {/* Date */}
        <DetailRow icon={<Calendar size={15} />} label="Date">
          <span style={{ textTransform: 'capitalize' }}>{formattedDate}</span>
        </DetailRow>

        {/* Time + duration */}
        <DetailRow icon={<Clock size={15} />} label="Heure">
          {formattedTime} · {booking.duration_minutes} min
        </DetailRow>

        {/* Location */}
        {booking.booking_calendar?.location && (
          <DetailRow icon={<MapPin size={15} />} label="Lieu">
            {booking.booking_calendar.location}
          </DetailRow>
        )}

        {/* Lead */}
        {booking.lead && (
          <DetailRow icon={<User size={15} />} label="Lead">
            <div>
              <div style={{ color: '#FFFFFF', fontSize: 13 }}>
                {booking.lead.first_name} {booking.lead.last_name}
              </div>
              {booking.lead.phone && (
                <div style={{ color: '#A0A0A0', fontSize: 12, marginTop: 2 }}>
                  {booking.lead.phone}
                </div>
              )}
            </div>
          </DetailRow>
        )}

        {/* Calendar name */}
        {booking.booking_calendar?.name && (
          <DetailRow icon={<Calendar size={15} />} label="Calendrier">
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: color,
                  flexShrink: 0,
                }}
              />
              {booking.booking_calendar.name}
            </span>
          </DetailRow>
        )}

        {/* Notes */}
        {booking.notes && (
          <div>
            <div style={{ fontSize: 12, color: '#A0A0A0', marginBottom: 6 }}>Notes</div>
            <div
              style={{
                background: '#1a1a1c',
                border: '1px solid #262626',
                borderRadius: 8,
                padding: '10px 12px',
                fontSize: 13,
                color: '#A0A0A0',
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {booking.notes}
            </div>
          </div>
        )}

        {/* Status buttons */}
        <div>
          <div style={{ fontSize: 12, color: '#A0A0A0', marginBottom: 8 }}>Statut</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {(Object.entries(STATUS_CONFIG) as [BookingStatus, typeof STATUS_CONFIG[BookingStatus]][]).map(
              ([status, cfg]) => {
                const active = booking.status === status
                return (
                  <button
                    key={status}
                    onClick={() => onStatusChange(booking.id, status)}
                    style={{
                      padding: '7px 10px',
                      borderRadius: 8,
                      border: `1px solid ${active ? cfg.color : '#262626'}`,
                      background: active ? cfg.bg : 'transparent',
                      color: active ? cfg.color : '#A0A0A0',
                      fontSize: 12,
                      fontWeight: active ? 600 : 400,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {cfg.label}
                  </button>
                )
              }
            )}
          </div>
        </div>
      </div>

      {/* Delete button */}
      <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid #262626' }}>
        <button
          onClick={() => onDelete(booking.id)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            width: '100%',
            padding: '8px 0',
            borderRadius: 8,
            border: '1px solid #E53E3E',
            background: 'transparent',
            color: '#E53E3E',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(229,62,62,0.08)'
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
          }}
        >
          <Trash2 size={14} />
          Supprimer ce RDV
        </button>
      </div>
    </div>
  )
}

// ── Helper ────────────────────────────────────────────────────────────────────

function DetailRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <div style={{ color: '#A0A0A0', marginTop: 1, flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, color: '#666', marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 13, color: '#FFFFFF' }}>{children}</div>
      </div>
    </div>
  )
}

'use client'

import Link from 'next/link'
import { BookingCalendar } from '@/types'

interface CalendarCardProps {
  calendar: BookingCalendar
  workspaceSlug: string | null
  onToggleActive: (id: string, active: boolean) => void
  onDelete: (id: string) => void
}

export default function CalendarCard({
  calendar,
  workspaceSlug,
  onToggleActive,
  onDelete,
}: CalendarCardProps) {
  const bookingUrl =
    workspaceSlug
      ? `${typeof window !== 'undefined' ? window.location.origin : ''}/book/${workspaceSlug}/${calendar.slug}`
      : null

  function handleCopyUrl() {
    if (bookingUrl) navigator.clipboard.writeText(bookingUrl)
  }

  return (
    <div
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-primary)',
        borderRadius: 10,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {/* Header: color dot + name + active toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: calendar.color,
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{calendar.name}</span>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={calendar.is_active}
            onChange={e => onToggleActive(calendar.id, e.target.checked)}
            style={{ accentColor: '#E53E3E', width: 14, height: 14, cursor: 'pointer' }}
          />
          <span style={{ fontSize: 12, color: calendar.is_active ? '#38A169' : 'var(--text-secondary)' }}>
            {calendar.is_active ? 'Actif' : 'Inactif'}
          </span>
        </label>
      </div>

      {/* Description */}
      {calendar.description && (
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
          {calendar.description}
        </p>
      )}

      {/* Duration + Location */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Clock icon */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{calendar.duration_minutes} min</span>
        </div>
      </div>

      {/* Booking URL */}
      {bookingUrl && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'var(--bg-hover)',
            border: '1px solid var(--border-primary)',
            borderRadius: 6,
            padding: '6px 10px',
          }}
        >
          <span
            style={{
              fontSize: 12,
              color: 'var(--text-secondary)',
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {bookingUrl}
          </span>
          <button
            onClick={handleCopyUrl}
            style={{
              background: 'none',
              border: '1px solid var(--border-primary)',
              borderRadius: 4,
              padding: '2px 8px',
              fontSize: 11,
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            Copier
          </button>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
        <Link
          href={`/parametres/calendriers/${calendar.id}`}
          style={{
            fontSize: 13,
            color: 'var(--text-secondary)',
            textDecoration: 'none',
            padding: '5px 12px',
            border: '1px solid var(--border-primary)',
            borderRadius: 6,
          }}
        >
          Modifier
        </Link>
        <button
          onClick={() => onDelete(calendar.id)}
          style={{
            fontSize: 13,
            color: '#ef4444',
            background: 'none',
            border: '1px solid rgba(239,68,68,0.25)',
            borderRadius: 6,
            padding: '5px 12px',
            cursor: 'pointer',
          }}
        >
          Supprimer
        </button>
      </div>
    </div>
  )
}

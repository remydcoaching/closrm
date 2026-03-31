'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Clock, Copy, Check, ExternalLink, Settings, Trash2 } from 'lucide-react'
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
  const [copied, setCopied] = useState(false)

  const bookingUrl =
    workspaceSlug
      ? `${typeof window !== 'undefined' ? window.location.origin : ''}/book/${workspaceSlug}/${calendar.slug}`
      : null

  function handleCopyUrl() {
    if (!bookingUrl) return
    navigator.clipboard.writeText(bookingUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-primary)',
        borderRadius: 12,
        padding: 0,
        overflow: 'hidden',
        transition: 'border-color 0.15s ease',
      }}
    >
      {/* Color bar top */}
      <div style={{ height: 3, background: calendar.color }} />

      <div style={{ padding: '16px 18px' }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: calendar.color,
                flexShrink: 0,
              }}
            />
            <span style={{
              fontSize: 15,
              fontWeight: 600,
              color: 'var(--text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {calendar.name}
            </span>
          </div>

          {/* Toggle */}
          <button
            onClick={() => onToggleActive(calendar.id, !calendar.is_active)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '3px 10px',
              borderRadius: 20,
              border: 'none',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              background: calendar.is_active ? 'rgba(56,161,105,0.1)' : 'var(--bg-hover)',
              color: calendar.is_active ? '#38A169' : 'var(--text-muted)',
            }}
          >
            <div style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: calendar.is_active ? '#38A169' : 'var(--text-muted)',
            }} />
            {calendar.is_active ? 'Actif' : 'Inactif'}
          </button>
        </div>

        {/* Description */}
        {calendar.description && (
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 12px', lineHeight: 1.5 }}>
            {calendar.description}
          </p>
        )}

        {/* Meta row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <Clock size={13} style={{ color: 'var(--text-muted)' }} />
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{calendar.duration_minutes} min</span>
          </div>
        </div>

        {/* Booking URL */}
        {bookingUrl && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'var(--bg-secondary)',
              borderRadius: 6,
              padding: '7px 10px',
              marginBottom: 14,
            }}
          >
            <ExternalLink size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <span
              style={{
                fontSize: 11,
                color: 'var(--text-tertiary)',
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontFamily: 'monospace',
              }}
            >
              {bookingUrl}
            </span>
            <button
              onClick={handleCopyUrl}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                background: 'none',
                border: 'none',
                padding: '2px 6px',
                borderRadius: 4,
                fontSize: 11,
                color: copied ? 'var(--color-primary)' : 'var(--text-secondary)',
                cursor: 'pointer',
                flexShrink: 0,
                fontWeight: 500,
              }}
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? 'Copié' : 'Copier'}
            </button>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderTop: '1px solid var(--border-primary)', paddingTop: 12 }}>
          <Link
            href={`/parametres/calendriers/${calendar.id}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--text-secondary)',
              textDecoration: 'none',
              padding: '5px 12px',
              borderRadius: 6,
              border: '1px solid var(--border-secondary)',
              background: 'var(--bg-hover)',
              transition: 'border-color 0.15s ease',
            }}
          >
            <Settings size={12} />
            Modifier
          </Link>
          <button
            onClick={() => onDelete(calendar.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 12,
              fontWeight: 500,
              color: '#ef4444',
              background: 'none',
              border: '1px solid rgba(239,68,68,0.15)',
              borderRadius: 6,
              padding: '5px 12px',
              cursor: 'pointer',
              transition: 'border-color 0.15s ease',
            }}
          >
            <Trash2 size={12} />
            Supprimer
          </button>
        </div>
      </div>
    </div>
  )
}

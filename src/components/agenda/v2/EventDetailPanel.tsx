'use client'

/**
 * Panneau détail event (Phase 3b). 380px de large à droite, push le contenu
 * principal au lieu de l'overlay (sur desktop). Le parent gère le rendu
 * conditionnel selon `selectedEvent`.
 *
 * Phase 3b : actions minimales — close, voir fiche lead, supprimer (booking
 * uniquement). Status changes + reschedule UI viennent en Phase 3c/4 (pour
 * éviter de gonfler la PR).
 *
 * Calls : affichage info uniquement, pas d'actions destructives ici (le call
 * a sa propre UI dans /closing).
 */

import { addMinutes, format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { ExternalLink, Mail, MapPin, Phone, Trash2, Video, X } from 'lucide-react'
import Link from 'next/link'
import type { AgendaEvent } from '@/types/agenda'
import { eventStatus } from '@/types/agenda'
import { Z_AGENDA } from '@/lib/agenda/z-index'

interface EventDetailPanelProps {
  event: AgendaEvent
  onClose: () => void
  onDelete?: (event: AgendaEvent) => void
}

const STATUS_LABELS: Record<ReturnType<typeof eventStatus>, { label: string; color: string }> = {
  confirmed: { label: 'Confirmé', color: '#22c55e' },
  completed: { label: 'Terminé', color: '#3b82f6' },
  cancelled: { label: 'Annulé', color: '#ef4444' },
  no_show: { label: 'No-show', color: '#f59e0b' },
}

export function EventDetailPanel({ event, onClose, onDelete }: EventDetailPanelProps) {
  const start = parseISO(event.start)
  const end = addMinutes(start, event.durationMinutes)
  const status = eventStatus(event)
  const statusMeta = STATUS_LABELS[status]
  const lead = event.lead
  const isBooking = event.kind === 'booking'
  const meetUrl = isBooking ? event.booking.meet_url : null
  const location = isBooking ? event.booking.location : null
  const notes = isBooking ? event.booking.notes : event.call.notes

  return (
    <aside
      style={{
        width: 380,
        flexShrink: 0,
        height: '100%',
        background: 'var(--bg-secondary)',
        borderLeft: '1px solid var(--border-secondary)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: Z_AGENDA.detailPanel,
      }}
      aria-label="Détail de l'événement"
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 8,
          padding: '14px 16px',
          borderBottom: '1px solid var(--agenda-grid-line)',
          flexShrink: 0,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: 4,
            }}
          >
            <span
              style={{ width: 8, height: 8, borderRadius: 2, background: event.color, flexShrink: 0 }}
              aria-hidden
            />
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {event.title}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
            {event.subtitle && (
              <span style={{ color: 'var(--text-tertiary)' }}>{event.subtitle}</span>
            )}
            <span
              style={{
                color: statusMeta.color,
                background: `color-mix(in srgb, ${statusMeta.color} 14%, transparent)`,
                padding: '1px 8px',
                borderRadius: 4,
                fontWeight: 600,
              }}
            >
              {statusMeta.label}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-secondary)',
            padding: 4,
            borderRadius: 4,
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Body scrollable */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Date / heure */}
        <Section>
          <Row>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
              {format(start, 'EEEE d MMMM yyyy', { locale: fr })}
            </span>
          </Row>
          <Row>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
              {format(start, 'HH:mm')} — {format(end, 'HH:mm')}{' '}
              <span style={{ color: 'var(--text-tertiary)' }}>({event.durationMinutes} min)</span>
            </span>
          </Row>
        </Section>

        {/* Lieu / Meet */}
        {(meetUrl || location) && (
          <Section title="Lieu">
            {meetUrl && (
              <Row>
                <Video size={14} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                <a
                  href={meetUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    fontSize: 13,
                    color: 'var(--color-primary)',
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  Ouvrir Google Meet <ExternalLink size={12} />
                </a>
              </Row>
            )}
            {location && (
              <Row>
                <MapPin size={14} style={{ color: 'var(--text-secondary)', flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{location.name}</div>
                  {location.address && (
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                      {location.address}
                    </div>
                  )}
                </div>
              </Row>
            )}
          </Section>
        )}

        {/* Lead */}
        {lead && (
          <Section title="Lead">
            <Row>
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                {lead.first_name} {lead.last_name}
              </span>
            </Row>
            {lead.email && (
              <Row>
                <Mail size={13} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                <a
                  href={`mailto:${lead.email}`}
                  style={{ fontSize: 12, color: 'var(--text-secondary)', textDecoration: 'none' }}
                >
                  {lead.email}
                </a>
              </Row>
            )}
            {lead.phone && (
              <Row>
                <Phone size={13} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                <a
                  href={`tel:${lead.phone}`}
                  style={{ fontSize: 12, color: 'var(--text-secondary)', textDecoration: 'none' }}
                >
                  {lead.phone}
                </a>
              </Row>
            )}
            <Link
              href={`/leads/${lead.id}`}
              style={{
                fontSize: 12,
                color: 'var(--color-primary)',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                marginTop: 4,
              }}
            >
              Voir la fiche complète <ExternalLink size={11} />
            </Link>
          </Section>
        )}

        {/* Notes */}
        {notes && notes.trim().length > 0 && (
          <Section title="Notes">
            <p
              style={{
                fontSize: 13,
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
                margin: 0,
              }}
            >
              {notes}
            </p>
          </Section>
        )}
      </div>

      {/* Actions footer */}
      {isBooking && onDelete && (
        <div
          style={{
            display: 'flex',
            gap: 8,
            padding: 12,
            borderTop: '1px solid var(--agenda-grid-line)',
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={() => {
              if (confirm(`Supprimer "${event.title}" ?`)) onDelete(event)
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 12px',
              borderRadius: 6,
              border: '1px solid var(--border-secondary)',
              background: 'transparent',
              color: '#ef4444',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            <Trash2 size={13} /> Supprimer
          </button>
        </div>
      )}
    </aside>
  )
}

function Section({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {title && (
        <div
          style={{
            fontSize: 10,
            color: 'var(--text-tertiary)',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            fontWeight: 600,
          }}
        >
          {title}
        </div>
      )}
      {children}
    </div>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
      {children}
    </div>
  )
}

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

import { useEffect, useState } from 'react'
import { addMinutes, format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Check, ExternalLink, Mail, MapPin, Pencil, Phone, Repeat, Trash2, Video, X, XCircle, UserX } from 'lucide-react'
import Link from 'next/link'
import type { AgendaEvent } from '@/types/agenda'
import type { BookingStatus } from '@/types'
import { eventStatus } from '@/types/agenda'
import { Z_AGENDA } from '@/lib/agenda/z-index'

type DeleteScope = 'this' | 'future' | 'all'

export interface BookingPatch {
  title?: string
  scheduled_at?: string
  duration_minutes?: number
  notes?: string | null
}

interface EventDetailPanelProps {
  event: AgendaEvent
  onClose: () => void
  onDelete?: (event: AgendaEvent, scope?: DeleteScope) => void
  onStatusChange?: (event: AgendaEvent, status: BookingStatus) => void
  /** Sauvegarde inline d'une édition partielle. Si non fourni, le bouton
   *  Modifier est masqué. */
  onSave?: (event: AgendaEvent, patch: BookingPatch) => void | Promise<void>
}

const STATUS_LABELS: Record<ReturnType<typeof eventStatus>, { label: string; color: string }> = {
  confirmed: { label: 'Confirmé', color: '#22c55e' },
  completed: { label: 'Terminé', color: '#3b82f6' },
  cancelled: { label: 'Annulé', color: '#ef4444' },
  no_show: { label: 'No-show', color: '#f59e0b' },
}

// Options time-picker en pas de 15min, 00:00 → 23:45
const TIME_OPTIONS = Array.from({ length: 24 * 4 }, (_, i) => {
  const totalMin = i * 15
  return `${String(Math.floor(totalMin / 60)).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`
})

const timeSelectStyle: React.CSSProperties = {
  background: 'var(--bg-input)',
  border: '1px solid var(--border-secondary)',
  borderRadius: 6,
  padding: '6px 8px',
  color: 'var(--text-primary)',
  fontSize: 13,
  fontFamily: 'inherit',
  fontVariantNumeric: 'tabular-nums',
  colorScheme: 'dark',
  outline: 'none',
  cursor: 'pointer',
}

function formatDur(minutes: number): string {
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`
  }
  return `${minutes} min`
}

export function EventDetailPanel({ event, onClose, onDelete, onStatusChange, onSave }: EventDetailPanelProps) {
  const start = parseISO(event.start)
  const end = addMinutes(start, event.durationMinutes)
  const status = eventStatus(event)
  const statusMeta = STATUS_LABELS[status]
  const lead = event.lead
  const isBooking = event.kind === 'booking'
  const isPersonal = isBooking && event.booking.is_personal
  // Les statuts (Confirmé / Terminé / Annulé / No-show) n'ont de sens que pour
  // les RDV liés à un lead ou les appels (setting/closing). Les horaires
  // bloqués perso (Repas, Organisation, etc.) n'ont pas à exposer ces actions.
  const hasStatus = !isPersonal
  const meetUrl = isBooking ? event.booking.meet_url : null
  const location = isBooking ? event.booking.location : null
  const notes = isBooking ? event.booking.notes : event.call.notes
  const isRecurring = isBooking && Boolean(event.booking.recurrence_group_id)
  const [showDeleteScope, setShowDeleteScope] = useState(false)

  // ── Édition inline (uniquement bookings) ──
  // Pas de modal — tout se passe dans le panel.
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(event.title)
  const [editDate, setEditDate] = useState(format(start, 'yyyy-MM-dd'))
  const [editStartTime, setEditStartTime] = useState(format(start, 'HH:mm'))
  const [editEndTime, setEditEndTime] = useState(format(end, 'HH:mm'))
  const [editNotes, setEditNotes] = useState(notes ?? '')

  // Reset les champs quand on change d'event sélectionné
  useEffect(() => {
    setIsEditing(false)
    setEditTitle(event.title)
    setEditDate(format(start, 'yyyy-MM-dd'))
    setEditStartTime(format(start, 'HH:mm'))
    setEditEndTime(format(end, 'HH:mm'))
    setEditNotes(notes ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.id])

  function timeToMin(t: string): number {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + m
  }
  const editDuration = Math.max(15, timeToMin(editEndTime) - timeToMin(editStartTime))

  async function handleSaveEdit() {
    if (!onSave) return
    const local = new Date(`${editDate}T${editStartTime}:00`)
    const patch: BookingPatch = {
      title: editTitle.trim() || event.title,
      scheduled_at: local.toISOString(),
      duration_minutes: editDuration,
      notes: editNotes.trim() ? editNotes : null,
    }
    await onSave(event, patch)
    setIsEditing(false)
  }

  function handleCancelEdit() {
    setEditTitle(event.title)
    setEditDate(format(start, 'yyyy-MM-dd'))
    setEditStartTime(format(start, 'HH:mm'))
    setEditEndTime(format(end, 'HH:mm'))
    setEditNotes(notes ?? '')
    setIsEditing(false)
  }

  const canEdit = isBooking && Boolean(onSave)

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
            {isEditing ? (
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Titre"
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--text-primary)',
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: 'inherit',
                  flex: 1,
                  minWidth: 0,
                  padding: 0,
                }}
                autoFocus
              />
            ) : (
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {event.title}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, flexWrap: 'wrap' }}>
            {event.subtitle && (
              <span style={{ color: 'var(--text-tertiary)' }}>{event.subtitle}</span>
            )}
            {hasStatus && (
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
            )}
            {isRecurring && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  color: 'var(--text-tertiary)',
                  background: 'var(--bg-hover)',
                  padding: '1px 8px',
                  borderRadius: 4,
                  fontWeight: 500,
                }}
                title="Cet événement fait partie d'une série récurrente"
              >
                <Repeat size={11} /> Récurrent
              </span>
            )}
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
        {/* Date / heure — éditable inline */}
        <Section>
          {isEditing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-secondary)',
                  borderRadius: 6,
                  padding: '6px 8px',
                  color: 'var(--text-primary)',
                  fontSize: 13,
                  fontFamily: 'inherit',
                  colorScheme: 'dark',
                  outline: 'none',
                  width: '100%',
                }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <select
                  value={editStartTime}
                  onChange={(e) => {
                    const newStart = e.target.value
                    // shift end avec la même durée
                    const dur = timeToMin(editEndTime) - timeToMin(editStartTime)
                    setEditStartTime(newStart)
                    const totalEnd = timeToMin(newStart) + Math.max(15, dur)
                    const eh = Math.floor(totalEnd / 60) % 24
                    const em = totalEnd % 60
                    setEditEndTime(`${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`)
                  }}
                  style={timeSelectStyle}
                >
                  {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <span style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>→</span>
                <select
                  value={editEndTime}
                  onChange={(e) => setEditEndTime(e.target.value)}
                  style={timeSelectStyle}
                >
                  {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <span style={{ color: 'var(--text-tertiary)', fontSize: 11, marginLeft: 4 }}>
                  · {formatDur(editDuration)}
                </span>
              </div>
            </div>
          ) : (
            <>
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
            </>
          )}
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

        {/* Notes — éditables inline */}
        {isEditing ? (
          <Section title="Notes">
            <textarea
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              rows={4}
              placeholder="Notes…"
              style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--border-secondary)',
                borderRadius: 6,
                padding: '8px 10px',
                color: 'var(--text-primary)',
                fontSize: 13,
                fontFamily: 'inherit',
                lineHeight: 1.5,
                resize: 'vertical',
                outline: 'none',
                width: '100%',
                minHeight: 60,
              }}
            />
          </Section>
        ) : (
          notes && notes.trim().length > 0 && (
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
          )
        )}

        {/* Status change — RDV avec lead ou call uniquement (pas pour perso) */}
        {isBooking && hasStatus && onStatusChange && (
          <Section title="Statut">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <StatusButton
                active={status === 'confirmed'}
                color={STATUS_LABELS.confirmed.color}
                label="Confirmé"
                icon={<Check size={12} />}
                onClick={() => onStatusChange(event, 'confirmed')}
              />
              <StatusButton
                active={status === 'completed'}
                color={STATUS_LABELS.completed.color}
                label="Terminé"
                icon={<Check size={12} />}
                onClick={() => onStatusChange(event, 'completed')}
              />
              <StatusButton
                active={status === 'cancelled'}
                color={STATUS_LABELS.cancelled.color}
                label="Annulé"
                icon={<XCircle size={12} />}
                onClick={() => onStatusChange(event, 'cancelled')}
              />
              <StatusButton
                active={status === 'no_show'}
                color={STATUS_LABELS.no_show.color}
                label="No-show"
                icon={<UserX size={12} />}
                onClick={() => onStatusChange(event, 'no_show')}
              />
            </div>
          </Section>
        )}
      </div>

      {/* Picker scope de suppression — apparaît au-dessus du footer pour une série */}
      {showDeleteScope && onDelete && (
        <div
          role="dialog"
          aria-label="Choisir l'étendue de la suppression"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            padding: '12px 14px 8px',
            borderTop: '1px solid var(--agenda-grid-line)',
            background: 'var(--bg-elevated)',
            flexShrink: 0,
          }}
        >
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
            Cet événement fait partie d&apos;une série. Que veux-tu supprimer ?
          </div>
          <ScopeButton
            label="Cet événement uniquement"
            onClick={() => { setShowDeleteScope(false); onDelete(event, 'this') }}
          />
          <ScopeButton
            label="Cet événement et les suivants"
            onClick={() => { setShowDeleteScope(false); onDelete(event, 'future') }}
          />
          <ScopeButton
            label="Toute la série"
            onClick={() => { setShowDeleteScope(false); onDelete(event, 'all') }}
            danger
          />
          <button
            type="button"
            onClick={() => setShowDeleteScope(false)}
            style={{
              alignSelf: 'flex-end',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-tertiary)',
              fontSize: 11,
              padding: '4px 6px',
              cursor: 'pointer',
              marginTop: 2,
            }}
          >
            Annuler
          </button>
        </div>
      )}

      {/* Actions footer — bascule entre mode lecture et mode édition */}
      {isBooking && (onDelete || canEdit) && (
        <div
          style={{
            display: 'flex',
            gap: 8,
            padding: 12,
            borderTop: '1px solid var(--agenda-grid-line)',
            flexShrink: 0,
          }}
        >
          {isEditing ? (
            <>
              <button
                type="button"
                onClick={handleCancelEdit}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 12px',
                  borderRadius: 6,
                  border: '1px solid var(--border-secondary)',
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: '8px 12px',
                  borderRadius: 6,
                  border: 'none',
                  background: 'var(--color-primary)',
                  color: '#000',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Check size={13} /> Enregistrer
              </button>
            </>
          ) : (
            <>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: 'none',
                    background: 'var(--color-primary)',
                    color: '#000',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <Pencil size={13} /> Modifier
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  onClick={() => {
                    if (isRecurring) {
                      setShowDeleteScope(true)
                    } else if (confirm(`Supprimer "${event.title}" ?`)) {
                      onDelete(event)
                    }
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
              )}
            </>
          )}
        </div>
      )}
    </aside>
  )
}

function StatusButton({
  active,
  color,
  label,
  icon,
  onClick,
}: {
  active: boolean
  color: string
  label: string
  icon: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={active}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        padding: '5px 10px',
        borderRadius: 6,
        border: `1px solid ${active ? color : 'var(--border-secondary)'}`,
        background: active ? `color-mix(in srgb, ${color} 16%, transparent)` : 'transparent',
        color: active ? color : 'var(--text-secondary)',
        fontSize: 11,
        fontWeight: active ? 600 : 500,
        cursor: active ? 'default' : 'pointer',
      }}
      onMouseEnter={(e) => {
        if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'
      }}
      onMouseLeave={(e) => {
        if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'
      }}
    >
      {icon}
      {label}
    </button>
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

function ScopeButton({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        padding: '8px 10px',
        borderRadius: 6,
        border: '1px solid var(--border-secondary)',
        background: 'transparent',
        color: danger ? '#ef4444' : 'var(--text-primary)',
        fontSize: 12,
        fontWeight: 500,
        cursor: 'pointer',
        textAlign: 'left',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
    >
      {label}
    </button>
  )
}

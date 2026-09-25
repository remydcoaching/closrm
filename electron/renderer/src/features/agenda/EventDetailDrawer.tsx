// Detail panel — port of components/agenda/v2/EventDetailPanel in a Drawer.
// Inline editing with auto-save (title/notes on blur, date/time/color/
// availability on change), status actions, confirm for pending bookings,
// deletion (with recurrence scope), lead block linking to /leads/:id.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Drawer } from '../../design-system/Drawer'
import { StatusPill } from '../../design-system/StatusPill'
import { Button } from '../../design-system/Button'
import { safeExternalUrl } from '../../lib/safe-url'
import {
  BOOKING_COLOR_PALETTE,
  QUARTER_TIMES,
  STATUS_META,
  addMinutes,
  eventStatus,
  formatDuration,
  formatLongDate,
  localToIso,
  timeToMinutes,
  toDateInput,
  toTimeInput,
} from './agenda-utils'
import type { AgendaEvent, BookingPatch, BookingStatus, DeleteScope } from './types'

interface Props {
  event: AgendaEvent
  onClose: () => void
  onSave: (ev: AgendaEvent, patch: BookingPatch) => void
  onStatusChange: (ev: AgendaEvent, status: BookingStatus) => void
  onDelete: (ev: AgendaEvent, scope: DeleteScope) => void
}

const STATUS_ACTIONS: BookingStatus[] = ['confirmed', 'completed', 'cancelled', 'no_show']

function openExternal(url: string) {
  const safe = safeExternalUrl(url)
  if (!safe) return
  if (window.closrm?.openExternal) void window.closrm.openExternal(safe)
  else window.open(safe, '_blank', 'noopener,noreferrer')
}

export function EventDetailDrawer({ event, onClose, onSave, onStatusChange, onDelete }: Props) {
  const navigate = useNavigate()
  const start = new Date(event.start)
  const end = addMinutes(start, event.durationMinutes)
  const status = eventStatus(event)
  const isBooking = event.kind === 'booking'
  const booking = event.kind === 'booking' ? event.booking : null
  const isPersonal = Boolean(booking?.is_personal)
  const isRecurring = Boolean(booking?.recurrence_group_id)
  const canEdit = isBooking
  const notes = booking ? booking.notes : event.kind === 'call' ? event.call.notes : null
  const lead = event.lead

  const [title, setTitle] = useState(event.title)
  const [date, setDate] = useState(toDateInput(start))
  const [startTime, setStartTime] = useState(toTimeInput(start))
  const [endTime, setEndTime] = useState(toTimeInput(end))
  const [editNotes, setEditNotes] = useState(notes ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    const s = new Date(event.start)
    setTitle(event.title)
    setDate(toDateInput(s))
    setStartTime(toTimeInput(s))
    setEndTime(toTimeInput(addMinutes(s, event.durationMinutes)))
    setEditNotes(notes ?? '')
    setConfirmDelete(false)
    // Reset only when switching to another event.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.id])

  const duration = Math.max(15, timeToMinutes(endTime) - timeToMinutes(startTime))

  function saveDateTime(nextDate: string, nextStart: string, nextEnd: string) {
    const dur = Math.max(15, timeToMinutes(nextEnd) - timeToMinutes(nextStart))
    onSave(event, { scheduled_at: localToIso(nextDate, nextStart), duration_minutes: dur })
  }

  function saveTitle() {
    const next = title.trim() || event.title
    if (next !== event.title) onSave(event, { title: next })
    else setTitle(event.title)
  }

  function saveNotes() {
    const next = editNotes.trim() ? editNotes : null
    if (next !== (booking?.notes ?? null)) onSave(event, { notes: next })
  }

  const location = booking?.location ?? null
  const isPhoneLocation = location?.name === 'Téléphone'
  const meetUrl = booking?.meet_url ?? null
  const panelTitle = event.kind === 'call' ? 'Appel' : isPersonal ? 'Horaire bloqué' : 'Rendez-vous'

  return (
    <Drawer title={panelTitle} onClose={onClose}>
      <div className="agenda-detail">
        <div>
          <div className="agenda-detail-title">
            <span className="agenda-dot" style={{ background: event.color, width: 10, height: 10 }} />
            {canEdit ? (
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur()
                  if (e.key === 'Escape') {
                    setTitle(event.title)
                    e.currentTarget.blur()
                  }
                }}
                placeholder="Titre"
              />
            ) : (
              <strong>{event.title}</strong>
            )}
          </div>
          <div className="agenda-detail-meta">
            {event.subtitle && <span>{event.subtitle}</span>}
            {!isPersonal && <StatusPill {...STATUS_META[status]} />}
            {isRecurring && <span className="agenda-tag">↻ Récurrent</span>}
            {booking?.source === 'google_sync' && <span className="agenda-tag">Google Calendar</span>}
            {booking?.source === 'booking_page' && <span className="agenda-tag">Page de réservation</span>}
          </div>
        </div>

        <section className="agenda-section">
          <h3 className="agenda-section-title">Date et heure</h3>
          {canEdit ? (
            <>
              <input
                type="date"
                className="agenda-field"
                value={date}
                onChange={(e) => {
                  if (!e.target.value) return
                  setDate(e.target.value)
                  saveDateTime(e.target.value, startTime, endTime)
                }}
              />
              <div className="agenda-row">
                <select
                  className="agenda-field"
                  value={startTime}
                  onChange={(e) => {
                    const nextStart = e.target.value
                    const dur = Math.max(15, timeToMinutes(endTime) - timeToMinutes(startTime))
                    const total = Math.min(timeToMinutes(nextStart) + dur, 24 * 60 - 1)
                    const nextEnd = `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
                    setStartTime(nextStart)
                    setEndTime(nextEnd)
                    saveDateTime(date, nextStart, nextEnd)
                  }}
                >
                  {QUARTER_TIMES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <span className="ds-muted">→</span>
                <select
                  className="agenda-field"
                  value={QUARTER_TIMES.includes(endTime) ? endTime : ''}
                  onChange={(e) => {
                    setEndTime(e.target.value)
                    saveDateTime(date, startTime, e.target.value)
                  }}
                >
                  {!QUARTER_TIMES.includes(endTime) && <option value="">{endTime}</option>}
                  {QUARTER_TIMES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <span className="ds-muted">· {formatDuration(duration)}</span>
              </div>
            </>
          ) : (
            <>
              <div className="agenda-row" style={{ textTransform: 'capitalize' }}>
                {formatLongDate(start)}
              </div>
              <div className="agenda-row font-mono">
                {toTimeInput(start)} — {toTimeInput(end)} <span className="ds-muted">({formatDuration(event.durationMinutes)})</span>
              </div>
            </>
          )}
        </section>

        {(meetUrl || location) && (
          <section className="agenda-section">
            <h3 className="agenda-section-title">{isPhoneLocation ? 'À l’heure du RDV' : 'Lieu'}</h3>
            {isPhoneLocation && (
              <div className="agenda-row">
                {lead?.phone ? (
                  <>
                    Appeler le prospect :{' '}
                    <a className="agenda-contact-link font-mono" href={`tel:${lead.phone}`}>
                      {lead.phone}
                    </a>
                  </>
                ) : (
                  'Appel téléphonique — numéro non renseigné'
                )}
              </div>
            )}
            {meetUrl && safeExternalUrl(meetUrl) && (
              <div className="agenda-row">
                <button type="button" className="ds-pill-button" onClick={() => openExternal(meetUrl)}>
                  Ouvrir Google Meet ↗
                </button>
              </div>
            )}
            {location && !isPhoneLocation && (
              <div>
                <div className="agenda-row">
                  <strong>{location.name}</strong>
                  {location.location_type === 'online' && <span className="agenda-tag">En ligne</span>}
                </div>
                {location.address && <div className="ds-muted">{location.address}</div>}
              </div>
            )}
          </section>
        )}

        {lead && (
          <section className="agenda-section">
            <h3 className="agenda-section-title">Lead</h3>
            <strong>
              {lead.first_name} {lead.last_name}
            </strong>
            {lead.email && (
              <a className="agenda-contact-link" href={`mailto:${lead.email}`}>
                {lead.email}
              </a>
            )}
            {lead.phone && (
              <a className="agenda-contact-link font-mono" href={`tel:${lead.phone}`}>
                {lead.phone}
              </a>
            )}
            <div>
              <button type="button" className="ds-pill-button" onClick={() => navigate(`/leads/${lead.id}`)}>
                Voir la fiche complète →
              </button>
            </div>
          </section>
        )}

        {canEdit && booking && (
          <section className="agenda-section">
            <h3 className="agenda-section-title">Couleur</h3>
            <div className="agenda-swatches">
              <button
                type="button"
                className={`agenda-swatch agenda-swatch--auto ${booking.color === null ? 'agenda-swatch--active' : ''}`}
                title="Couleur du calendrier (par défaut)"
                onClick={() => onSave(event, { color: null })}
              />
              {BOOKING_COLOR_PALETTE.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  title={c.label}
                  className={`agenda-swatch ${booking.color === c.hex ? 'agenda-swatch--active' : ''}`}
                  style={{ background: c.hex }}
                  onClick={() => onSave(event, { color: c.hex })}
                />
              ))}
            </div>
          </section>
        )}

        {canEdit && booking && (
          <section className="agenda-section">
            <h3 className="agenda-section-title">Disponibilité</h3>
            <label className="agenda-check">
              <input
                type="checkbox"
                checked={booking.blocks_availability !== false}
                onChange={(e) => onSave(event, { blocks_availability: e.target.checked })}
              />
              Bloquer les réservations
              <small>{booking.blocks_availability !== false ? '· créneau occupé' : '· créneau disponible'}</small>
            </label>
          </section>
        )}

        {canEdit ? (
          <section className="agenda-section">
            <h3 className="agenda-section-title">Notes</h3>
            <textarea
              className="agenda-field"
              rows={4}
              value={editNotes}
              placeholder="Notes…"
              onChange={(e) => setEditNotes(e.target.value)}
              onBlur={saveNotes}
            />
          </section>
        ) : (
          notes &&
          notes.trim() && (
            <section className="agenda-section">
              <h3 className="agenda-section-title">Notes</h3>
              <p style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 'var(--font-size-sm)' }}>{notes}</p>
            </section>
          )
        )}

        {isBooking && status === 'pending' && (
          <Button variant="primary" onClick={() => onStatusChange(event, 'confirmed')}>
            ✓ Confirmer ce RDV
          </Button>
        )}

        {isBooking && !isPersonal && status !== 'pending' && (
          <section className="agenda-section">
            <h3 className="agenda-section-title">Statut</h3>
            <div className="agenda-status-grid">
              {STATUS_ACTIONS.map((s) => {
                const meta = STATUS_META[s]
                const active = status === s
                return (
                  <button
                    key={s}
                    type="button"
                    className={`agenda-status-btn ${active ? 'agenda-status-btn--active' : ''}`}
                    style={active ? { color: meta.color, background: meta.bg } : undefined}
                    onClick={() => !active && onStatusChange(event, s)}
                  >
                    {meta.label}
                  </button>
                )
              })}
            </div>
          </section>
        )}

        {event.kind === 'call' && (
          <p className="agenda-info">
            Appel {event.subtitle?.toLowerCase()} du pipeline — son résultat se traite depuis l’onglet Closing ou la fiche du lead.
          </p>
        )}

        {isBooking && (
          <div className="agenda-danger-zone">
            {!confirmDelete ? (
              <button type="button" className="agenda-danger-button" onClick={() => setConfirmDelete(true)}>
                {status === 'pending' ? 'Annuler ce RDV' : 'Supprimer'}
              </button>
            ) : (
              <>
                <p className="agenda-danger-text">
                  {status === 'pending'
                    ? 'Êtes-vous sûr de vouloir annuler ce rendez-vous ? Il sera supprimé définitivement.'
                    : `Supprimer « ${event.title} » ?`}
                </p>
                <div className="agenda-row">
                  {isRecurring && status !== 'pending' ? (
                    <>
                      <button type="button" className="agenda-danger-button" onClick={() => onDelete(event, 'this')}>
                        Cette occurrence
                      </button>
                      <button type="button" className="agenda-danger-button" onClick={() => onDelete(event, 'future')}>
                        Celle-ci et les suivantes
                      </button>
                      <button type="button" className="agenda-danger-button" onClick={() => onDelete(event, 'all')}>
                        Toute la série
                      </button>
                    </>
                  ) : (
                    <button type="button" className="agenda-danger-button" onClick={() => onDelete(event, 'this')}>
                      {status === 'pending' ? 'Oui, annuler' : 'Oui, supprimer'}
                    </button>
                  )}
                  <button type="button" className="ds-pill-button" onClick={() => setConfirmDelete(false)}>
                    {status === 'pending' ? 'Garder le RDV' : 'Annuler'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </Drawer>
  )
}

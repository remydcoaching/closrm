// "Nouveau rendez-vous" — port of components/agenda/NewBookingModal (create
// mode). Same body, same POST /api/bookings: calendar or "Horaire bloqué",
// lead search, date / start → end / duration (15-min steps), all-day
// multi-day, location from the calendar's locations, recurrence, "bloquer
// les réservations", notes, color override.
import { useEffect, useRef, useState } from 'react'
import { api } from '../../lib/api-client'
import { Button } from '../../design-system/Button'
import { Input } from '../../design-system/Input'
import '../leads/lead-create-modal.css'
import {
  BLOCKED_CALENDAR_VALUE,
  BOOKING_COLOR_PALETTE,
  QUARTER_TIMES,
  buildBookingPayload,
  formatDuration,
  minutesToTime,
  timeToMinutes,
  type BookingFormState,
} from './agenda-utils'
import type { BookingCalendar, BookingLocation, LeadRef, ListResponse } from './types'

const DURATION_PRESETS = [15, 30, 45, 60, 75, 90, 105, 120, 150, 180, 240]

interface Props {
  calendars: BookingCalendar[]
  locations: BookingLocation[]
  prefillDate: string
  prefillTime: string
  prefillDuration: number
  onClose: () => void
  onCreated: () => void
}

interface IntegrationRow {
  type: string
  is_active: boolean
}

export function BookingModal({ calendars, locations, prefillDate, prefillTime, prefillDuration, onClose, onCreated }: Props) {
  const [form, setForm] = useState<BookingFormState>({
    calendarId: BLOCKED_CALENDAR_VALUE,
    leadId: null,
    leadName: null,
    locationId: '',
    title: '',
    date: prefillDate,
    time: prefillTime,
    duration: prefillDuration,
    allDay: false,
    allDayDays: 1,
    notes: '',
    color: null,
    blocksAvailability: true,
    recurrence: 'none',
    recurrenceCount: 4,
  })
  const [leadSearch, setLeadSearch] = useState('')
  const [leadResults, setLeadResults] = useState<LeadRef[]>([])
  const [selectedLead, setSelectedLead] = useState<LeadRef | null>(null)
  const [googleConnected, setGoogleConnected] = useState<boolean | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const recentLeads = useRef<LeadRef[]>([])

  const set = <K extends keyof BookingFormState>(key: K, value: BookingFormState[K]) => setForm((f) => ({ ...f, [key]: value }))

  const isBlocked = form.calendarId === BLOCKED_CALENDAR_VALUE
  const selectedCalendar = calendars.find((c) => c.id === form.calendarId)
  const availableLocations = locations.filter((l) => l.is_active && selectedCalendar?.location_ids?.includes(l.id))
  const selectedLocation = availableLocations.find((l) => l.id === form.locationId)

  useEffect(() => {
    api
      .get<ListResponse<IntegrationRow>>('/api/integrations')
      .then((res) => setGoogleConnected(Boolean(res.data?.find((i) => i.type === 'google_calendar')?.is_active)))
      .catch(() => setGoogleConnected(false))
    api
      .get<ListResponse<LeadRef>>('/api/leads?per_page=100')
      .then((res) => {
        recentLeads.current = res.data ?? []
      })
      .catch(() => undefined)
  }, [])

  // Local filter first (instant), then server search if the local hits are few.
  useEffect(() => {
    const q = leadSearch.trim().toLowerCase()
    if (!q) {
      setLeadResults([])
      return
    }
    const local = recentLeads.current
      .filter((l) => `${l.first_name ?? ''} ${l.last_name ?? ''} ${l.email ?? ''} ${l.phone ?? ''}`.toLowerCase().includes(q))
      .slice(0, 8)
    setLeadResults(local)
    if (q.length < 2 || local.length >= 5) return
    let cancelled = false
    const t = window.setTimeout(() => {
      api
        .get<ListResponse<LeadRef>>(`/api/leads?search=${encodeURIComponent(leadSearch.trim())}&per_page=8`)
        .then((res) => {
          if (!cancelled) setLeadResults(res.data ?? [])
        })
        .catch(() => undefined)
    }, 150)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [leadSearch])

  function changeCalendar(id: string) {
    const cal = calendars.find((c) => c.id === id)
    setForm((f) => {
      const next = { ...f, calendarId: id }
      if (cal) {
        next.duration = cal.duration_minutes
        const calLocs = locations.filter((l) => l.is_active && cal.location_ids?.includes(l.id))
        next.locationId = calLocs[0]?.id ?? ''
      }
      return next
    })
  }

  function pickLead(lead: LeadRef) {
    setSelectedLead(lead)
    setForm((f) => ({ ...f, leadId: lead.id, leadName: `${lead.first_name} ${lead.last_name}`.trim() }))
    setLeadSearch('')
    setLeadResults([])
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.date) {
      setError('La date est requise.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await api.post('/api/bookings', buildBookingPayload(form))
      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création')
    } finally {
      setSaving(false)
    }
  }

  const endTime = minutesToTime(timeToMinutes(form.time) + form.duration)
  const durationOptions = DURATION_PRESETS.includes(form.duration) ? DURATION_PRESETS : [...DURATION_PRESETS, form.duration].sort((a, b) => a - b)
  const titlePlaceholder = isBlocked ? 'Pause déjeuner, vacances…' : form.leadName || 'Rendez-vous sans titre'

  return (
    <div className="lead-create-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="lead-create-modal agenda-modal" style={{ borderTop: `3px solid ${isBlocked ? 'var(--color-border-strong)' : selectedCalendar?.color ?? 'var(--color-border-strong)'}` }}>
        <h2>Nouveau rendez-vous</h2>
        <form onSubmit={submit}>
          <div className="agenda-modal-row">
            <label>Titre</label>
            <Input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder={titlePlaceholder} autoFocus />
          </div>

          <div className="agenda-modal-row">
            <label>Calendrier</label>
            <select className="agenda-field" value={form.calendarId} onChange={(e) => changeCalendar(e.target.value)}>
              <option value={BLOCKED_CALENDAR_VALUE}>Horaire bloqué</option>
              {calendars.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.is_active ? '' : ' (inactif)'}
                </option>
              ))}
            </select>
          </div>

          <label className="agenda-check">
            <input type="checkbox" checked={form.allDay} onChange={(e) => set('allDay', e.target.checked)} />
            Toute la journée
          </label>

          <div className="agenda-modal-row">
            <label>Date et heure</label>
            <div className="agenda-row">
              <input type="date" className="agenda-field" value={form.date} onChange={(e) => set('date', e.target.value)} />
              {form.allDay ? (
                <>
                  <input
                    type="number"
                    className="agenda-field"
                    style={{ width: 70 }}
                    min={1}
                    max={14}
                    value={form.allDayDays}
                    onChange={(e) => set('allDayDays', Math.max(1, Math.min(14, Number(e.target.value) || 1)))}
                  />
                  <span className="ds-muted">{form.allDayDays > 1 ? 'jours' : 'jour'}</span>
                </>
              ) : (
                <>
                  <select className="agenda-field" value={form.time} onChange={(e) => set('time', e.target.value)}>
                    {!QUARTER_TIMES.includes(form.time) && <option value={form.time}>{form.time}</option>}
                    {QUARTER_TIMES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <span className="ds-muted">→</span>
                  <select
                    className="agenda-field"
                    value={endTime}
                    onChange={(e) => {
                      const diff = timeToMinutes(e.target.value) - timeToMinutes(form.time)
                      if (diff > 0) set('duration', diff)
                    }}
                  >
                    {!QUARTER_TIMES.includes(endTime) && <option value={endTime}>{endTime}</option>}
                    {QUARTER_TIMES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <select className="agenda-field" value={form.duration} onChange={(e) => set('duration', Number(e.target.value))}>
                    {durationOptions.map((m) => (
                      <option key={m} value={m}>
                        {formatDuration(m)}
                      </option>
                    ))}
                  </select>
                </>
              )}
            </div>
          </div>

          {isBlocked ? (
            <p className="agenda-info">Horaire bloqué : aucun lead, aucune réservation possible.</p>
          ) : (
            <>
              <div className="agenda-modal-row">
                <label>Lead</label>
                {selectedLead ? (
                  <div className="agenda-selected-lead">
                    <strong>
                      {selectedLead.first_name} {selectedLead.last_name}
                    </strong>
                    {selectedLead.phone && <span className="ds-muted font-mono">{selectedLead.phone}</span>}
                    <button
                      type="button"
                      aria-label="Désélectionner le lead"
                      onClick={() => {
                        setSelectedLead(null)
                        setForm((f) => ({ ...f, leadId: null, leadName: null }))
                      }}
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <>
                    <Input value={leadSearch} onChange={(e) => setLeadSearch(e.target.value)} placeholder="Rechercher un lead…" />
                    {leadResults.length > 0 && (
                      <div className="agenda-lead-results">
                        {leadResults.map((l) => (
                          <button key={l.id} type="button" className="agenda-lead-result" onClick={() => pickLead(l)}>
                            {l.first_name} {l.last_name}
                            {l.phone && <small>{l.phone}</small>}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {availableLocations.length > 0 && (
                <div className="agenda-modal-row">
                  <label>Lieu</label>
                  <select className="agenda-field" value={form.locationId} onChange={(e) => set('locationId', e.target.value)}>
                    <option value="">Choisir un lieu…</option>
                    {availableLocations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                        {l.location_type === 'online' ? ' (en ligne)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}

          <div className="agenda-modal-row">
            <label>Récurrence</label>
            <div className="agenda-row">
              <select
                className="agenda-field"
                value={form.recurrence}
                onChange={(e) => set('recurrence', e.target.value as BookingFormState['recurrence'])}
              >
                <option value="none">Pas de récurrence</option>
                <option value="daily">Tous les jours</option>
                <option value="weekly">Toutes les semaines</option>
                <option value="monthly">Tous les mois</option>
              </select>
              {form.recurrence !== 'none' && (
                <>
                  <span className="ds-muted">×</span>
                  <input
                    type="number"
                    className="agenda-field"
                    style={{ width: 70 }}
                    min={2}
                    max={52}
                    value={form.recurrenceCount}
                    onChange={(e) => {
                      const n = parseInt(e.target.value, 10)
                      if (!Number.isNaN(n)) set('recurrenceCount', Math.max(2, Math.min(52, n)))
                    }}
                  />
                  <span className="ds-muted">{form.recurrence === 'daily' ? 'jours' : form.recurrence === 'weekly' ? 'semaines' : 'mois'}</span>
                </>
              )}
            </div>
          </div>

          <label className="agenda-check">
            <input type="checkbox" checked={form.blocksAvailability} onChange={(e) => set('blocksAvailability', e.target.checked)} />
            Bloquer les réservations
            <small>{form.blocksAvailability ? '· créneau occupé' : '· créneau disponible'}</small>
          </label>

          <div className="agenda-modal-row">
            <label>Notes</label>
            <textarea className="agenda-field" rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Notes…" />
          </div>

          <div className="agenda-modal-row">
            <label>Couleur</label>
            <div className="agenda-swatches">
              <button
                type="button"
                title="Couleur du calendrier (par défaut)"
                className={`agenda-swatch agenda-swatch--auto ${form.color === null ? 'agenda-swatch--active' : ''}`}
                onClick={() => set('color', null)}
              />
              {BOOKING_COLOR_PALETTE.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  title={c.label}
                  className={`agenda-swatch ${form.color === c.hex ? 'agenda-swatch--active' : ''}`}
                  style={{ background: c.hex }}
                  onClick={() => set('color', c.hex)}
                />
              ))}
              <span className="ds-muted">{form.color ? BOOKING_COLOR_PALETTE.find((c) => c.hex === form.color)?.label : 'Auto'}</span>
            </div>
          </div>

          {!isBlocked && selectedLocation?.location_type === 'online' && googleConnected === false && (
            <p className="agenda-warning">Connectez Google Calendar dans les paramètres pour générer un lien Meet automatique.</p>
          )}

          {error && <p className="lead-create-error">{error}</p>}

          <div className="lead-create-actions">
            <Button type="button" variant="ghost" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? 'Création…' : 'Créer le rendez-vous'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

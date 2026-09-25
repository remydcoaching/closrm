// Sub-editors of the booking calendar settings page — ports of
// src/components/booking-calendars/{AvailabilityEditor, PurposeEditor,
// FormFieldsEditor, LocationEditor, RemindersEditor, RemindersLog}.
import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../../lib/api-client'
import { supabase } from '../../lib/supabase'
import { openWeb } from '../../lib/web-link'
import { Chips } from '../../design-system/Tabs'
import { StatusPill } from '../../design-system/StatusPill'
import { EmptyState, LoadingState } from '../../design-system/States'
import type {
  BookingLocation,
  CalendarPurpose,
  CalendarReminder,
  DayOfWeek,
  EmailTemplateChoice,
  FormField,
  FormFieldType,
  ListResponse,
  ReminderChannel,
  TimeSlot,
  WeekAvailability,
} from './types'

/* ─── Availability ─────────────────────────────────────────────────────── */

const DAY_LABELS: { key: DayOfWeek; label: string }[] = [
  { key: 'monday', label: 'Lundi' },
  { key: 'tuesday', label: 'Mardi' },
  { key: 'wednesday', label: 'Mercredi' },
  { key: 'thursday', label: 'Jeudi' },
  { key: 'friday', label: 'Vendredi' },
  { key: 'saturday', label: 'Samedi' },
  { key: 'sunday', label: 'Dimanche' },
]

export function makePermanentAvailability(): WeekAvailability {
  const slot = (): TimeSlot[] => [{ start: '00:00', end: '23:59' }]
  return { monday: slot(), tuesday: slot(), wednesday: slot(), thursday: slot(), friday: slot(), saturday: slot(), sunday: slot() }
}

export function isPermanentAvailability(a: WeekAvailability): boolean {
  return DAY_LABELS.every(({ key }) => a[key].length === 1 && a[key][0].start === '00:00' && a[key][0].end === '23:59')
}

export function AvailabilityEditor({ availability, onChange }: { availability: WeekAvailability; onChange: (a: WeekAvailability) => void }) {
  const [permanent, setPermanent] = useState(() => isPermanentAvailability(availability))
  const saved = useRef<WeekAvailability | null>(null)

  function togglePermanent() {
    if (!permanent) {
      saved.current = availability
      setPermanent(true)
      onChange(makePermanentAvailability())
    } else {
      setPermanent(false)
      if (saved.current) onChange(saved.current)
      saved.current = null
    }
  }

  function updateSlot(day: DayOfWeek, idx: number, field: keyof TimeSlot, value: string) {
    const slots = [...availability[day]]
    slots[idx] = { ...slots[idx], [field]: value }
    onChange({ ...availability, [day]: slots })
  }

  return (
    <>
      <div className="agenda-toggle-row" style={{ justifyContent: 'space-between', display: 'flex' }}>
        <div>
          <strong>Permanent</strong>
          <div className="ds-muted">
            {permanent ? 'Les rendez-vous peuvent être pris à tout moment, sans restriction de créneaux.' : 'Disponible 24h/24, 7j/7.'}
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={permanent}
          className={`agenda-toggle ${permanent ? 'agenda-toggle--on' : ''}`}
          onClick={togglePermanent}
          title={permanent ? 'Désactiver le mode permanent' : 'Activer le mode permanent (24/7)'}
        />
      </div>
      {!permanent && (
        <div>
          {DAY_LABELS.map(({ key, label }) => (
            <div key={key} className="agenda-avail-row">
              <div className="agenda-avail-day">{label}</div>
              <div className="agenda-avail-slots">
                {availability[key].length === 0 && <span className="ds-muted" style={{ paddingTop: 7 }}>Fermé</span>}
                {availability[key].map((slot, idx) => (
                  <div key={idx} className="agenda-row">
                    <input type="time" className="agenda-field" value={slot.start} onChange={(e) => updateSlot(key, idx, 'start', e.target.value)} />
                    <span className="ds-muted">→</span>
                    <input type="time" className="agenda-field" value={slot.end} onChange={(e) => updateSlot(key, idx, 'end', e.target.value)} />
                    <button
                      type="button"
                      className="agenda-mini-button agenda-mini-button--danger"
                      title="Supprimer cette plage"
                      onClick={() => onChange({ ...availability, [key]: availability[key].filter((_, i) => i !== idx) })}
                    >
                      ×
                    </button>
                  </div>
                ))}
                <div>
                  <button
                    type="button"
                    className="agenda-mini-button"
                    onClick={() => onChange({ ...availability, [key]: [...availability[key], { start: '09:00', end: '17:00' }] })}
                  >
                    + Ajouter une plage
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

/* ─── Purpose ──────────────────────────────────────────────────────────── */

const PURPOSES: { value: CalendarPurpose; label: string; description: string }[] = [
  { value: 'setting', label: 'Appel découverte', description: 'Qualification du prospect, premier contact' },
  { value: 'closing', label: 'Appel de closing', description: 'Appel de vente, conversion du prospect' },
  { value: 'other', label: 'Autre', description: 'Coaching, suivi, mentoring...' },
]

export function PurposeEditor({ value, onChange }: { value: CalendarPurpose; onChange: (p: CalendarPurpose) => void }) {
  return (
    <div className="agenda-choice-list">
      {PURPOSES.map((p) => (
        <button key={p.value} type="button" className={`agenda-choice ${value === p.value ? 'agenda-choice--active' : ''}`} onClick={() => onChange(p.value)}>
          <div>
            <strong>{p.label}</strong>
            <small>{p.description}</small>
          </div>
        </button>
      ))}
      <p className="agenda-info">
        Un calendrier « Appel découverte » ou « Appel de closing » crée automatiquement l’appel correspondant dans le pipeline à chaque réservation.
      </p>
    </div>
  )
}

/* ─── Form fields ──────────────────────────────────────────────────────── */

const FIELD_TYPES: { value: FormFieldType; label: string }[] = [
  { value: 'text', label: 'Texte' },
  { value: 'tel', label: 'Téléphone' },
  { value: 'email', label: 'Email' },
  { value: 'textarea', label: 'Texte long' },
  { value: 'select', label: 'Liste' },
]

export function FormFieldsEditor({ fields, onChange }: { fields: FormField[]; onChange: (f: FormField[]) => void }) {
  function update(idx: number, patch: Partial<FormField>) {
    const next = [...fields]
    next[idx] = { ...next[idx], ...patch }
    onChange(next)
  }
  function move(idx: number, dir: -1 | 1) {
    const j = idx + dir
    if (j < 0 || j >= fields.length) return
    const next = [...fields]
    ;[next[idx], next[j]] = [next[j], next[idx]]
    onChange(next)
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {fields.length === 0 && <p className="ds-muted" style={{ margin: 0 }}>Aucun champ — le formulaire par défaut du serveur s’applique.</p>}
      {fields.map((field, idx) => (
        <div key={field.key} className="agenda-field-row">
          <div className="agenda-row">
            <button type="button" className="agenda-mini-button" title="Monter" disabled={idx === 0} onClick={() => move(idx, -1)}>
              ↑
            </button>
            <button type="button" className="agenda-mini-button" title="Descendre" disabled={idx === fields.length - 1} onClick={() => move(idx, 1)}>
              ↓
            </button>
            <input className="agenda-field agenda-field--grow" placeholder="Libellé du champ" value={field.label} onChange={(e) => update(idx, { label: e.target.value })} />
            <select
              className="agenda-field"
              value={field.type}
              onChange={(e) => {
                const type = e.target.value as FormFieldType
                update(idx, type === 'select' && !field.options ? { type, options: [''] } : { type })
              }}
            >
              {FIELD_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <label className="agenda-check">
              <input type="checkbox" checked={field.required} onChange={(e) => update(idx, { required: e.target.checked })} />
              Requis
            </label>
            <button type="button" className="agenda-mini-button agenda-mini-button--danger" title="Supprimer ce champ" onClick={() => onChange(fields.filter((_, i) => i !== idx))}>
              ×
            </button>
          </div>
          {field.type === 'select' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 60 }}>
              <span className="ds-muted">Options de la liste</span>
              {(field.options ?? []).map((opt, oi) => (
                <div key={oi} className="agenda-row">
                  <input
                    className="agenda-field agenda-field--grow"
                    placeholder={`Option ${oi + 1}`}
                    value={opt}
                    onChange={(e) => {
                      const next = [...(field.options ?? [])]
                      next[oi] = e.target.value
                      update(idx, { options: next })
                    }}
                  />
                  <button
                    type="button"
                    className="agenda-mini-button agenda-mini-button--danger"
                    onClick={() => update(idx, { options: (field.options ?? []).filter((_, i) => i !== oi) })}
                  >
                    ×
                  </button>
                </div>
              ))}
              <div>
                <button type="button" className="agenda-mini-button" onClick={() => update(idx, { options: [...(field.options ?? []), ''] })}>
                  + Ajouter une option
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
      <div>
        <button
          type="button"
          className="ds-pill-button"
          onClick={() => onChange([...fields, { key: `field_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, label: '', type: 'text', required: false }])}
        >
          + Ajouter un champ
        </button>
      </div>
    </div>
  )
}

/* ─── Locations ────────────────────────────────────────────────────────── */

type LocationMode = 'in_person' | 'google_meet' | 'custom_link' | 'phone'

export interface LocationInfo {
  mode: LocationMode
  locationName?: string
  locationAddress?: string
  customLink?: string
}

const PHONE_LOCATION_NAME = 'Téléphone'

function locationToMode(loc: BookingLocation): LocationMode {
  if (loc.location_type === 'in_person') return 'in_person'
  if (loc.name === PHONE_LOCATION_NAME) return 'phone'
  if (loc.address && loc.address.trim().length > 0) return 'custom_link'
  return 'google_meet'
}

const LOCATION_CARDS: { mode: LocationMode; label: string; description: string }[] = [
  { mode: 'in_person', label: 'Présentiel', description: 'Rendez-vous en personne à une adresse physique' },
  { mode: 'google_meet', label: 'Google Meet', description: 'Lien Meet généré automatiquement' },
  { mode: 'custom_link', label: 'Visio personnalisée', description: 'Zoom, Teams ou autre lien de visio' },
  { mode: 'phone', label: 'Téléphone', description: 'Tu appelles le prospect au numéro fourni à la réservation' },
]

export function LocationEditor({
  selectedIds,
  onChange,
  googleConnected,
  onInfoChange,
}: {
  selectedIds: string[]
  onChange: (ids: string[]) => void
  googleConnected: boolean
  onInfoChange: (info: LocationInfo | null) => void
}) {
  const [locations, setLocations] = useState<BookingLocation[]>([])
  const [loading, setLoading] = useState(true)
  const [forcedMode, setForcedMode] = useState<LocationMode | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newAddress, setNewAddress] = useState('')
  const [customLink, setCustomLink] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .get<ListResponse<BookingLocation>>('/api/booking-locations')
      .then((res) => setLocations(res.data ?? []))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Lieux indisponibles'))
      .finally(() => setLoading(false))
  }, [])

  const selected = locations.filter((l) => selectedIds.includes(l.id))
  const activeMode: LocationMode | null = forcedMode ?? (selected[0] ? locationToMode(selected[0]) : null)
  const inPerson = locations.filter((l) => l.location_type === 'in_person')
  const firstName = selected[0]?.name
  const firstAddress = selected[0]?.address

  useEffect(() => {
    if (activeMode === 'custom_link') setCustomLink(firstAddress ?? '')
  }, [activeMode, firstAddress])

  useEffect(() => {
    if (!activeMode) {
      onInfoChange(null)
      return
    }
    const info: LocationInfo = { mode: activeMode }
    if (activeMode === 'in_person' && firstName) {
      info.locationName = firstName
      info.locationAddress = firstAddress ?? undefined
    } else if (activeMode === 'custom_link' && firstAddress) {
      info.customLink = firstAddress
    }
    onInfoChange(info)
  }, [activeMode, firstName, firstAddress, onInfoChange])

  async function selectMode(mode: LocationMode) {
    setForcedMode(mode)
    setError(null)
    if (mode === 'in_person') {
      onChange(selectedIds.filter((id) => locations.find((l) => l.id === id)?.location_type === 'in_person'))
      if (inPerson.length === 0) setShowAdd(true)
      return
    }
    const existing = locations.find((l) => locationToMode(l) === mode)
    if (existing) {
      onChange([existing.id])
      return
    }
    try {
      const res = await api.post<{ data: BookingLocation }>('/api/booking-locations', {
        name: mode === 'google_meet' ? 'Google Meet' : mode === 'phone' ? PHONE_LOCATION_NAME : 'Visio personnalisée',
        address: mode === 'custom_link' ? customLink || null : null,
        location_type: 'online',
      })
      setLocations((prev) => [...prev, res.data])
      onChange([res.data.id])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Création du lieu échouée')
    }
  }

  function toggleInPerson(id: string) {
    const current = selectedIds.filter((x) => locations.find((l) => l.id === x)?.location_type === 'in_person')
    onChange(current.includes(id) ? current.filter((x) => x !== id) : [...current, id])
  }

  async function addPlace() {
    if (!newName.trim()) return
    try {
      const res = await api.post<{ data: BookingLocation }>('/api/booking-locations', {
        name: newName.trim(),
        address: newAddress.trim() || null,
        location_type: 'in_person',
      })
      setLocations((prev) => [...prev, res.data])
      onChange([...selectedIds, res.data.id])
      setNewName('')
      setNewAddress('')
      setShowAdd(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ajout du lieu échoué')
    }
  }

  async function removePlace(id: string) {
    try {
      await api.delete(`/api/booking-locations/${id}`)
      setLocations((prev) => prev.filter((l) => l.id !== id))
      onChange(selectedIds.filter((x) => x !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Suppression du lieu échouée')
    }
  }

  async function saveCustomLink() {
    const loc = selected[0]
    if (activeMode !== 'custom_link' || !loc || loc.address === customLink) return
    try {
      await api.patch(`/api/booking-locations/${loc.id}`, { address: customLink })
      setLocations((prev) => prev.map((l) => (l.id === loc.id ? { ...l, address: customLink } : l)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement du lien échoué')
    }
  }

  if (loading) return <LoadingState />

  return (
    <>
      <p className="ds-muted" style={{ margin: 0 }}>Comment se dérouleront les rendez-vous ?</p>
      <div className="agenda-choice-list">
        {LOCATION_CARDS.map((c) => (
          <button key={c.mode} type="button" className={`agenda-choice ${activeMode === c.mode ? 'agenda-choice--active' : ''}`} onClick={() => void selectMode(c.mode)}>
            <div>
              <strong>{c.label}</strong>
              <small>{c.description}</small>
            </div>
          </button>
        ))}
      </div>

      {activeMode === 'in_person' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="ds-muted">Lieux disponibles — le prospect pourra choisir</span>
          {inPerson.length === 0 && !showAdd && <span className="ds-muted">Aucun lieu ajouté. Ajoutez vos adresses ci-dessous.</span>}
          {inPerson.map((loc) => (
            <div key={loc.id} className="agenda-field-row" style={{ flexDirection: 'row', alignItems: 'center' }}>
              <label className="agenda-check" style={{ flex: 1 }}>
                <input type="checkbox" checked={selectedIds.includes(loc.id)} onChange={() => toggleInPerson(loc.id)} />
                <span>
                  <strong>{loc.name}</strong>
                  {loc.address && <div className="ds-muted">{loc.address}</div>}
                </span>
              </label>
              <button type="button" className="agenda-mini-button agenda-mini-button--danger" title="Supprimer ce lieu" onClick={() => void removePlace(loc.id)}>
                ×
              </button>
            </div>
          ))}
          {showAdd ? (
            <div className="agenda-field-row">
              <input className="agenda-field" placeholder="Nom du lieu (ex: Fitness Park Lampertheim)" value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
              <input className="agenda-field" placeholder="Adresse (optionnel)" value={newAddress} onChange={(e) => setNewAddress(e.target.value)} />
              <div className="agenda-row" style={{ justifyContent: 'flex-end' }}>
                <button type="button" className="ds-pill-button" onClick={() => setShowAdd(false)}>
                  Annuler
                </button>
                <button type="button" className="ds-pill-button ds-pill-button--dark" disabled={!newName.trim()} onClick={() => void addPlace()}>
                  Ajouter
                </button>
              </div>
            </div>
          ) : (
            <div>
              <button type="button" className="ds-pill-button" onClick={() => setShowAdd(true)}>
                + Ajouter un lieu
              </button>
            </div>
          )}
        </div>
      )}

      {activeMode === 'google_meet' &&
        (googleConnected ? (
          <p className="agenda-info">Un lien Google Meet sera généré automatiquement pour chaque réservation.</p>
        ) : (
          <p className="agenda-warning">
            Google Calendar n’est pas connecté. Connectez-le dans Paramètres › Intégrations pour générer automatiquement un lien Google Meet.{' '}
            <button type="button" className="agenda-link-button" onClick={() => void openWeb('/parametres/integrations')}>
              Ouvrir les intégrations ↗
            </button>
          </p>
        ))}

      {activeMode === 'phone' && (
        <p className="agenda-info">
          Tu appelleras le prospect au numéro qu’il aura renseigné dans le formulaire de réservation. Pense à activer le champ Téléphone en requis dans le formulaire.
        </p>
      )}

      {activeMode === 'custom_link' && (
        <div className="agenda-form-field">
          <label>Lien de la visio</label>
          <input
            type="url"
            className="agenda-field"
            placeholder="https://zoom.us/j/123456789"
            value={customLink}
            onChange={(e) => setCustomLink(e.target.value)}
            onBlur={() => void saveCustomLink()}
          />
          <small>Ce lien sera partagé avec le prospect lors de la réservation</small>
        </div>
      )}
      {error && <p className="agenda-error">{error}</p>}
    </>
  )
}

/* ─── Reminders ────────────────────────────────────────────────────────── */

const CHANNELS: { value: ReminderChannel; label: string }[] = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'Email' },
  { value: 'instagram_dm', label: 'Instagram' },
]

const DEFAULT_MESSAGES: Record<ReminderChannel, string> = {
  email: 'Bonjour {{prenom}}, rappel : votre rendez-vous {{nom_calendrier}} est prévu le {{date_rdv}} à {{heure_rdv}}.',
  whatsapp: 'Bonjour {{prenom}}, petit rappel pour votre RDV de {{heure_rdv}} le {{date_rdv}}. À bientôt !',
  instagram_dm: 'Hey {{prenom}} ! Rappel pour ton RDV de {{heure_rdv}} le {{date_rdv}}.',
}

const CONFIRMATION_MESSAGES: Record<ReminderChannel, string> = {
  email: 'Bonjour {{prenom}}, votre rendez-vous {{nom_calendrier}} est confirmé pour le {{date_rdv}} à {{heure_rdv}}. À bientôt !',
  whatsapp: 'Bonjour {{prenom}}, votre RDV du {{date_rdv}} à {{heure_rdv}} est confirmé. À bientôt !',
  instagram_dm: 'Hey {{prenom}} ! Ton RDV du {{date_rdv}} à {{heure_rdv}} est confirmé 🙌',
}

const QUICK_PRESETS: { label: string; delay_value: number; delay_unit: 'hours' | 'days'; at_time?: string; confirmation?: boolean }[] = [
  { label: 'Confirmation', delay_value: 0, delay_unit: 'hours', confirmation: true },
  { label: 'H-2', delay_value: 2, delay_unit: 'hours' },
  { label: 'H-24', delay_value: 24, delay_unit: 'hours' },
  { label: 'J-1 à 9h', delay_value: 1, delay_unit: 'days', at_time: '09:00' },
  { label: 'J-2 à 9h', delay_value: 2, delay_unit: 'days', at_time: '09:00' },
  { label: 'J-7 à 9h', delay_value: 7, delay_unit: 'days', at_time: '09:00' },
]

const TEMPLATE_OPTIONS: { value: EmailTemplateChoice; label: string; description: string }[] = [
  { value: 'premium', label: 'Premium', description: 'Header dark + détails illustrés' },
  { value: 'minimal', label: 'Minimal', description: 'Sobre, light, lisible' },
  { value: 'plain', label: 'Texte', description: 'Brut, sans mise en forme' },
]

const CONFIRMATION_VIRTUAL_ID = '__confirmation__'
const VARS_HINT = '{{prenom}} {{nom}} {{date_rdv}} {{heure_rdv}} {{nom_calendrier}}'

export function formatReminderDelay(r: Pick<CalendarReminder, 'delay_value' | 'delay_unit' | 'at_time'>): string {
  if (r.delay_value === 0) return 'Confirmation'
  if (r.delay_unit === 'hours') return `H-${r.delay_value}`
  if (r.at_time) return `J-${r.delay_value} à ${r.at_time}`
  return `J-${r.delay_value}`
}

const API_BASE_URL = (import.meta.env.VITE_CLOSRM_API_BASE_URL as string) || 'http://localhost:3000'

/** POST /api/calendars/preview-reminder returns raw HTML (not JSON), so it
 *  can't go through api-client — same Bearer header, text body. */
async function fetchReminderPreview(body: Record<string, unknown>): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  const res = await fetch(`${API_BASE_URL}/api/calendars/preview-reminder`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Erreur ${res.status}`)
  return res.text()
}

function locationVariant(mode?: LocationMode): 'meet' | 'location' | 'phone' {
  if (mode === 'in_person') return 'location'
  if (mode === 'phone') return 'phone'
  return 'meet'
}

function EmailPreview({
  message,
  calendarName,
  template,
  accentColor,
  locationInfo,
}: {
  message: string
  calendarName: string
  template: EmailTemplateChoice
  accentColor: string
  locationInfo: LocationInfo | null
}) {
  const [html, setHtml] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const variant = locationVariant(locationInfo?.mode)
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const t = window.setTimeout(() => {
      fetchReminderPreview({
        message,
        calendarName,
        variant,
        template,
        accentColor,
        locationName: locationInfo?.locationName,
        locationAddress: locationInfo?.locationAddress,
        customLink: locationInfo?.customLink,
      })
        .then((h) => {
          if (cancelled) return
          setError(null)
          setHtml(h)
        })
        .catch(() => !cancelled && setError('Erreur de chargement de l’aperçu'))
        .finally(() => !cancelled && setLoading(false))
    }, 350)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [message, calendarName, variant, template, accentColor, locationInfo])
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span className="ds-muted">
        Aperçu live · {variant === 'meet' ? 'Visio' : variant === 'location' ? 'Présentiel' : 'Téléphone'}
        {loading && ' · chargement…'}
      </span>
      {error ? <p className="agenda-error">{error}</p> : <iframe className="agenda-preview-frame" title="Aperçu email" sandbox="" srcDoc={html} />}
    </div>
  )
}

function TimingControls({ reminder, onUpdate }: { reminder: CalendarReminder; onUpdate: (u: Partial<CalendarReminder>) => void }) {
  return (
    <div className="agenda-row">
      <input
        type="number"
        min={0}
        max={365}
        className="agenda-field"
        style={{ width: 70 }}
        value={reminder.delay_value}
        onChange={(e) => onUpdate({ delay_value: parseInt(e.target.value, 10) || 0 })}
      />
      <select
        className="agenda-field"
        value={reminder.delay_unit}
        onChange={(e) => {
          const unit = e.target.value as 'hours' | 'days'
          onUpdate(unit === 'hours' ? { delay_unit: unit, at_time: null } : { delay_unit: unit })
        }}
      >
        <option value="hours">heures avant</option>
        <option value="days">jours avant</option>
      </select>
      {reminder.delay_unit === 'days' && (
        <>
          <span className="ds-muted">à</span>
          <input type="time" className="agenda-field" value={reminder.at_time ?? ''} onChange={(e) => onUpdate({ at_time: e.target.value || null })} />
        </>
      )}
    </div>
  )
}

export function RemindersEditor({
  reminders,
  onChange,
  calendarName,
  emailTemplate,
  emailAccentColor,
  onEmailTemplateChange,
  onEmailAccentColorChange,
  locationInfo,
}: {
  reminders: CalendarReminder[]
  onChange: (r: CalendarReminder[]) => void
  calendarName: string
  emailTemplate: EmailTemplateChoice
  emailAccentColor: string
  onEmailTemplateChange: (t: EmailTemplateChoice) => void
  onEmailAccentColorChange: (c: string) => void
  locationInfo: LocationInfo | null
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showPresets, setShowPresets] = useState(false)

  const confirmation = reminders.find((r) => r.channel === 'email' && r.delay_value === 0)
  const effectiveConfirmation: CalendarReminder = confirmation ?? {
    id: CONFIRMATION_VIRTUAL_ID,
    delay_value: 0,
    delay_unit: 'hours',
    at_time: null,
    channel: 'email',
    message: CONFIRMATION_MESSAGES.email,
  }
  const others = reminders.filter((r) => r.id !== confirmation?.id)

  function update(id: string, patch: Partial<CalendarReminder>) {
    onChange(reminders.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  function updateConfirmationMessage(message: string) {
    if (confirmation) {
      update(confirmation.id, { message })
      return
    }
    const created: CalendarReminder = { ...effectiveConfirmation, id: crypto.randomUUID(), message }
    onChange([...reminders, created])
    setExpandedId(created.id)
  }

  function changeChannel(id: string, channel: ReminderChannel) {
    const existing = reminders.find((r) => r.id === id)
    const patch: Partial<CalendarReminder> = { channel }
    if (existing && Object.values(DEFAULT_MESSAGES).includes(existing.message)) patch.message = DEFAULT_MESSAGES[channel]
    update(id, patch)
  }

  function addPreset(p: (typeof QUICK_PRESETS)[number]) {
    const channel: ReminderChannel = 'whatsapp'
    onChange([
      ...reminders,
      {
        id: crypto.randomUUID(),
        delay_value: p.delay_value,
        delay_unit: p.delay_unit,
        at_time: p.at_time ?? null,
        channel,
        message: (p.confirmation ? CONFIRMATION_MESSAGES : DEFAULT_MESSAGES)[channel],
      },
    ])
    setShowPresets(false)
  }

  function addCustom() {
    const r: CalendarReminder = { id: crypto.randomUUID(), delay_value: 24, delay_unit: 'hours', at_time: null, channel: 'whatsapp', message: DEFAULT_MESSAGES.whatsapp }
    onChange([...reminders, r])
    setExpandedId(r.id)
    setShowPresets(false)
  }

  function bulkChannel(channel: ReminderChannel) {
    onChange(
      reminders.map((r) => {
        if (r.id === confirmation?.id) return r
        const isDefault = Object.values(DEFAULT_MESSAGES).includes(r.message) || Object.values(CONFIRMATION_MESSAGES).includes(r.message)
        const messages = r.delay_value === 0 ? CONFIRMATION_MESSAGES : DEFAULT_MESSAGES
        return { ...r, channel, ...(isDefault ? { message: messages[channel] } : {}) }
      }),
    )
  }

  const confirmationOpen = expandedId === effectiveConfirmation.id

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {reminders.some((r) => r.channel === 'email') && (
        <div className="agenda-field-row">
          <strong style={{ fontSize: 'var(--font-size-sm)' }}>Style des emails</strong>
          <div className="agenda-choice-list" style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {TEMPLATE_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                className={`agenda-choice ${emailTemplate === o.value ? 'agenda-choice--active' : ''}`}
                onClick={() => onEmailTemplateChange(o.value)}
              >
                <div>
                  <strong>{o.label}</strong>
                  <small>{o.description}</small>
                </div>
              </button>
            ))}
          </div>
          <div className="agenda-row">
            <span className="ds-muted">Couleur d’accent</span>
            <input type="color" value={emailAccentColor} onChange={(e) => onEmailAccentColorChange(e.target.value)} />
            <input
              className="agenda-field font-mono"
              style={{ width: 100 }}
              value={emailAccentColor}
              onChange={(e) => /^#[0-9A-Fa-f]{0,6}$/.test(e.target.value) && onEmailAccentColorChange(e.target.value)}
            />
          </div>
        </div>
      )}

      <div className="agenda-reminder">
        <button type="button" className="agenda-reminder-head" onClick={() => setExpandedId(confirmationOpen ? null : effectiveConfirmation.id)}>
          <span className="agenda-reminder-delay">Confirmation</span>
          <span className="agenda-tag">Email</span>
          <span className="agenda-reminder-snippet">{effectiveConfirmation.message}</span>
          <span className="agenda-tag">Obligatoire</span>
          <span className="ds-muted">{confirmationOpen ? '▲' : '▼'}</span>
        </button>
        {confirmationOpen && (
          <div className="agenda-reminder-body agenda-reminder-body--split">
            <EmailPreview
              message={effectiveConfirmation.message}
              calendarName={calendarName}
              template={emailTemplate}
              accentColor={emailAccentColor}
              locationInfo={locationInfo}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p className="agenda-info">
                Envoyé automatiquement par email à la création de la réservation. Le canal et le timing sont verrouillés pour garantir la délivrabilité.
              </p>
              <textarea className="agenda-field" rows={6} value={effectiveConfirmation.message} onChange={(e) => updateConfirmationMessage(e.target.value)} />
              <span className="agenda-vars">{VARS_HINT}</span>
              <div>
                <button type="button" className="agenda-mini-button" onClick={() => updateConfirmationMessage(CONFIRMATION_MESSAGES.email)}>
                  Réinitialiser au message par défaut
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {others.length === 0 && !showPresets && (
        <p className="ds-muted" style={{ margin: 0 }}>
          Aucun rappel supplémentaire configuré. Ajoutez-en pour notifier vos prospects avant leurs rendez-vous.
        </p>
      )}

      {others.length > 1 && (
        <div className="agenda-row">
          <span className="ds-muted">Tous les rappels via :</span>
          <Chips
            items={CHANNELS.map((c) => ({ key: c.value, label: c.label }))}
            active={CHANNELS.find((c) => others.every((r) => r.channel === c.value))?.value ?? null}
            onChange={bulkChannel}
          />
        </div>
      )}

      {others.map((r) => {
        const open = expandedId === r.id
        const isEmail = r.channel === 'email'
        return (
          <div key={r.id} className="agenda-reminder">
            <div className="agenda-reminder-head" role="button" tabIndex={0} onClick={() => setExpandedId(open ? null : r.id)}>
              <span className="agenda-reminder-delay">{formatReminderDelay(r)}</span>
              <span className="agenda-tag">{CHANNELS.find((c) => c.value === r.channel)?.label ?? r.channel}</span>
              <span className="agenda-reminder-snippet">{r.message}</span>
              <span className="ds-muted">{open ? '▲' : '▼'}</span>
              <button
                type="button"
                className="agenda-mini-button agenda-mini-button--danger"
                onClick={(e) => {
                  e.stopPropagation()
                  onChange(reminders.filter((x) => x.id !== r.id))
                  if (open) setExpandedId(null)
                }}
              >
                ×
              </button>
            </div>
            {open && (
              <div className={`agenda-reminder-body ${isEmail ? 'agenda-reminder-body--split' : ''}`}>
                {isEmail && (
                  <EmailPreview message={r.message} calendarName={calendarName} template={emailTemplate} accentColor={emailAccentColor} locationInfo={locationInfo} />
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span className="agenda-section-title">Quand envoyer</span>
                  <TimingControls reminder={r} onUpdate={(u) => update(r.id, u)} />
                  <span className="agenda-section-title">Canal</span>
                  <Chips items={CHANNELS.map((c) => ({ key: c.value, label: c.label }))} active={r.channel} onChange={(c) => changeChannel(r.id, c)} />
                  <span className="agenda-section-title">Message</span>
                  <textarea className="agenda-field" rows={isEmail ? 5 : 3} value={r.message} onChange={(e) => update(r.id, { message: e.target.value })} />
                  <span className="agenda-vars">{VARS_HINT}</span>
                </div>
              </div>
            )}
          </div>
        )
      })}

      {showPresets ? (
        <div className="agenda-field-row">
          <div className="agenda-row" style={{ justifyContent: 'space-between' }}>
            <strong style={{ fontSize: 'var(--font-size-sm)' }}>Rappels rapides</strong>
            <button type="button" className="agenda-mini-button" onClick={() => setShowPresets(false)}>
              ×
            </button>
          </div>
          <div className="agenda-row">
            {QUICK_PRESETS.map((p) => (
              <button key={p.label} type="button" className="agenda-mini-button" onClick={() => addPreset(p)}>
                {p.label}
              </button>
            ))}
            <button type="button" className="agenda-mini-button" onClick={addCustom}>
              Personnalisé…
            </button>
          </div>
        </div>
      ) : (
        <div>
          <button type="button" className="ds-pill-button" onClick={() => setShowPresets(true)} disabled={reminders.length >= 10}>
            + Ajouter un rappel
          </button>
          {reminders.length >= 10 && <span className="ds-muted" style={{ marginLeft: 8 }}>Maximum 10 rappels</span>}
        </div>
      )}
    </div>
  )
}

/* ─── Reminders log ────────────────────────────────────────────────────── */

interface ReminderLogRow {
  id: string
  channel: string
  message: string
  send_at: string
  status: string
  error: string | null
  booking: { id: string; scheduled_at: string } | null
  lead: { id: string; first_name: string | null; last_name: string | null; email: string | null } | null
}

const LOG_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'En attente', color: '#b45309', bg: '#fdf3e2' },
  sent: { label: 'Envoyé', color: '#1a7f4e', bg: '#e8f7ee' },
  failed: { label: 'Échec', color: '#d63447', bg: '#fceced' },
  cancelled: { label: 'Annulé', color: '#6b6f76', bg: '#f2f1f2' },
}

type LogFilter = 'all' | 'sent' | 'pending' | 'failed' | 'cancelled'

export function RemindersLog({ calendarId }: { calendarId: string }) {
  const [rows, setRows] = useState<ReminderLogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<LogFilter>('all')
  const dateFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get<{ reminders: ReminderLogRow[] }>(`/api/calendars/${calendarId}/reminders-log`)
      setRows(res.reminders ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [calendarId])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = filter === 'all' ? rows : rows.filter((r) => r.status === filter)
  const count = (s: LogFilter) => (s === 'all' ? rows.length : rows.filter((r) => r.status === s).length)
  const filters: { key: LogFilter; label: string; count: number }[] = [
    { key: 'all', label: 'Tous', count: count('all') },
    { key: 'sent', label: 'Envoyé', count: count('sent') },
    { key: 'pending', label: 'En attente', count: count('pending') },
    { key: 'failed', label: 'Échec', count: count('failed') },
    { key: 'cancelled', label: 'Annulé', count: count('cancelled') },
  ]

  return (
    <>
      <div className="agenda-row" style={{ justifyContent: 'space-between' }}>
        <Chips items={filters} active={filter} onChange={setFilter} />
        <button type="button" className="ds-pill-button" onClick={() => void load()} disabled={loading}>
          ↻ Rafraîchir
        </button>
      </div>
      {error && <p className="agenda-error">{error}</p>}
      {loading && rows.length === 0 ? (
        <LoadingState />
      ) : filtered.length === 0 ? (
        <EmptyState title={filter === 'all' ? 'Aucun rappel envoyé pour ce calendrier.' : 'Aucun rappel dans ce statut.'} />
      ) : (
        <div className="ds-table-scroll" style={{ maxHeight: 480, overflowY: 'auto' }}>
          <table className="ds-table">
            <thead>
              <tr>
                <th>Lead</th>
                <th>Canal</th>
                <th>Envoi</th>
                <th>RDV</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const name = r.lead ? `${r.lead.first_name ?? ''} ${r.lead.last_name ?? ''}`.trim() || r.lead.email || '—' : '—'
                const st = LOG_STATUS[r.status] ?? LOG_STATUS.pending
                return (
                  <tr key={r.id} className={r.status === 'failed' ? 'ds-row--alert' : undefined}>
                    <td>
                      <strong>{name}</strong>
                      <div className="ds-muted" style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.message}>
                        {r.message}
                      </div>
                    </td>
                    <td className="ds-muted">{CHANNELS.find((c) => c.value === r.channel)?.label ?? r.channel}</td>
                    <td className="ds-num-cell" style={{ textAlign: 'left' }}>
                      <span className="ds-num">{dateFmt.format(new Date(r.send_at))}</span>
                    </td>
                    <td className="ds-num-cell" style={{ textAlign: 'left' }}>
                      {r.booking?.scheduled_at ? <span className="ds-num">{dateFmt.format(new Date(r.booking.scheduled_at))}</span> : <span className="ds-muted">—</span>}
                    </td>
                    <td>
                      <StatusPill {...st} />
                      {r.error && (
                        <div className="agenda-error" style={{ fontSize: 11, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.error}>
                          {r.error}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

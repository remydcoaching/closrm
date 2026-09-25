// Agenda › Pages de réservation › réglages d'un calendrier — port of
// src/app/(dashboard)/parametres/calendriers/[id]/page.tsx. Same sections,
// same PATCH /api/booking-calendars/:id body. The public page preview opens
// in the browser (the renderer CSP forbids external iframes).
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../../lib/api-client'
import { openWeb } from '../../lib/web-link'
import { Tabs } from '../../design-system/Tabs'
import { ErrorState, LoadingState } from '../../design-system/States'
import './agenda.css'
import {
  AvailabilityEditor,
  FormFieldsEditor,
  LocationEditor,
  PurposeEditor,
  RemindersEditor,
  RemindersLog,
  type LocationInfo,
} from './CalendarEditors'
import type {
  BookingCalendar,
  CalendarPurpose,
  CalendarReminder,
  EmailTemplateChoice,
  FormField,
  ListResponse,
  WeekAvailability,
} from './types'

const DEFAULT_AVAILABILITY: WeekAvailability = {
  monday: [{ start: '09:00', end: '17:00' }],
  tuesday: [{ start: '09:00', end: '17:00' }],
  wednesday: [{ start: '09:00', end: '17:00' }],
  thursday: [{ start: '09:00', end: '17:00' }],
  friday: [{ start: '09:00', end: '17:00' }],
  saturday: [],
  sunday: [],
}

interface FormState {
  name: string
  slug: string
  description: string
  durationMinutes: number
  bufferMinutes: number
  maxAdvanceDays: number | ''
  emailTemplate: EmailTemplateChoice
  emailAccentColor: string
  color: string
  backgroundTheme: 'dark' | 'light'
  availability: WeekAvailability
  formFields: FormField[]
  locationIds: string[]
  purpose: CalendarPurpose
  reminders: CalendarReminder[]
  requireConfirmation: boolean
  isActive: boolean
}

function toForm(cal: BookingCalendar): FormState {
  return {
    name: cal.name,
    slug: cal.slug,
    description: cal.description ?? '',
    durationMinutes: cal.duration_minutes,
    bufferMinutes: cal.buffer_minutes,
    maxAdvanceDays: cal.max_advance_days ?? '',
    emailTemplate: cal.email_template ?? 'premium',
    emailAccentColor: cal.email_accent_color ?? '#E53E3E',
    color: cal.color,
    backgroundTheme: cal.background_theme ?? 'dark',
    availability: cal.availability ?? DEFAULT_AVAILABILITY,
    formFields: cal.form_fields ?? [],
    locationIds: cal.location_ids ?? [],
    purpose: cal.purpose ?? 'other',
    reminders: cal.reminders ?? [],
    requireConfirmation: cal.require_confirmation ?? false,
    isActive: cal.is_active,
  }
}

/** Same PATCH body as the web's handleSave (+ is_active, also in the schema). */
export function toPatchBody(f: FormState): Record<string, unknown> {
  return {
    name: f.name,
    slug: f.slug,
    description: f.description || null,
    duration_minutes: f.durationMinutes,
    buffer_minutes: f.bufferMinutes,
    max_advance_days: f.maxAdvanceDays === '' ? null : f.maxAdvanceDays,
    email_template: f.emailTemplate,
    email_accent_color: f.emailAccentColor,
    color: f.color,
    background_theme: f.backgroundTheme,
    availability: f.availability,
    form_fields: f.formFields,
    location_ids: f.locationIds,
    purpose: f.purpose,
    reminders: f.reminders,
    require_confirmation: f.requireConfirmation,
    is_active: f.isActive,
  }
}

interface IntegrationRow {
  type: string
  is_active: boolean
}

export function BookingCalendarEditPage() {
  const { id = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [form, setForm] = useState<FormState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [workspaceSlug, setWorkspaceSlug] = useState<string | null>(null)
  const [googleConnected, setGoogleConnected] = useState(false)
  const [locationInfo, setLocationInfo] = useState<LocationInfo | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get<{ data: BookingCalendar }>(`/api/booking-calendars/${id}`)
      setForm(toForm(res.data))
      setDirty(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Calendrier non trouvé')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
    api
      .get<{ slug: string | null }>('/api/workspaces/slug')
      .then((r) => setWorkspaceSlug(r.slug ?? null))
      .catch(() => setWorkspaceSlug(null))
    api
      .get<ListResponse<IntegrationRow>>('/api/integrations')
      .then((r) => setGoogleConnected(Boolean(r.data?.find((i) => i.type === 'google_calendar')?.is_active)))
      .catch(() => setGoogleConnected(false))
  }, [load])

  const set = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => (f ? { ...f, [key]: value } : f))
    setDirty(true)
  }, [])

  const onLocationInfo = useCallback((info: LocationInfo | null) => setLocationInfo(info), [])

  async function save() {
    if (!form) return
    setSaving(true)
    setSaveError(null)
    setSaved(false)
    try {
      const res = await api.patch<{ data: BookingCalendar }>(`/api/booking-calendars/${id}`, toPatchBody(form))
      setForm(toForm(res.data))
      setDirty(false)
      setSaved(true)
      window.setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingState />
  if (error || !form) return <ErrorState message={error ?? 'Calendrier non trouvé'} onRetry={() => void load()} />

  const publicPath = workspaceSlug && form.slug ? `/book/${workspaceSlug}/${form.slug}` : null

  return (
    <div className="agenda-page agenda-page--scroll">
      <div>
        <button type="button" className="agenda-link-button" onClick={() => navigate('/agenda/pages')}>
          ← Retour aux pages de réservation
        </button>
      </div>
      <div className="agenda-header">
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="agenda-dot" style={{ background: form.color, width: 12, height: 12 }} />
            {form.name || 'Calendrier'}
          </h1>
          <p>{publicPath ?? 'Lien public indisponible — slug du workspace non configuré'}</p>
        </div>
        <div className="agenda-header-actions agenda-sticky-save">
          {saved && <span className="agenda-success">Enregistré</span>}
          {saveError && <span className="agenda-error">{saveError}</span>}
          {dirty && !saving && !saved && <span className="ds-muted">Modifications non enregistrées</span>}
          <span className="agenda-toggle-row">
            <button
              type="button"
              role="switch"
              aria-checked={form.isActive}
              className={`agenda-toggle ${form.isActive ? 'agenda-toggle--on' : ''}`}
              onClick={() => set('isActive', !form.isActive)}
            />
            {form.isActive ? 'Actif' : 'Inactif'}
          </span>
          {publicPath && (
            <button type="button" className="ds-pill-button" onClick={() => void openWeb(publicPath)}>
              Prévisualiser ↗
            </button>
          )}
          <button type="button" className="ds-pill-button" onClick={() => void openWeb(`/parametres/calendriers/${id}`)}>
            Ouvrir sur le web ↗
          </button>
          <button type="button" className="ds-pill-button ds-pill-button--dark" disabled={saving} onClick={() => void save()}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>

      <div className="agenda-editor">
        <section className="agenda-card">
          <h2>Général</h2>
          <div className="agenda-form-grid">
            <div className="agenda-form-field">
              <label>Nom</label>
              <input className="agenda-field" value={form.name} onChange={(e) => set('name', e.target.value)} />
            </div>
            <div className="agenda-form-field">
              <label>Slug (URL)</label>
              <input
                className="agenda-field font-mono"
                value={form.slug}
                onChange={(e) => set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
              />
              <small>Lettres minuscules, chiffres et tirets uniquement</small>
            </div>
            <div className="agenda-form-field agenda-form-field--full">
              <label>Description (optionnel)</label>
              <textarea className="agenda-field" rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} />
            </div>
            <div className="agenda-form-field">
              <label>Durée (minutes)</label>
              <input type="number" min={5} max={480} className="agenda-field" value={form.durationMinutes} onChange={(e) => set('durationMinutes', Number(e.target.value))} />
            </div>
            <div className="agenda-form-field">
              <label>Tampon (minutes)</label>
              <input type="number" min={0} max={120} className="agenda-field" value={form.bufferMinutes} onChange={(e) => set('bufferMinutes', Number(e.target.value))} />
            </div>
            <div className="agenda-form-field agenda-form-field--full">
              <label>Limite de réservation (max. jours dans le futur)</label>
              <div className="agenda-row">
                <input
                  type="number"
                  min={1}
                  max={365}
                  placeholder="Aucune limite"
                  className="agenda-field"
                  style={{ maxWidth: 180 }}
                  value={form.maxAdvanceDays}
                  onChange={(e) => set('maxAdvanceDays', e.target.value === '' ? '' : Math.max(1, Number(e.target.value)))}
                />
                <small className="ds-muted">
                  {form.maxAdvanceDays === ''
                    ? 'Pas de limite — les prospects peuvent réserver à n’importe quelle date.'
                    : `Les prospects ne pourront pas réserver au-delà de ${form.maxAdvanceDays} jour${form.maxAdvanceDays > 1 ? 's' : ''} dans le futur.`}
                </small>
              </div>
            </div>
            <div className="agenda-form-field agenda-form-field--full">
              <label>Apparence</label>
              <div className="agenda-row">
                <input type="color" aria-label="Couleur principale" value={form.color} onChange={(e) => set('color', e.target.value)} />
                <input className="agenda-field font-mono" style={{ width: 100 }} value={form.color} onChange={(e) => set('color', e.target.value)} />
                <Tabs
                  items={[
                    { key: 'dark', label: 'Fond sombre' },
                    { key: 'light', label: 'Fond clair' },
                  ]}
                  active={form.backgroundTheme}
                  onChange={(k) => set('backgroundTheme', k)}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="agenda-card">
          <h2>Type de rendez-vous</h2>
          <LocationEditor selectedIds={form.locationIds} onChange={(ids) => set('locationIds', ids)} googleConnected={googleConnected} onInfoChange={onLocationInfo} />
        </section>

        <section className="agenda-card">
          <h2>Disponibilités</h2>
          <AvailabilityEditor availability={form.availability} onChange={(a) => set('availability', a)} />
        </section>

        <section className="agenda-card">
          <h2>Objectif du calendrier</h2>
          <p className="agenda-card-sub">Quel est l’objectif de ce calendrier ?</p>
          <PurposeEditor value={form.purpose} onChange={(p) => set('purpose', p)} />
        </section>

        <section className="agenda-card">
          <h2>Confirmation des réservations</h2>
          <div className="agenda-row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
            <div>
              <strong>Confirmation manuelle requise</strong>
              <div className="ds-muted">
                {form.requireConfirmation
                  ? 'Les réservations doivent être confirmées par le coach avant que le prospect reçoive l’email de confirmation.'
                  : 'Les réservations sont confirmées automatiquement et le prospect reçoit l’email immédiatement.'}
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={form.requireConfirmation}
              className={`agenda-toggle ${form.requireConfirmation ? 'agenda-toggle--on' : ''}`}
              onClick={() => set('requireConfirmation', !form.requireConfirmation)}
            />
          </div>
        </section>

        <section className="agenda-card">
          <h2>Rappels automatiques</h2>
          <RemindersEditor
            reminders={form.reminders}
            onChange={(r) => set('reminders', r)}
            calendarName={form.name}
            emailTemplate={form.emailTemplate}
            emailAccentColor={form.emailAccentColor}
            onEmailTemplateChange={(t) => set('emailTemplate', t)}
            onEmailAccentColorChange={(c) => set('emailAccentColor', c)}
            locationInfo={locationInfo}
          />
        </section>

        <section className="agenda-card">
          <h2>Historique des envois</h2>
          <RemindersLog calendarId={id} />
        </section>

        <section className="agenda-card">
          <h2>Formulaire de réservation</h2>
          <FormFieldsEditor fields={form.formFields} onChange={(f) => set('formFields', f)} />
        </section>
      </div>
    </div>
  )
}

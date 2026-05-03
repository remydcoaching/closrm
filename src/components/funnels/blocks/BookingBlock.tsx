'use client'

/**
 * A-028a-01 — BookingBlock fonctionnel.
 *
 * Widget de réservation intégré dans les funnels. Quand `config.calendarId`
 * est défini, charge les créneaux disponibles depuis l'API publique et
 * permet au visiteur de réserver directement dans le funnel.
 *
 * Phases : sélection date → sélection créneau → formulaire → confirmation.
 * Stylé via les CSS vars du preset funnel (--fnl-primary, --fnl-text, etc.).
 *
 * En mode preview (builder), affiche un placeholder interactif non-fonctionnel.
 */

import { useEffect, useState, useCallback } from 'react'
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isPast,
  isToday,
  addMonths,
  subMonths,
  format,
} from 'date-fns'
import { fr } from 'date-fns/locale'
import type { BookingBlockConfig } from '@/types'
import { resolveFunnelUrl } from '@/lib/funnels/resolve-url'

interface Props {
  config: BookingBlockConfig
}

interface CalendarInfo {
  name: string
  description: string | null
  duration_minutes: number
  location_ids: string[]
  color: string
  form_fields: { key: string; label: string; type: string; required: boolean; options?: string[] }[]
}

interface LocationInfo {
  id: string
  name: string
  address: string | null
  location_type: string
}

interface SlotData {
  date: string
  slots: string[]
}

const DAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

// Base fields always shown in the form
const BASE_FIELDS = ['first_name', 'last_name', 'email', 'phone']

export default function BookingBlock({ config }: Props) {
  // If no calendar selected, show placeholder
  if (!config.calendarId) {
    return <BookingPlaceholder config={config} message="Aucun calendrier sélectionné" />
  }

  return <BookingWidget config={config} calendarId={config.calendarId} />
}

// ─── Placeholder (builder preview / no calendar) ────────────────────────────

function BookingPlaceholder({ config, message }: { config: BookingBlockConfig; message: string }) {
  return (
    <div style={{ padding: '40px 20px', maxWidth: 600, margin: '0 auto' }}>
      {config.title && (
        <h2 style={titleStyle}>{config.title}</h2>
      )}
      {config.subtitle && (
        <p style={subtitleStyle}>{config.subtitle}</p>
      )}
      <div style={placeholderCardStyle}>
        <div style={{ fontSize: 48, marginBottom: 16 }} aria-hidden="true">📅</div>
        <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--fnl-text)', margin: '0 0 8px' }}>
          Réservation de RDV
        </p>
        <p style={{ fontSize: 12, color: 'var(--fnl-text-secondary)', margin: 0, lineHeight: 1.5 }}>
          {message}
        </p>
      </div>
    </div>
  )
}

// ─── Real Booking Widget ────────────────────────────────────────────────────

function BookingWidget({ config, calendarId }: { config: BookingBlockConfig; calendarId: string }) {
  const [calendar, setCalendar] = useState<CalendarInfo | null>(null)
  const [locations, setLocations] = useState<LocationInfo[]>([])
  const [slots, setSlots] = useState<SlotData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [viewMonth, setViewMonth] = useState<Date>(startOfMonth(new Date()))
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null)

  const [phase, setPhase] = useState<'calendar' | 'form' | 'confirmed'>('calendar')
  const [formData, setFormData] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  // Build slots map
  const slotsMap: Record<string, string[]> = {}
  for (const s of slots) {
    slotsMap[s.date] = s.slots
  }

  const fetchSlots = useCallback(async (month: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/public/booking/${calendarId}?month=${month}`)
      if (!res.ok) {
        setError('Calendrier introuvable ou indisponible.')
        return
      }
      const data = await res.json()
      setCalendar(data.calendar)
      setSlots(data.slots ?? [])
      const locs: LocationInfo[] = data.locations ?? []
      setLocations(locs)
      const inPerson = locs.filter(l => l.location_type === 'in_person')
      if (inPerson.length === 1) setSelectedLocationId(inPerson[0].id)
    } catch {
      setError('Erreur réseau. Veuillez réessayer.')
    } finally {
      setLoading(false)
    }
  }, [calendarId])

  useEffect(() => {
    fetchSlots(format(viewMonth, 'yyyy-MM'))
  }, [viewMonth, fetchSlots])

  // Calendar grid
  const monthStart = startOfMonth(viewMonth)
  const monthEnd = endOfMonth(viewMonth)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: calStart, end: calEnd })

  function hasSlotsOnDay(day: Date): boolean {
    const key = format(day, 'yyyy-MM-dd')
    return (slotsMap[key]?.length ?? 0) > 0
  }

  function handleDayClick(day: Date) {
    if (!isSameMonth(day, viewMonth) || (isPast(day) && !isToday(day)) || !hasSlotsOnDay(day)) return
    setSelectedDate(day)
    setSelectedTime(null)
  }

  const timeSlotsForDay: string[] = selectedDate
    ? (slotsMap[format(selectedDate, 'yyyy-MM-dd')] ?? [])
    : []

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedDate || !selectedTime || !calendar) return

    const inPersonLocs = locations.filter(l => l.location_type === 'in_person')
    if (inPersonLocs.length > 1 && !selectedLocationId) {
      setError('Veuillez choisir un lieu pour le rendez-vous.')
      return
    }

    const dateStr = format(selectedDate, 'yyyy-MM-dd')
    const localDate = new Date(`${dateStr}T${selectedTime}:00`)
    const scheduledAt = localDate.toISOString()

    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/public/booking/${calendarId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduled_at: scheduledAt,
          form_data: formData,
          location_id: selectedLocationId,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Erreur lors de la réservation.')
        return
      }
      // Si une URL de redirection est configurée → redirection (page suivante du
      // funnel ou URL externe). Sinon, fallback sur la confirmation in-page.
      const redirectUrl = config.redirectUrl
      if (redirectUrl && redirectUrl.trim().length > 0) {
        window.location.href = resolveFunnelUrl(redirectUrl)
        return
      }
      setPhase('confirmed')
    } catch {
      setError('Erreur réseau. Veuillez réessayer.')
    } finally {
      setSubmitting(false)
    }
  }

  const accent = 'var(--fnl-primary)'

  // ─── Loading / Error ──────────────────────────────────────────────────────

  if (loading && !calendar) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center' }}>
        {config.title && <h2 style={titleStyle}>{config.title}</h2>}
        <p style={{ color: 'var(--fnl-text-secondary)', fontSize: 14 }}>Chargement des créneaux...</p>
      </div>
    )
  }

  if (error && !calendar) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center' }}>
        {config.title && <h2 style={titleStyle}>{config.title}</h2>}
        <p style={{ color: 'var(--fnl-primary)', fontSize: 14 }}>{error}</p>
      </div>
    )
  }

  if (!calendar) return null

  // ─── Confirmed ────────────────────────────────────────────────────────────

  if (phase === 'confirmed' && selectedDate && selectedTime) {
    return (
      <div style={{ padding: '40px 20px', maxWidth: 500, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
        <h2 style={{ ...titleStyle, marginBottom: 12 }}>Rendez-vous confirmé !</h2>
        <p style={{ color: 'var(--fnl-text-secondary)', fontSize: 15, margin: '0 0 8px', lineHeight: 1.6 }}>
          {format(selectedDate, 'EEEE d MMMM yyyy', { locale: fr })} à {selectedTime}
        </p>
        <p style={{ color: 'var(--fnl-text-secondary)', fontSize: 13, margin: 0, lineHeight: 1.5 }}>
          {calendar.name} — {calendar.duration_minutes} min
        </p>
      </div>
    )
  }

  // ─── Form phase ───────────────────────────────────────────────────────────

  if (phase === 'form' && selectedDate && selectedTime) {
    const dateLabel = format(selectedDate, 'EEEE d MMMM yyyy', { locale: fr })

    return (
      <div style={{ padding: '40px 20px', maxWidth: 500, margin: '0 auto' }}>
        {config.title && <h2 style={titleStyle}>{config.title}</h2>}

        {/* Back button */}
        <button
          onClick={() => setPhase('calendar')}
          style={backButtonStyle}
        >
          ← Changer l&apos;horaire
        </button>

        {/* Recap */}
        <div style={recapStyle}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--fnl-text)', marginBottom: 4 }}>
            {calendar.name}
          </div>
          <div style={{ fontSize: 13, color: 'var(--fnl-text-secondary)', textTransform: 'capitalize' }}>
            {dateLabel} à {selectedTime} — {calendar.duration_minutes} min
          </div>
        </div>

        {/* Location picker */}
        {(() => {
          const inPersonLocs = locations.filter(l => l.location_type === 'in_person')
          if (inPersonLocs.length <= 1) return null
          return (
            <div style={{ marginBottom: 16 }}>
              <label style={fieldLabelStyle}>
                Lieu du rendez-vous <span style={{ color: 'var(--fnl-primary)' }}>*</span>
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {inPersonLocs.map(loc => {
                  const selected = selectedLocationId === loc.id
                  return (
                    <button
                      key={loc.id}
                      type="button"
                      onClick={() => setSelectedLocationId(loc.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 14px', borderRadius: 10,
                        border: selected
                          ? '2px solid var(--fnl-primary)'
                          : '1px solid rgba(var(--fnl-primary-rgb), 0.2)',
                        background: selected
                          ? 'rgba(var(--fnl-primary-rgb), 0.08)'
                          : 'rgba(var(--fnl-primary-rgb), 0.02)',
                        cursor: 'pointer', textAlign: 'left', width: '100%',
                        fontFamily: 'Poppins, sans-serif',
                      }}
                    >
                      <div style={{
                        width: 14, height: 14, borderRadius: '50%',
                        border: `2px solid ${selected ? 'var(--fnl-primary)' : 'rgba(var(--fnl-primary-rgb), 0.3)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        {selected && <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--fnl-primary)' }} />}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fnl-text)' }}>{loc.name}</div>
                        {loc.address && <div style={{ fontSize: 11, color: 'var(--fnl-text-secondary)', marginTop: 2 }}>{loc.address}</div>}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })()}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={fieldLabelStyle}>Prénom <span style={{ color: 'var(--fnl-primary)' }}>*</span></label>
              <input type="text" required value={formData.first_name ?? ''} onChange={e => setFormData(p => ({ ...p, first_name: e.target.value }))} style={fieldInputStyle} />
            </div>
            <div>
              <label style={fieldLabelStyle}>Nom <span style={{ color: 'var(--fnl-primary)' }}>*</span></label>
              <input type="text" required value={formData.last_name ?? ''} onChange={e => setFormData(p => ({ ...p, last_name: e.target.value }))} style={fieldInputStyle} />
            </div>
          </div>
          <div>
            <label style={fieldLabelStyle}>Email <span style={{ color: 'var(--fnl-primary)' }}>*</span></label>
            <input type="email" required value={formData.email ?? ''} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} style={fieldInputStyle} />
          </div>
          <div>
            <label style={fieldLabelStyle}>Téléphone <span style={{ color: 'var(--fnl-primary)' }}>*</span></label>
            <input type="tel" required value={formData.phone ?? ''} onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))} style={fieldInputStyle} />
          </div>

          {/* Custom fields from calendar (exclude base fields) */}
          {(calendar.form_fields ?? [])
            .filter(f => !BASE_FIELDS.includes(f.key))
            .map(field => (
              <div key={field.key}>
                <label style={fieldLabelStyle}>
                  {field.label}
                  {field.required && <span style={{ color: 'var(--fnl-primary)', marginLeft: 4 }}>*</span>}
                </label>
                {field.type === 'textarea' ? (
                  <textarea
                    required={field.required}
                    value={formData[field.key] ?? ''}
                    onChange={e => setFormData(p => ({ ...p, [field.key]: e.target.value }))}
                    rows={3}
                    style={{ ...fieldInputStyle, resize: 'vertical' as const }}
                  />
                ) : field.type === 'select' && field.options ? (
                  <select
                    required={field.required}
                    value={formData[field.key] ?? ''}
                    onChange={e => setFormData(p => ({ ...p, [field.key]: e.target.value }))}
                    style={fieldInputStyle}
                  >
                    <option value="" disabled>Sélectionner...</option>
                    {field.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                ) : (
                  <input
                    type={field.type}
                    required={field.required}
                    value={formData[field.key] ?? ''}
                    onChange={e => setFormData(p => ({ ...p, [field.key]: e.target.value }))}
                    style={fieldInputStyle}
                  />
                )}
              </div>
            ))}

          {error && <div style={{ color: 'var(--fnl-primary)', fontSize: 13 }}>{error}</div>}

          <button type="submit" disabled={submitting} style={submitButtonStyle(submitting)}>
            {submitting ? 'Confirmation...' : 'Confirmer le rendez-vous'}
          </button>
        </form>
      </div>
    )
  }

  // ─── Calendar phase (date + time selection) ───────────────────────────────

  const monthLabel = format(viewMonth, 'MMMM yyyy', { locale: fr })

  return (
    <div style={{ padding: '40px 20px', maxWidth: 700, margin: '0 auto' }}>
      {config.title && <h2 style={titleStyle}>{config.title}</h2>}
      {config.subtitle && <p style={subtitleStyle}>{config.subtitle}</p>}

      <div style={widgetContainerStyle}>
        {/* Left: month calendar */}
        <div style={calendarColumnStyle}>
          {/* Month nav */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <button onClick={() => setViewMonth(subMonths(viewMonth, 1))} style={navButtonStyle} aria-label="Mois précédent">‹</button>
            <span style={{ color: 'var(--fnl-text)', fontSize: 14, fontWeight: 700, textTransform: 'capitalize' }}>
              {monthLabel}
            </span>
            <button onClick={() => setViewMonth(addMonths(viewMonth, 1))} style={navButtonStyle} aria-label="Mois suivant">›</button>
          </div>

          {/* Day labels */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
            {DAY_LABELS.map((label, i) => (
              <div key={i} style={{ textAlign: 'center', fontSize: 11, color: 'var(--fnl-text-secondary)', padding: '4px 0', fontWeight: 600 }}>
                {label}
              </div>
            ))}
          </div>

          {/* Days grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
            {days.map(day => {
              const inMonth = isSameMonth(day, viewMonth)
              const isSelected = selectedDate ? isSameDay(day, selectedDate) : false
              const isPastDay = isPast(day) && !isToday(day)
              const hasSlots = hasSlotsOnDay(day)
              const isClickable = inMonth && !isPastDay && hasSlots

              return (
                <button
                  key={day.toISOString()}
                  onClick={() => isClickable && handleDayClick(day)}
                  disabled={!isClickable}
                  style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: isSelected ? accent : 'transparent',
                    color: !inMonth ? 'transparent'
                      : isSelected ? '#fff'
                      : 'var(--fnl-text)',
                    // Opacity adaptative au thème (claire ou sombre) sans rgba bloqué
                    // sur var(--fnl-text-rgb) qui n'est pas défini par les presets.
                    opacity: !inMonth ? 0
                      : isSelected ? 1
                      : isPastDay ? 0.5
                      : !hasSlots ? 0.7
                      : 1,
                    border: 'none', outline: 'none',
                    cursor: isClickable ? 'pointer' : 'default',
                    fontSize: 13, fontWeight: hasSlots && inMonth && !isPastDay ? 700 : 400,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto', transition: 'background 0.15s',
                    fontFamily: 'Poppins, sans-serif',
                  }}
                >
                  {format(day, 'd')}
                </button>
              )
            })}
          </div>
        </div>

        {/* Right: time slots */}
        <div style={slotsColumnStyle}>
          {!selectedDate ? (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fnl-text-secondary)', fontSize: 13, textAlign: 'center', padding: '0 16px' }}>
              Sélectionne une date pour voir les créneaux disponibles
            </div>
          ) : (
            <>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--fnl-text)', marginBottom: 12, textTransform: 'capitalize' }}>
                {format(selectedDate, 'EEEE d MMMM', { locale: fr })}
              </div>
              {loading ? (
                <div style={{ color: 'var(--fnl-text-secondary)', fontSize: 13 }}>Chargement...</div>
              ) : timeSlotsForDay.length === 0 ? (
                <div style={{ color: 'var(--fnl-text-secondary)', fontSize: 13 }}>Aucun créneau disponible.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 300, overflowY: 'auto' }}>
                  {timeSlotsForDay.map(time => (
                    <button
                      key={time}
                      onClick={() => {
                        setSelectedTime(time)
                        setPhase('form')
                      }}
                      style={{
                        padding: '10px 14px',
                        background: selectedTime === time
                          ? 'rgba(var(--fnl-primary-rgb), 0.15)'
                          : 'rgba(var(--fnl-primary-rgb), 0.04)',
                        border: selectedTime === time
                          ? '1.5px solid var(--fnl-primary)'
                          : '1px solid rgba(var(--fnl-primary-rgb), 0.15)',
                        borderRadius: 10, color: 'var(--fnl-text)',
                        fontSize: 14, fontWeight: 600, cursor: 'pointer',
                        textAlign: 'left', transition: 'all 0.15s',
                        fontFamily: 'Poppins, sans-serif',
                      }}
                    >
                      {time}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const titleStyle: React.CSSProperties = {
  fontSize: 28, fontWeight: 800, color: 'var(--fnl-primary)',
  margin: '0 0 8px', textAlign: 'center', lineHeight: 1.3,
}

const subtitleStyle: React.CSSProperties = {
  fontSize: 16, color: 'var(--fnl-text-secondary)',
  margin: '0 0 28px', textAlign: 'center', lineHeight: 1.6,
}

const placeholderCardStyle: React.CSSProperties = {
  border: '2px dashed rgba(var(--fnl-primary-rgb), 0.3)',
  borderRadius: 20, padding: '48px 24px', textAlign: 'center',
  background: 'linear-gradient(135deg, rgba(var(--fnl-primary-rgb), 0.06) 0%, rgba(var(--fnl-primary-rgb), 0.02) 100%)',
}

const widgetContainerStyle: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0,
  background: 'var(--fnl-section-bg, rgba(var(--fnl-primary-rgb), 0.02))',
  border: '1px solid rgba(var(--fnl-primary-rgb), 0.12)',
  borderRadius: 20, overflow: 'hidden',
}

const calendarColumnStyle: React.CSSProperties = {
  padding: 20, borderRight: '1px solid rgba(var(--fnl-primary-rgb), 0.1)',
}

const slotsColumnStyle: React.CSSProperties = {
  padding: 20,
}

const navButtonStyle: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: 'var(--fnl-text-secondary)', fontSize: 20, padding: '4px 8px',
  display: 'flex', alignItems: 'center', fontFamily: 'Poppins, sans-serif',
}

const backButtonStyle: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: 'var(--fnl-text-secondary)', fontSize: 13, padding: 0,
  marginBottom: 16, fontFamily: 'Poppins, sans-serif',
}

const recapStyle: React.CSSProperties = {
  background: 'rgba(var(--fnl-primary-rgb), 0.05)',
  border: '1px solid rgba(var(--fnl-primary-rgb), 0.12)',
  borderRadius: 12, padding: 14, marginBottom: 20,
}

const fieldLabelStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: 'var(--fnl-text)',
  display: 'block', marginBottom: 6,
}

const fieldInputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', fontSize: 14,
  border: '1px solid rgba(var(--fnl-primary-rgb), 0.2)',
  borderRadius: 10, background: 'rgba(var(--fnl-primary-rgb), 0.03)',
  color: 'var(--fnl-text)', outline: 'none', boxSizing: 'border-box',
  fontFamily: 'Poppins, sans-serif',
}

const submitButtonStyle = (disabled: boolean): React.CSSProperties => ({
  padding: '14px 28px', fontSize: 16, fontWeight: 700, color: '#fff',
  background: disabled
    ? 'rgba(var(--fnl-primary-rgb), 0.4)'
    : 'linear-gradient(135deg, var(--fnl-primary) 0%, var(--fnl-primary-light) 100%)',
  border: 'none', borderRadius: 50, marginTop: 4,
  cursor: disabled ? 'not-allowed' : 'pointer',
  fontFamily: 'Poppins, sans-serif',
  boxShadow: disabled ? 'none' : '0 6px 20px rgba(var(--fnl-primary-rgb), 0.25)',
  transition: 'all 0.2s',
})

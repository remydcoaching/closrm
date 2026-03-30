'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
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
import { ChevronLeft, ChevronRight, Clock, MapPin } from 'lucide-react'
import type { FormField } from '@/types'

// ─── Types ───────────────────────────────────────────────────────────────────

interface CalendarInfo {
  name: string
  description: string | null
  duration_minutes: number
  location: string | null
  color: string
  form_fields: FormField[]
}

interface WorkspaceInfo {
  name: string | null
  owner_name: string | null
  avatar_url: string | null
}

interface SlotData {
  date: string   // "2026-04-07"
  slots: string[] // ["09:00", "09:30", ...]
}

// ─── Constants ───────────────────────────────────────────────────────────────

const DAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

// ─── Component ───────────────────────────────────────────────────────────────

export default function PublicBookingPage() {
  const params = useParams<{ workspaceSlug: string; calendarSlug: string }>()
  const router = useRouter()

  // Data
  const [calendar, setCalendar] = useState<CalendarInfo | null>(null)
  const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(null)
  const [slots, setSlots] = useState<SlotData[]>([])

  // UI state
  const [loading, setLoading] = useState(true)
  const [viewMonth, setViewMonth] = useState<Date>(startOfMonth(new Date()))
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Build a map: "YYYY-MM-DD" → string[]
  const slotsMap: Record<string, string[]> = {}
  for (const s of slots) {
    slotsMap[s.date] = s.slots
  }

  // ─── Fetch slots ─────────────────────────────────────────────────────────

  useEffect(() => {
    const month = format(viewMonth, 'yyyy-MM')
    fetchSlots(month)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMonth])

  async function fetchSlots(month: string) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/public/book/${params.workspaceSlug}/${params.calendarSlug}?month=${month}`,
      )
      if (!res.ok) {
        setError('Calendrier introuvable ou indisponible.')
        return
      }
      const data = await res.json()
      setCalendar(data.calendar)
      setWorkspace(data.workspace)
      setSlots(data.slots ?? [])
    } catch {
      setError('Erreur réseau. Veuillez réessayer.')
    } finally {
      setLoading(false)
    }
  }

  // ─── Calendar grid ───────────────────────────────────────────────────────

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
    if (!isSameMonth(day, viewMonth)) return
    if (isPast(day) && !isToday(day)) return
    if (!hasSlotsOnDay(day)) return
    setSelectedDate(day)
    setSelectedTime(null)
  }

  // ─── Time slots for selected date ────────────────────────────────────────

  const timeSlotsForDay: string[] = selectedDate
    ? (slotsMap[format(selectedDate, 'yyyy-MM-dd')] ?? [])
    : []

  // ─── Form submit ─────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedDate || !selectedTime || !calendar) return

    // Build ISO datetime: combine date + time
    const dateStr = format(selectedDate, 'yyyy-MM-dd')
    const scheduledAt = `${dateStr}T${selectedTime}:00`

    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/public/book/${params.workspaceSlug}/${params.calendarSlug}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scheduled_at: scheduledAt, form_data: formData }),
        },
      )
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Erreur lors de la réservation.')
        return
      }
      // Redirect to confirmation page
      const dateParam = encodeURIComponent(dateStr)
      const timeParam = encodeURIComponent(selectedTime)
      router.push(
        `/book/${params.workspaceSlug}/${params.calendarSlug}/confirmation?date=${dateParam}&time=${timeParam}`,
      )
    } catch {
      setError('Erreur réseau. Veuillez réessayer.')
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Accent color ────────────────────────────────────────────────────────

  const accent = calendar?.color ?? '#E53E3E'

  // ─── Render: loading / error ─────────────────────────────────────────────

  if (loading && !calendar) {
    return (
      <div style={{ color: '#A0A0A0', fontSize: '14px', textAlign: 'center', padding: '40px' }}>
        Chargement…
      </div>
    )
  }

  if (error && !calendar) {
    return (
      <div style={{ color: '#E53E3E', fontSize: '14px', textAlign: 'center', padding: '40px' }}>
        {error}
      </div>
    )
  }

  if (!calendar || !workspace) return null

  // ─── Render: form phase ──────────────────────────────────────────────────

  if (showForm && selectedDate && selectedTime) {
    const dateLabel = format(selectedDate, 'EEEE d MMMM yyyy', { locale: fr })

    return (
      <div
        style={{
          width: '100%',
          maxWidth: '480px',
          margin: '40px auto',
          padding: '0 16px',
        }}
      >
        {/* Back button */}
        <button
          onClick={() => setShowForm(false)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#A0A0A0',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginBottom: '24px',
            padding: '0',
          }}
        >
          <ChevronLeft size={16} />
          Changer l&apos;horaire
        </button>

        {/* Recap */}
        <div
          style={{
            background: '#141414',
            border: '1px solid #262626',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '24px',
          }}
        >
          <div style={{ color: '#FFFFFF', fontWeight: 600, fontSize: '15px', marginBottom: '8px' }}>
            {calendar.name}
          </div>
          <div style={{ color: '#A0A0A0', fontSize: '13px', textTransform: 'capitalize' }}>
            {dateLabel} à {selectedTime}
          </div>
          <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
            <span style={{ color: '#A0A0A0', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Clock size={12} /> {calendar.duration_minutes} min
            </span>
            {calendar.location && (
              <span style={{ color: '#A0A0A0', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <MapPin size={12} /> {calendar.location}
              </span>
            )}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {calendar.form_fields.map((field) => (
              <div key={field.key}>
                <label
                  htmlFor={field.key}
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    color: '#FFFFFF',
                    marginBottom: '6px',
                    fontWeight: 500,
                  }}
                >
                  {field.label}
                  {field.required && (
                    <span style={{ color: accent, marginLeft: '2px' }}>*</span>
                  )}
                </label>

                {field.type === 'textarea' ? (
                  <textarea
                    id={field.key}
                    required={field.required}
                    value={formData[field.key] ?? ''}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, [field.key]: e.target.value }))
                    }
                    rows={3}
                    style={{
                      width: '100%',
                      background: '#141414',
                      border: '1px solid #262626',
                      borderRadius: '8px',
                      padding: '10px 12px',
                      color: '#FFFFFF',
                      fontSize: '14px',
                      resize: 'vertical',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                ) : field.type === 'select' && field.options ? (
                  <select
                    id={field.key}
                    required={field.required}
                    value={formData[field.key] ?? ''}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, [field.key]: e.target.value }))
                    }
                    style={{
                      width: '100%',
                      background: '#141414',
                      border: '1px solid #262626',
                      borderRadius: '8px',
                      padding: '10px 12px',
                      color: formData[field.key] ? '#FFFFFF' : '#A0A0A0',
                      fontSize: '14px',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  >
                    <option value="" disabled>Sélectionner…</option>
                    {field.options.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={field.key}
                    type={field.type}
                    required={field.required}
                    value={formData[field.key] ?? ''}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, [field.key]: e.target.value }))
                    }
                    style={{
                      width: '100%',
                      background: '#141414',
                      border: '1px solid #262626',
                      borderRadius: '8px',
                      padding: '10px 12px',
                      color: '#FFFFFF',
                      fontSize: '14px',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                )}
              </div>
            ))}
          </div>

          {error && (
            <div style={{ color: '#E53E3E', fontSize: '13px', marginTop: '16px' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            style={{
              width: '100%',
              marginTop: '24px',
              padding: '14px',
              background: submitting ? '#555' : accent,
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              fontSize: '15px',
              fontWeight: 600,
              cursor: submitting ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s',
            }}
          >
            {submitting ? 'Confirmation…' : 'Confirmer le rendez-vous'}
          </button>
        </form>
      </div>
    )
  }

  // ─── Render: date/time selection phase ──────────────────────────────────

  const monthLabel = format(viewMonth, 'MMMM yyyy', { locale: fr })

  // Avatar initials
  const ownerName = workspace.owner_name ?? workspace.name ?? ''
  const initials = ownerName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '860px',
        margin: '40px auto',
        padding: '0 16px',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          marginBottom: '32px',
        }}
      >
        {workspace.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={workspace.avatar_url}
            alt={ownerName}
            style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover' }}
          />
        ) : (
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: accent,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              fontWeight: 700,
              fontSize: '18px',
            }}
          >
            {initials || '?'}
          </div>
        )}
        <div>
          <div style={{ color: '#A0A0A0', fontSize: '13px' }}>
            {workspace.name}
          </div>
          <div style={{ color: '#FFFFFF', fontWeight: 700, fontSize: '20px' }}>
            {calendar.name}
          </div>
          <div style={{ display: 'flex', gap: '16px', marginTop: '4px' }}>
            <span style={{ color: '#A0A0A0', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Clock size={12} /> {calendar.duration_minutes} min
            </span>
            {calendar.location && (
              <span style={{ color: '#A0A0A0', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <MapPin size={12} /> {calendar.location}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '24px',
          background: '#141414',
          border: '1px solid #262626',
          borderRadius: '16px',
          overflow: 'hidden',
        }}
      >
        {/* Left: monthly calendar */}
        <div style={{ padding: '24px', borderRight: '1px solid #262626' }}>
          {/* Month navigation */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px',
            }}
          >
            <button
              onClick={() => setViewMonth(subMonths(viewMonth, 1))}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#A0A0A0',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
              }}
              aria-label="Mois précédent"
            >
              <ChevronLeft size={18} />
            </button>
            <span
              style={{
                color: '#FFFFFF',
                fontSize: '15px',
                fontWeight: 600,
                textTransform: 'capitalize',
              }}
            >
              {monthLabel}
            </span>
            <button
              onClick={() => setViewMonth(addMonths(viewMonth, 1))}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#A0A0A0',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
              }}
              aria-label="Mois suivant"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Day labels */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              marginBottom: '6px',
            }}
          >
            {DAY_LABELS.map((label, i) => (
              <div
                key={i}
                style={{
                  textAlign: 'center',
                  fontSize: '12px',
                  color: '#A0A0A0',
                  padding: '4px 0',
                  fontWeight: 500,
                }}
              >
                {label}
              </div>
            ))}
          </div>

          {/* Days grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: '4px',
            }}
          >
            {days.map((day) => {
              const inMonth = isSameMonth(day, viewMonth)
              const isSelected = selectedDate ? isSameDay(day, selectedDate) : false
              const isPastDay = isPast(day) && !isToday(day)
              const hasSlots = hasSlotsOnDay(day)
              const isClickable = inMonth && !isPastDay && hasSlots

              let background = 'transparent'
              let color = '#333333'
              let cursor = 'default'

              if (!inMonth) {
                color = '#222222'
              } else if (isSelected) {
                background = accent
                color = '#FFFFFF'
                cursor = 'pointer'
              } else if (isPastDay) {
                color = '#333333'
              } else if (!hasSlots) {
                color = '#444444'
              } else {
                color = '#FFFFFF'
                cursor = 'pointer'
              }

              return (
                <button
                  key={day.toISOString()}
                  onClick={() => isClickable && handleDayClick(day)}
                  disabled={!isClickable}
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background,
                    color,
                    border: 'none',
                    outline: 'none',
                    cursor,
                    fontSize: '13px',
                    fontWeight: hasSlots && inMonth && !isPastDay ? 600 : 400,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    if (isClickable && !isSelected) {
                      ;(e.currentTarget as HTMLButtonElement).style.background = '#2a2a2a'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (isClickable && !isSelected) {
                      ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                    }
                  }}
                  aria-label={format(day, 'd MMMM yyyy', { locale: fr })}
                  aria-pressed={isSelected}
                >
                  {format(day, 'd')}
                </button>
              )
            })}
          </div>
        </div>

        {/* Right: time slots */}
        <div style={{ padding: '24px' }}>
          {!selectedDate ? (
            <div
              style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#A0A0A0',
                fontSize: '14px',
                textAlign: 'center',
              }}
            >
              Sélectionnez une date pour voir les créneaux disponibles
            </div>
          ) : (
            <>
              <div
                style={{
                  color: '#FFFFFF',
                  fontWeight: 600,
                  fontSize: '14px',
                  marginBottom: '16px',
                  textTransform: 'capitalize',
                }}
              >
                {format(selectedDate, 'EEEE d MMMM', { locale: fr })}
              </div>

              {loading ? (
                <div style={{ color: '#A0A0A0', fontSize: '13px' }}>Chargement…</div>
              ) : timeSlotsForDay.length === 0 ? (
                <div style={{ color: '#A0A0A0', fontSize: '13px' }}>
                  Aucun créneau disponible ce jour.
                </div>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    maxHeight: '320px',
                    overflowY: 'auto',
                  }}
                >
                  {timeSlotsForDay.map((time) => {
                    const isSelectedTime = selectedTime === time
                    return (
                      <button
                        key={time}
                        onClick={() => {
                          setSelectedTime(time)
                          setShowForm(true)
                        }}
                        style={{
                          padding: '12px 16px',
                          background: isSelectedTime ? accent : '#0a0a0c',
                          border: `1px solid ${isSelectedTime ? accent : '#262626'}`,
                          borderRadius: '8px',
                          color: '#FFFFFF',
                          fontSize: '14px',
                          fontWeight: 500,
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'background 0.15s, border-color 0.15s',
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelectedTime) {
                            ;(e.currentTarget as HTMLButtonElement).style.background = '#1f1f1f'
                            ;(e.currentTarget as HTMLButtonElement).style.borderColor = '#444'
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelectedTime) {
                            ;(e.currentTarget as HTMLButtonElement).style.background = '#0a0a0c'
                            ;(e.currentTarget as HTMLButtonElement).style.borderColor = '#262626'
                          }
                        }}
                      >
                        {time}
                      </button>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}


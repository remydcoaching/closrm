'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { X } from 'lucide-react'
import { BookingCalendar, Lead } from '@/types'

interface NewBookingModalProps {
  calendars: BookingCalendar[]
  prefillDate: string   // "2026-04-01"
  prefillTime: string   // "14:00"
  onClose: () => void
  onCreated: () => void
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--bg-input)',
  border: '1px solid var(--border-secondary)',
  borderRadius: 8,
  color: 'var(--text-primary)',
  padding: '8px 12px',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  color: 'var(--text-secondary)',
  fontSize: 12,
  marginBottom: 6,
}

export default function NewBookingModal({
  calendars,
  prefillDate,
  prefillTime,
  onClose,
  onCreated,
}: NewBookingModalProps) {
  const [isPersonal, setIsPersonal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Calendar mode
  const [calendarId, setCalendarId] = useState<string>(calendars[0]?.id ?? '')
  const [leadSearch, setLeadSearch] = useState('')
  const [leadResults, setLeadResults] = useState<Lead[]>([])
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)

  // Personal mode
  const [title, setTitle] = useState('')

  // Shared
  const [date, setDate] = useState(prefillDate)
  const [time, setTime] = useState(prefillTime)
  const [duration, setDuration] = useState<number>(
    calendars[0]?.duration_minutes ?? 60
  )
  const [notes, setNotes] = useState('')

  const overlayRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Update duration when calendar changes
  useEffect(() => {
    const cal = calendars.find((c) => c.id === calendarId)
    if (cal) setDuration(cal.duration_minutes)
  }, [calendarId, calendars])

  // Lead search debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (leadSearch.length < 2) {
      setLeadResults([])
      return
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/leads?search=${encodeURIComponent(leadSearch)}&per_page=5`)
        if (res.ok) {
          const data = await res.json()
          setLeadResults(data.leads ?? [])
        }
      } catch {
        // silently ignore search errors
      }
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [leadSearch])

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === overlayRef.current) onClose()
    },
    [onClose]
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const scheduledAt = `${date}T${time}:00`

      const body = isPersonal
        ? {
            is_personal: true,
            title,
            scheduled_at: scheduledAt,
            duration_minutes: duration,
            notes: notes || null,
          }
        : {
            is_personal: false,
            calendar_id: calendarId || null,
            lead_id: selectedLead?.id ?? null,
            title: selectedLead
              ? `${selectedLead.first_name} ${selectedLead.last_name}`.trim()
              : 'Rendez-vous',
            scheduled_at: scheduledAt,
            duration_minutes: duration,
            notes: notes || null,
          }

      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Erreur lors de la création')
      }

      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-secondary)',
          borderRadius: 12,
          width: 460,
          maxWidth: 'calc(100vw - 32px)',
          maxHeight: 'calc(100vh - 64px)',
          overflowY: 'auto',
          padding: 24,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 20,
          }}
        >
          <span style={{ color: 'var(--text-primary)', fontSize: 16, fontWeight: 600 }}>
            Nouveau rendez-vous
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              padding: 2,
            }}
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Mode toggle */}
        <div
          style={{
            display: 'flex',
            gap: 4,
            background: 'var(--bg-input)',
            border: '1px solid var(--border-secondary)',
            borderRadius: 8,
            padding: 4,
            marginBottom: 20,
          }}
        >
          {(['Calendrier', 'Événement perso'] as const).map((label, i) => {
            const active = i === 0 ? !isPersonal : isPersonal
            return (
              <button
                key={label}
                type="button"
                onClick={() => setIsPersonal(i === 1)}
                style={{
                  flex: 1,
                  background: active ? 'var(--border-secondary)' : 'transparent',
                  border: 'none',
                  borderRadius: 6,
                  color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                  padding: '6px 0',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {label}
              </button>
            )
          })}
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Calendar mode */}
            {!isPersonal && (
              <>
                {/* Calendar picker */}
                {calendars.length > 0 && (
                  <div>
                    <label style={labelStyle}>Calendrier</label>
                    <select
                      value={calendarId}
                      onChange={(e) => setCalendarId(e.target.value)}
                      style={{ ...inputStyle, cursor: 'pointer' }}
                    >
                      {calendars.map((cal) => (
                        <option key={cal.id} value={cal.id}>
                          {cal.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Lead search */}
                <div>
                  <label style={labelStyle}>Lead</label>
                  {selectedLead ? (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        ...inputStyle,
                      }}
                    >
                      <span style={{ fontSize: 14 }}>
                        {selectedLead.first_name} {selectedLead.last_name}
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedLead(null)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--text-secondary)',
                          display: 'flex',
                          alignItems: 'center',
                          padding: 0,
                        }}
                        aria-label="Désélectionner le lead"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div style={{ position: 'relative' }}>
                      <input
                        type="text"
                        placeholder="Rechercher un lead..."
                        value={leadSearch}
                        onChange={(e) => setLeadSearch(e.target.value)}
                        style={inputStyle}
                      />
                      {leadResults.length > 0 && (
                        <div
                          style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            background: 'var(--bg-input)',
                            border: '1px solid var(--border-secondary)',
                            borderRadius: 8,
                            marginTop: 4,
                            zIndex: 10,
                            overflow: 'hidden',
                          }}
                        >
                          {leadResults.map((lead) => (
                            <button
                              key={lead.id}
                              type="button"
                              onClick={() => {
                                setSelectedLead(lead)
                                setLeadSearch('')
                                setLeadResults([])
                              }}
                              style={{
                                display: 'block',
                                width: '100%',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                color: 'var(--text-primary)',
                                fontSize: 13,
                                padding: '8px 12px',
                                textAlign: 'left',
                              }}
                              onMouseEnter={(e) => {
                                (e.currentTarget as HTMLButtonElement).style.background = 'var(--border-secondary)'
                              }}
                              onMouseLeave={(e) => {
                                (e.currentTarget as HTMLButtonElement).style.background = 'none'
                              }}
                            >
                              {lead.first_name} {lead.last_name}
                              {lead.phone && (
                                <span style={{ color: 'var(--text-secondary)', marginLeft: 8, fontSize: 12 }}>
                                  {lead.phone}
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Personal mode */}
            {isPersonal && (
              <div>
                <label style={labelStyle}>Titre</label>
                <input
                  type="text"
                  placeholder="Titre de l'événement"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  style={inputStyle}
                />
              </div>
            )}

            {/* Date + Time */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  style={{ ...inputStyle, colorScheme: 'dark' }}
                />
              </div>
              <div>
                <label style={labelStyle}>Heure</label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  required
                  style={{ ...inputStyle, colorScheme: 'dark' }}
                />
              </div>
            </div>

            {/* Duration */}
            <div>
              <label style={labelStyle}>Durée (minutes)</label>
              <input
                type="number"
                min={5}
                max={480}
                step={5}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                required
                style={inputStyle}
              />
            </div>

            {/* Notes */}
            <div>
              <label style={labelStyle}>Notes</label>
              <textarea
                placeholder="Notes optionnelles..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>

            {error && (
              <div
                style={{
                  background: '#2d1515',
                  border: '1px solid #E53E3E',
                  borderRadius: 8,
                  color: '#fc8181',
                  fontSize: 13,
                  padding: '8px 12px',
                }}
              >
                {error}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  background: 'none',
                  border: '1px solid var(--border-secondary)',
                  borderRadius: 8,
                  color: 'var(--text-secondary)',
                  fontSize: 14,
                  padding: '8px 16px',
                  cursor: 'pointer',
                }}
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={loading}
                style={{
                  background: loading ? '#8b2020' : '#E53E3E',
                  border: 'none',
                  borderRadius: 8,
                  color: 'var(--text-primary)',
                  fontSize: 14,
                  fontWeight: 600,
                  padding: '8px 20px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'background 0.15s',
                }}
              >
                {loading ? 'Création...' : 'Créer'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

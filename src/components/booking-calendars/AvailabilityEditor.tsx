'use client'

import { useState, useRef, useCallback } from 'react'
import { WeekAvailability, DayOfWeek, TimeSlot } from '@/types'

interface AvailabilityEditorProps {
  availability: WeekAvailability
  onChange: (availability: WeekAvailability) => void
}

const DAY_LABELS: { key: DayOfWeek; label: string }[] = [
  { key: 'monday', label: 'Lundi' },
  { key: 'tuesday', label: 'Mardi' },
  { key: 'wednesday', label: 'Mercredi' },
  { key: 'thursday', label: 'Jeudi' },
  { key: 'friday', label: 'Vendredi' },
  { key: 'saturday', label: 'Samedi' },
  { key: 'sunday', label: 'Dimanche' },
]

const PERMANENT_SLOT: TimeSlot = { start: '00:00', end: '23:59' }

function makePermanentAvailability(): WeekAvailability {
  return {
    monday: [{ ...PERMANENT_SLOT }],
    tuesday: [{ ...PERMANENT_SLOT }],
    wednesday: [{ ...PERMANENT_SLOT }],
    thursday: [{ ...PERMANENT_SLOT }],
    friday: [{ ...PERMANENT_SLOT }],
    saturday: [{ ...PERMANENT_SLOT }],
    sunday: [{ ...PERMANENT_SLOT }],
  }
}

function isPermanent(availability: WeekAvailability): boolean {
  return DAY_LABELS.every(({ key }) => {
    const slots = availability[key]
    return slots.length === 1 && slots[0].start === '00:00' && slots[0].end === '23:59'
  })
}

export default function AvailabilityEditor({ availability, onChange }: AvailabilityEditorProps) {
  const [permanent, setPermanent] = useState(() => isPermanent(availability))
  const savedAvailabilityRef = useRef<WeekAvailability | null>(null)

  const togglePermanent = useCallback(() => {
    if (!permanent) {
      // Activate permanent: save current state, then set 24/7
      savedAvailabilityRef.current = availability
      setPermanent(true)
      onChange(makePermanentAvailability())
    } else {
      // Deactivate permanent: restore previous state
      setPermanent(false)
      if (savedAvailabilityRef.current) {
        onChange(savedAvailabilityRef.current)
        savedAvailabilityRef.current = null
      }
    }
  }, [permanent, availability, onChange])
  function addSlot(day: DayOfWeek) {
    const updated = { ...availability, [day]: [...availability[day], { start: '09:00', end: '17:00' }] }
    onChange(updated)
  }

  function removeSlot(day: DayOfWeek, index: number) {
    const updated = { ...availability, [day]: availability[day].filter((_, i) => i !== index) }
    onChange(updated)
  }

  function updateSlot(day: DayOfWeek, index: number, field: keyof TimeSlot, value: string) {
    const slots = [...availability[day]]
    slots[index] = { ...slots[index], [field]: value }
    onChange({ ...availability, [day]: slots })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Toggle Permanent */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 14px',
          background: permanent ? 'rgba(229, 62, 62, 0.08)' : 'var(--bg-elevated)',
          border: `1px solid ${permanent ? 'var(--color-primary)' : 'var(--border-primary)'}`,
          borderRadius: 8,
          marginBottom: 4,
          transition: 'all 0.2s ease',
        }}
      >
        {/* Clock/infinity icon */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke={permanent ? 'var(--color-primary)' : 'var(--text-muted)'}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ transition: 'stroke 0.2s ease' }}
          >
            {/* Infinity icon */}
            <path d="M18.178 8c5.096 0 5.096 8 0 8-5.095 0-7.133-8-12.739-8-4.585 0-4.585 8 0 8 5.606 0 7.644-8 12.74-8z" />
          </svg>
        </div>

        {/* Label + description */}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
            Permanent
          </div>
          {permanent && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.3 }}>
              Les rendez-vous peuvent être pris à tout moment, sans restriction de créneaux.
            </div>
          )}
        </div>

        {/* Toggle pill */}
        <button
          type="button"
          onClick={togglePermanent}
          style={{
            position: 'relative',
            width: 40,
            height: 22,
            borderRadius: 11,
            border: 'none',
            background: permanent ? 'var(--color-primary)' : 'var(--border-primary)',
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'background 0.2s ease',
            padding: 0,
          }}
          title={permanent ? 'Désactiver le mode permanent' : 'Activer le mode permanent (24/7)'}
        >
          <span
            style={{
              position: 'absolute',
              top: 3,
              left: permanent ? 21 : 3,
              width: 16,
              height: 16,
              borderRadius: '50%',
              background: '#fff',
              transition: 'left 0.2s ease',
              boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            }}
          />
        </button>
      </div>

      {/* Day grid */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          opacity: permanent ? 0.4 : 1,
          pointerEvents: permanent ? 'none' : 'auto',
          transition: 'opacity 0.2s ease',
        }}
      >
      {DAY_LABELS.map(({ key, label }) => {
        const slots = availability[key]
        return (
          <div key={key} style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            {/* Day label */}
            <div
              style={{
                width: 80,
                flexShrink: 0,
                paddingTop: slots.length > 0 ? 8 : 0,
                fontSize: 13,
                color: 'var(--text-primary)',
                fontWeight: 500,
              }}
            >
              {label}
            </div>

            {/* Slots column */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {slots.length === 0 && (
                <span style={{ fontSize: 13, color: 'var(--text-muted)', paddingTop: 1 }}>Fermé</span>
              )}
              {slots.map((slot, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="time"
                    value={slot.start}
                    onChange={e => updateSlot(key, idx, 'start', e.target.value)}
                    style={{
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-primary)',
                      borderRadius: 6,
                      padding: '5px 10px',
                      fontSize: 13,
                      color: 'var(--text-primary)',
                      outline: 'none',
                    }}
                  />
                  <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>→</span>
                  <input
                    type="time"
                    value={slot.end}
                    onChange={e => updateSlot(key, idx, 'end', e.target.value)}
                    style={{
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-primary)',
                      borderRadius: 6,
                      padding: '5px 10px',
                      fontSize: 13,
                      color: 'var(--text-primary)',
                      outline: 'none',
                    }}
                  />
                  <button
                    onClick={() => removeSlot(key, idx)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      fontSize: 16,
                      lineHeight: 1,
                      padding: '0 4px',
                    }}
                    title="Supprimer cette plage"
                  >
                    ×
                  </button>
                </div>
              ))}

              <button
                onClick={() => addSlot(key)}
                style={{
                  background: 'none',
                  border: '1px dashed var(--border-primary)',
                  borderRadius: 6,
                  padding: '4px 10px',
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  alignSelf: 'flex-start',
                }}
              >
                + Ajouter une plage
              </button>
            </div>
          </div>
        )
      })}
      </div>
    </div>
  )
}

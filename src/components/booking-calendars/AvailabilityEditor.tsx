'use client'

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

export default function AvailabilityEditor({ availability, onChange }: AvailabilityEditorProps) {
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
  )
}

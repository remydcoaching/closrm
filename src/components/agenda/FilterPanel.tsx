'use client'

import { X } from 'lucide-react'
import { BookingCalendar } from '@/types'

type FilterType = 'all' | 'bookings' | 'blocked'

interface FilterPanelProps {
  isOpen: boolean
  onClose: () => void
  filterType: FilterType
  onFilterTypeChange: (type: FilterType) => void
  calendars: BookingCalendar[]
  visibleCalendarIds: Set<string>
  onToggleCalendar: (id: string) => void
  showPersonal: boolean
  onTogglePersonal: () => void
}

const FILTER_TYPES: { value: FilterType; label: string }[] = [
  { value: 'all', label: 'Tous' },
  { value: 'bookings', label: 'Rendez-vous' },
  { value: 'blocked', label: 'Créneaux bloqués' },
]

export function FilterPanel({
  isOpen, onClose, filterType, onFilterTypeChange,
  calendars, visibleCalendarIds, onToggleCalendar,
  showPersonal, onTogglePersonal,
}: FilterPanelProps) {
  if (!isOpen) return null

  return (
    <div style={{
      width: 300, flexShrink: 0, borderLeft: '1px solid var(--border-secondary)',
      background: 'var(--bg-elevated)', padding: 20, overflowY: 'auto',
      display: 'flex', flexDirection: 'column', gap: 20,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ color: 'var(--text-primary)', fontSize: 15, fontWeight: 600 }}>
          Gérer l&apos;affichage
        </h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
          <X size={18} />
        </button>
      </div>

      <div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 8 }}>
          Afficher par type
        </div>
        {FILTER_TYPES.map((ft) => (
          <label key={ft.value} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0',
            cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)',
          }}>
            <input
              type="radio" name="filterType"
              checked={filterType === ft.value}
              onChange={() => onFilterTypeChange(ft.value)}
              style={{ accentColor: 'var(--color-primary)' }}
            />
            {ft.label}
          </label>
        ))}
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>Calendriers</span>
        </div>
        {calendars.map((cal) => (
          <label key={cal.id} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0',
            cursor: 'pointer', fontSize: 13, color: visibleCalendarIds.has(cal.id) ? 'var(--text-primary)' : 'var(--text-muted)',
          }}>
            <div
              onClick={(e) => { e.preventDefault(); onToggleCalendar(cal.id) }}
              style={{
                width: 14, height: 14, borderRadius: 3, flexShrink: 0, cursor: 'pointer',
                border: `2px solid ${cal.color}`,
                background: visibleCalendarIds.has(cal.id) ? cal.color : 'transparent',
                transition: 'background 0.15s',
              }}
            />
            {cal.name}
          </label>
        ))}
        <label style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', marginTop: 4,
          cursor: 'pointer', fontSize: 13, color: showPersonal ? 'var(--text-primary)' : 'var(--text-muted)',
        }}>
          <div
            onClick={(e) => { e.preventDefault(); onTogglePersonal() }}
            style={{
              width: 14, height: 14, borderRadius: 3, flexShrink: 0, cursor: 'pointer',
              border: '2px solid #6b7280',
              background: showPersonal ? '#6b7280' : 'transparent',
              transition: 'background 0.15s',
            }}
          />
          Événements personnels
        </label>
      </div>
    </div>
  )
}

'use client'

/**
 * Sidebar gauche fixe 240px (Phase 5). Toujours visible sur desktop. Contient :
 *  - MiniCalendar pour navigation rapide
 *  - Liste des calendriers de réservation avec toggle de visibilité
 *  - Toggle "Personnel" (bookings is_personal=true)
 *  - Filtre status (V1.5 — pas inclus Phase 5 pour limiter le scope)
 *
 * En Phase 7 (mobile), cette sidebar deviendra un drawer accessible via ☰
 * dans la toolbar.
 */

import { Briefcase, User } from 'lucide-react'
import type { BookingCalendar } from '@/types'
import { MiniCalendar } from './MiniCalendar'

interface AgendaSidebarProps {
  selectedDate: Date
  onSelectDate: (date: Date) => void

  calendars: BookingCalendar[]
  visibleCalendarIds: Set<string>
  onToggleCalendar: (id: string) => void

  showPersonal: boolean
  onTogglePersonal: () => void

  showCalls: boolean
  onToggleCalls: () => void
}

export function AgendaSidebar({
  selectedDate,
  onSelectDate,
  calendars,
  visibleCalendarIds,
  onToggleCalendar,
  showPersonal,
  onTogglePersonal,
  showCalls,
  onToggleCalls,
}: AgendaSidebarProps) {
  return (
    <aside
      style={{
        width: 240,
        flexShrink: 0,
        height: '100%',
        background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border-secondary)',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
        overflow: 'auto',
      }}
      aria-label="Navigation agenda"
    >
      {/* Mini-calendar */}
      <MiniCalendar selectedDate={selectedDate} onSelectDate={onSelectDate} />

      {/* Calendars list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <SectionTitle>Mes calendriers</SectionTitle>
        {calendars.length === 0 ? (
          <div
            style={{
              fontSize: 11,
              color: 'var(--text-tertiary)',
              padding: '4px 0',
              fontStyle: 'italic',
            }}
          >
            Aucun calendrier
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {calendars.map((cal) => (
              <CalendarRow
                key={cal.id}
                color={cal.color}
                label={cal.name}
                checked={visibleCalendarIds.has(cal.id)}
                onToggle={() => onToggleCalendar(cal.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Special filters */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <SectionTitle>Autres</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <CalendarRow
            color="#6b7280"
            label="Personnel"
            icon={<User size={11} />}
            checked={showPersonal}
            onToggle={onTogglePersonal}
          />
          <CalendarRow
            color="#3b82f6"
            label="Appels (setting / closing)"
            icon={<Briefcase size={11} />}
            checked={showCalls}
            onToggle={onToggleCalls}
          />
        </div>
      </div>
    </aside>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        color: 'var(--text-tertiary)',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        fontWeight: 600,
      }}
    >
      {children}
    </div>
  )
}

interface CalendarRowProps {
  color: string
  label: string
  icon?: React.ReactNode
  checked: boolean
  onToggle: () => void
}

function CalendarRow({ color, label, icon, checked, onToggle }: CalendarRowProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '5px 6px',
        borderRadius: 4,
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        textAlign: 'left',
        width: '100%',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
      aria-pressed={checked}
    >
      <span
        style={{
          width: 14,
          height: 14,
          borderRadius: 3,
          border: `1px solid ${checked ? color : 'var(--border-secondary)'}`,
          background: checked ? color : 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'background 0.1s',
        }}
        aria-hidden
      >
        {checked && (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 5L4 7L8 3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      {icon && (
        <span style={{ color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center' }}>
          {icon}
        </span>
      )}
      <span
        style={{
          fontSize: 12,
          color: checked ? 'var(--text-primary)' : 'var(--text-secondary)',
          fontWeight: 500,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
        }}
      >
        {label}
      </span>
    </button>
  )
}

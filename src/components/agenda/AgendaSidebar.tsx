'use client'

import MiniCalendar from './MiniCalendar'

interface AgendaSidebarProps {
  selectedDate: Date
  onDateSelect: (date: Date) => void
}

export function AgendaSidebar({ selectedDate, onDateSelect }: AgendaSidebarProps) {
  return (
    <div style={{
      width: 220, flexShrink: 0, borderRight: '1px solid var(--border-secondary)',
      background: 'var(--bg-elevated)', padding: 16,
    }}>
      <MiniCalendar selectedDate={selectedDate} onDateSelect={onDateSelect} />
    </div>
  )
}

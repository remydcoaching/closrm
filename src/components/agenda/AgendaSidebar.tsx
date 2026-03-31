'use client'

import MiniCalendar from './MiniCalendar'

interface AgendaSidebarProps {
  selectedDate: Date
  onDateSelect: (date: Date) => void
}

export function AgendaSidebar({ selectedDate, onDateSelect }: AgendaSidebarProps) {
  return (
    <div style={{
      width: 240, flexShrink: 0, borderRight: '2px solid var(--border-secondary)',
      background: 'var(--bg-elevated)', padding: 16,
    }}>
      <MiniCalendar selectedDate={selectedDate} onDateSelect={onDateSelect} />
    </div>
  )
}

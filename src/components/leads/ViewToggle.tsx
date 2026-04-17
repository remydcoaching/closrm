'use client'

import { List, LayoutGrid } from 'lucide-react'
import type { LeadsView } from '@/lib/ui-prefs/leads-prefs'

interface ViewToggleProps {
  value: LeadsView
  onChange: (v: LeadsView) => void
}

export default function ViewToggle({ value, onChange }: ViewToggleProps) {
  const btnStyle = (active: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 32, height: 32, borderRadius: 7, cursor: 'pointer',
    border: 'none',
    background: active ? 'var(--border-primary)' : 'transparent',
    color: active ? 'var(--text-primary)' : 'var(--text-label)',
    transition: 'background 0.15s ease',
  })

  return (
    <div style={{
      display: 'inline-flex', gap: 2, padding: 3,
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border-primary)',
      borderRadius: 9,
    }}>
      <button
        type="button"
        aria-label="Vue liste"
        aria-pressed={value === 'list'}
        onClick={() => onChange('list')}
        style={btnStyle(value === 'list')}
      >
        <List size={15} />
      </button>
      <button
        type="button"
        aria-label="Vue kanban"
        aria-pressed={value === 'kanban'}
        onClick={() => onChange('kanban')}
        style={btnStyle(value === 'kanban')}
      >
        <LayoutGrid size={15} />
      </button>
    </div>
  )
}

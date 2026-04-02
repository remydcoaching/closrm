'use client'

import { Instagram } from 'lucide-react'

const PLATFORMS = [
  { key: 'instagram', label: 'Instagram', icon: Instagram, active: true },
] as const

interface Props {
  selected: string
  onChange: (key: string) => void
}

export default function SocialPlatformTabs({ selected, onChange }: Props) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
      {PLATFORMS.map(p => {
        const isActive = selected === p.key
        const Icon = p.icon
        return (
          <button
            key={p.key}
            onClick={() => p.active && onChange(p.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 16px', fontSize: 13, fontWeight: 600,
              color: isActive ? '#fff' : 'var(--text-tertiary)',
              background: isActive ? 'var(--bg-elevated)' : 'transparent',
              border: isActive ? '1px solid var(--border-primary)' : '1px solid transparent',
              borderRadius: 8, cursor: p.active ? 'pointer' : 'default',
              opacity: p.active ? 1 : 0.4,
            }}
          >
            <Icon size={16} />
            {p.label}
          </button>
        )
      })}
    </div>
  )
}

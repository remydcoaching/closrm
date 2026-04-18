'use client'

import { Camera, Video } from 'lucide-react'

const PLATFORMS = [
  { key: 'instagram', label: 'Instagram', icon: Camera, color: '#EC4899', active: true },
  { key: 'youtube',   label: 'YouTube',   icon: Video,  color: '#FF0000', active: true },
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
              background: isActive ? p.color : 'transparent',
              border: `1px solid ${isActive ? p.color : 'var(--border-primary)'}`,
              borderRadius: 8, cursor: p.active ? 'pointer' : 'default',
              opacity: p.active ? 1 : 0.4,
              transition: 'all 0.15s',
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

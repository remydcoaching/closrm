'use client'

import { Camera, Video, LayoutGrid } from 'lucide-react'

const TABS = [
  { key: 'planning',  label: 'Planning',  icon: LayoutGrid, color: '#a78bfa', active: true },
  { key: 'instagram', label: 'Instagram', icon: Camera,     color: '#EC4899', active: true },
  { key: 'youtube',   label: 'YouTube',   icon: Video,      color: '#FF0000', active: true },
] as const

interface Props {
  selected: string
  onChange: (key: string) => void
}

export default function SocialPlatformTabs({ selected, onChange }: Props) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {TABS.map(t => {
        const isActive = selected === t.key
        const Icon = t.icon
        return (
          <button
            key={t.key}
            onClick={() => t.active && onChange(t.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 16px', fontSize: 13, fontWeight: 600,
              color: isActive ? '#fff' : 'var(--text-tertiary)',
              background: isActive ? t.color : 'transparent',
              border: `1px solid ${isActive ? t.color : 'var(--border-primary)'}`,
              borderRadius: 8, cursor: t.active ? 'pointer' : 'default',
              opacity: t.active ? 1 : 0.4,
              transition: 'all 0.15s',
            }}
          >
            <Icon size={16} />
            {t.label}
          </button>
        )
      })}
    </div>
  )
}

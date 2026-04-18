'use client'

const TABS = [
  { key: 'general', label: 'Général' },
  { key: 'stories', label: 'Stories' },
  { key: 'reels', label: 'Reels' },
  { key: 'comments', label: 'Commentaires' },
] as const

interface Props {
  selected: string
  onChange: (key: string) => void
}

export default function IgSubTabs({ selected, onChange }: Props) {
  return (
    <div style={{
      display: 'flex', gap: 4, marginBottom: 28,
      borderBottom: '1px solid var(--border-primary)', paddingBottom: 0,
    }}>
      {TABS.map(tab => {
        const active = selected === tab.key
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            style={{
              padding: '8px 16px', fontSize: 13, fontWeight: 500,
              color: active ? 'var(--color-primary)' : 'var(--text-tertiary)',
              background: 'none', border: 'none',
              borderBottom: active ? '2px solid var(--color-primary)' : '2px solid transparent',
              cursor: 'pointer', marginBottom: -1,
            }}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

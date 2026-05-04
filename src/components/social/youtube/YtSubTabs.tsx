'use client'

const TABS = [
  { key: 'acquisition', label: 'Acquisition' },
  { key: 'inbox',       label: 'Inbox' },
  { key: 'videos',      label: 'Vidéos' },
  { key: 'insights',    label: 'Insights' },
] as const

interface Props {
  selected: string
  onChange: (key: string) => void
}

export default function YtSubTabs({ selected, onChange }: Props) {
  return (
    <div style={{
      display: 'flex', gap: 4, marginBottom: 24,
      borderBottom: '1px solid var(--border-primary)',
    }}>
      {TABS.map((t) => {
        const isActive = selected === t.key
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            style={{
              padding: '10px 16px', fontSize: 13, fontWeight: 600,
              color: isActive ? '#FF0000' : 'var(--text-tertiary)',
              background: 'transparent', border: 'none',
              borderBottom: `2px solid ${isActive ? '#FF0000' : 'transparent'}`,
              marginBottom: '-1px', cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}

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
  hotCount?: number
}

export default function YtSubTabs({ selected, onChange, hotCount }: Props) {
  return (
    <div style={{
      display: 'flex', gap: 4, marginBottom: 24,
      borderBottom: '1px solid var(--border-primary)',
    }}>
      {TABS.map((t) => {
        const isActive = selected === t.key
        const showBadge = t.key === 'inbox' && (hotCount ?? 0) > 0
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
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            {t.label}
            {showBadge && (
              <span style={{
                fontSize: 9, fontWeight: 800, color: '#fff',
                background: '#f59e0b', padding: '2px 6px', borderRadius: 10,
                minWidth: 16, textAlign: 'center',
              }}>{hotCount}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

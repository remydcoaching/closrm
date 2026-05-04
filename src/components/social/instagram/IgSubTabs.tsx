'use client'

const TABS = [
  { key: 'acquisition', label: 'Acquisition' },
  { key: 'inbox',       label: 'Inbox' },
  { key: 'stories',     label: 'Stories' },
  { key: 'reels',       label: 'Reels' },
] as const

interface Props {
  selected: string
  onChange: (key: string) => void
  hotCount?: number
}

export default function IgSubTabs({ selected, onChange, hotCount }: Props) {
  return (
    <div style={{
      display: 'flex', gap: 4, marginBottom: 28,
      borderBottom: '1px solid var(--border-primary)', paddingBottom: 0,
    }}>
      {TABS.map(tab => {
        const active = selected === tab.key
        const showBadge = tab.key === 'inbox' && (hotCount ?? 0) > 0
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
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            {tab.label}
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

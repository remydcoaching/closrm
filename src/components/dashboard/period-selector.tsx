// Composant Server — pas besoin de 'use client'
// Génère des liens <a> simples qui rechargent la page avec ?period=X

interface PeriodSelectorProps {
  current: number  // période active (7, 30, ou 90)
}

const PERIODS = [
  { value: 7, label: '7j' },
  { value: 30, label: '30j' },
  { value: 90, label: '90j' },
]

export default function PeriodSelector({ current }: PeriodSelectorProps) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {PERIODS.map((p) => {
        const isActive = current === p.value
        return (
          <a
            key={p.value}
            href={`?period=${p.value}`}
            style={{
              padding: '6px 14px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              textDecoration: 'none',
              border: isActive ? '1px solid #00C853' : '1px solid #262626',
              color: isActive ? '#00C853' : '#666',
              background: isActive ? 'rgba(0,200,83,0.08)' : 'transparent',
            }}
          >
            {p.label}
          </a>
        )
      })}
    </div>
  )
}

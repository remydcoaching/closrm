'use client'

import type { FunnelData } from '@/lib/dashboard/v2-queries'

interface Stage {
  label: string
  value: number
  href: string
}

function pct(num: number, denom: number): string {
  if (denom === 0) return '—'
  return `${Math.round((num / denom) * 100)}%`
}

export default function ConversionFunnel({ data }: { data: FunnelData }) {
  const stages: Stage[] = [
    { label: 'Leads', value: data.leads, href: '/leads' },
    { label: 'Bookés', value: data.bookings, href: '/agenda' },
    { label: 'Présents', value: data.showed, href: '/closing' },
    { label: 'Closés', value: data.closed, href: '/leads?status=clos' },
  ]
  const max = Math.max(...stages.map(s => s.value), 1)

  return (
    <div
      style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-primary)',
        borderRadius: 12,
        padding: 20,
        marginBottom: 16,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: 'var(--text-label)',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          marginBottom: 16,
        }}
      >
        Funnel de conversion
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
        {stages.map((s, i) => {
          const w = (s.value / max) * 100
          const prevValue = i > 0 ? stages[i - 1].value : null
          return (
            <div
              key={s.label}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: 6,
              }}
            >
              {prevValue !== null && (
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--text-muted)',
                    alignSelf: 'flex-end',
                  }}
                >
                  {pct(s.value, prevValue)}
                </div>
              )}
              <a
                href={s.href}
                style={{
                  display: 'block',
                  width: `${Math.max(w, 8)}%`,
                  background: 'var(--color-primary)',
                  opacity: 0.4 + 0.15 * (4 - i),
                  height: 56,
                  borderRadius: 6,
                  textDecoration: 'none',
                  transition: 'opacity 0.15s ease',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.opacity = '1'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.opacity = String(0.4 + 0.15 * (4 - i))
                }}
              />
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                {s.value}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.label}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

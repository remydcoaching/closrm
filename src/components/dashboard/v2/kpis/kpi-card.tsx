'use client'

import Sparkline from './sparkline'
import type { KpiValue } from '@/lib/dashboard/v2-queries'

function formatValue(v: number, fmt?: KpiValue['format']): string {
  if (fmt === 'currency')
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(v)
  if (fmt === 'percent') return `${v}%`
  return new Intl.NumberFormat('fr-FR').format(v)
}

export default function KpiCard({ label, value }: { label: string; value: KpiValue }) {
  const delta = value.delta_pct
  const isPositive = delta !== null && delta >= 0
  const deltaColor =
    delta === null
      ? 'var(--text-muted)'
      : isPositive
        ? 'var(--color-success)'
        : 'var(--color-danger)'

  return (
    <div
      style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-primary)',
        borderRadius: 12,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        minHeight: 110,
      }}
    >
      <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>{label}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div
          style={{
            fontSize: 26,
            fontWeight: 700,
            color: 'var(--text-primary)',
            lineHeight: 1,
          }}
        >
          {formatValue(value.current, value.format)}
        </div>
        {value.sparkline.length > 0 && <Sparkline values={value.sparkline} />}
      </div>
      <div style={{ fontSize: 12, color: deltaColor, fontWeight: 500 }}>
        {delta === null ? '—' : `${isPositive ? '↑' : '↓'} ${Math.abs(delta)}% vs période préc.`}
      </div>
    </div>
  )
}

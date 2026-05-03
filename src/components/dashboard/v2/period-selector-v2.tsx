'use client'

import { useRouter, useSearchParams } from 'next/navigation'

const OPTIONS = [
  { value: 7, label: '7 jours' },
  { value: 30, label: '30 jours' },
  { value: 90, label: '90 jours' },
] as const

export default function PeriodSelectorV2({ current }: { current: number }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function setPeriod(p: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('period', String(p))
    router.push(`?${params.toString()}`)
  }

  return (
    <div
      style={{
        display: 'inline-flex',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-primary)',
        borderRadius: 10,
        padding: 3,
        gap: 2,
      }}
    >
      {OPTIONS.map(opt => {
        const active = current === opt.value
        return (
          <button
            key={opt.value}
            onClick={() => setPeriod(opt.value)}
            style={{
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 500,
              borderRadius: 7,
              border: active ? '1px solid var(--border-primary)' : '1px solid transparent',
              background: active ? 'var(--bg-secondary)' : 'transparent',
              color: active ? 'var(--text-primary)' : 'var(--text-muted)',
              cursor: 'pointer',
              boxShadow: active ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

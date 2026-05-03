'use client'

import { Calendar, Clock, RefreshCw, Flame } from 'lucide-react'
import type { DayPlanItem } from '@/lib/dashboard/v2-queries'

const ICONS = {
  booking: Calendar,
  overdue_followup: Clock,
  no_show: RefreshCw,
  hot_lead: Flame,
} as const

const COLORS = {
  booking: 'var(--color-primary)',
  overdue_followup: 'var(--color-warning)',
  no_show: 'var(--color-danger)',
  hot_lead: '#f59e0b',
} as const

export default function DayPlanCard({ items }: { items: DayPlanItem[] }) {
  return (
    <div
      style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-primary)',
        borderRadius: 12,
        padding: 20,
        minHeight: 200,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: 'var(--text-label)',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          marginBottom: 12,
        }}
      >
        Plan du jour
      </div>
      {items.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Rien d&apos;urgent aujourd&apos;hui ✨
        </div>
      ) : (
        <ol
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          {items.map((item, i) => {
            const Icon = ICONS[item.type]
            const color = COLORS[item.type]
            return (
              <li key={`${item.type}-${item.lead_id}-${i}`}>
                <a
                  href={`/leads/${item.lead_id}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 10px',
                    borderRadius: 8,
                    textDecoration: 'none',
                    color: 'var(--text-primary)',
                    background: 'transparent',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'var(--bg-hover)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'transparent'
                  }}
                >
                  <span
                    style={{
                      width: 18,
                      color: 'var(--text-muted)',
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    {i + 1}.
                  </span>
                  <Icon size={14} style={{ color, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>{item.lead_name}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.context}</span>
                </a>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}

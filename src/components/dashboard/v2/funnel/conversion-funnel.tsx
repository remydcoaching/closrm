'use client'

import { useState } from 'react'
import { ArrowRight, Users, Calendar, CheckCircle2, Trophy } from 'lucide-react'
import type { FunnelData } from '@/lib/dashboard/v2-queries'

interface Stage {
  key: string
  label: string
  value: number
  href: string
  Icon: typeof Users
  color: string
}

function pct(num: number, denom: number): number | null {
  if (denom === 0) return null
  return Math.round((num / denom) * 100)
}

function deltaTone(p: number | null): string {
  if (p === null) return 'var(--text-muted)'
  if (p >= 50) return 'var(--color-success)'
  if (p >= 25) return 'var(--color-warning)'
  return 'var(--color-danger)'
}

export default function ConversionFunnel({ data }: { data: FunnelData }) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null)

  const stages: Stage[] = [
    { key: 'leads', label: 'Leads',    value: data.leads,    href: '/leads',             Icon: Users,         color: '#3b82f6' },
    { key: 'book',  label: 'Bookés',   value: data.bookings, href: '/agenda',            Icon: Calendar,      color: '#8b5cf6' },
    { key: 'show',  label: 'Présents', value: data.showed,   href: '/closing',           Icon: CheckCircle2,  color: '#ec4899' },
    { key: 'close', label: 'Closés',   value: data.closed,   href: '/leads?status=clos', Icon: Trophy,        color: '#10b981' },
  ]

  const max = Math.max(...stages.map(s => s.value), 1)
  const globalConv = pct(data.closed, data.leads)

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--text-label)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          Funnel de conversion
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Conversion globale :{' '}
          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
            {globalConv !== null ? `${globalConv}%` : '—'}
          </span>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'stretch',
          gap: 4,
        }}
      >
        {stages.map((s, i) => {
          const widthRatio = s.value / max
          const isHovered = hoveredKey === s.key
          return (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              {/* Stage card */}
              <a
                href={s.href}
                onMouseEnter={() => setHoveredKey(s.key)}
                onMouseLeave={() => setHoveredKey(null)}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  padding: '14px 16px',
                  borderRadius: 10,
                  background: isHovered ? 'var(--bg-elevated)' : 'var(--bg-tertiary, var(--bg-elevated))',
                  border: '1px solid',
                  borderColor: isHovered ? s.color : 'var(--border-primary)',
                  textDecoration: 'none',
                  transition: 'all 0.15s ease',
                  minHeight: 90,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 6,
                      background: `${s.color}22`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <s.Icon size={12} color={s.color} />
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
                    {s.label}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    lineHeight: 1,
                  }}
                >
                  {s.value}
                </div>
                {/* Volume bar */}
                <div
                  style={{
                    width: '100%',
                    height: 4,
                    background: 'var(--bg-secondary)',
                    borderRadius: 2,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${Math.max(widthRatio * 100, 4)}%`,
                      height: '100%',
                      background: s.color,
                      borderRadius: 2,
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
              </a>

              {/* Arrow + conversion % between stages */}
              {i < stages.length - 1 && (() => {
                const next = stages[i + 1]
                const conv = pct(next.value, s.value)
                const tone = deltaTone(conv)
                return (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0 8px',
                      gap: 2,
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: tone,
                        lineHeight: 1,
                      }}
                    >
                      {conv !== null ? `${conv}%` : '—'}
                    </div>
                    <ArrowRight size={14} color="var(--text-muted)" />
                  </div>
                )
              })()}
            </div>
          )
        })}
      </div>
    </div>
  )
}

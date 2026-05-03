'use client'

import { useState } from 'react'
import { ArrowDown } from 'lucide-react'
import type { FunnelData } from '@/lib/dashboard/v2-queries'

interface Stage {
  key: string
  label: string
  value: number
  href: string
  color: string
}

function pct(num: number, denom: number): number | null {
  if (denom === 0) return null
  return Math.round((num / denom) * 100)
}

export default function ConversionFunnel({ data }: { data: FunnelData }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  const stages: Stage[] = [
    { key: 'leads', label: 'Leads',    value: data.leads,    href: '/leads',              color: '#3b82f6' },
    { key: 'book',  label: 'Bookés',   value: data.bookings, href: '/agenda',             color: '#8b5cf6' },
    { key: 'show',  label: 'Présents', value: data.showed,   href: '/closing',            color: '#ec4899' },
    { key: 'close', label: 'Closés',   value: data.closed,   href: '/leads?status=clos',  color: '#10b981' },
  ]

  const max = Math.max(...stages.map(s => s.value), 1)

  // Dimensions du SVG : on garde un ratio largeur/hauteur fixe
  const W = 760
  const H = 280
  const segmentH = H / stages.length
  // Largeur min des segments du bas (pour ne pas devenir invisibles)
  const minWidthRatio = 0.18

  // Calcule la largeur normalisée de chaque segment
  const widths = stages.map(s => {
    const ratio = s.value / max
    return Math.max(ratio, minWidthRatio)
  })

  return (
    <div
      style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-primary)',
        borderRadius: 12,
        padding: 24,
        marginBottom: 16,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 20,
        }}
      >
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
            {data.leads > 0 ? `${Math.round((data.closed / data.leads) * 100)}%` : '—'}
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 32, alignItems: 'center' }}>
        {/* SVG funnel */}
        <div style={{ position: 'relative' }}>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            width="100%"
            height="auto"
            style={{ display: 'block', overflow: 'visible' }}
          >
            <defs>
              {stages.map((s, i) => (
                <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity={0.9} />
                  <stop offset="100%" stopColor={s.color} stopOpacity={0.65} />
                </linearGradient>
              ))}
            </defs>

            {stages.map((s, i) => {
              const wTop = widths[i] * W
              const wBot = (widths[i + 1] ?? widths[i] * 0.7) * W
              const xTop = (W - wTop) / 2
              const xBot = (W - wBot) / 2
              const yTop = i * segmentH
              const yBot = (i + 1) * segmentH

              const points = `${xTop},${yTop} ${xTop + wTop},${yTop} ${xBot + wBot},${yBot} ${xBot},${yBot}`
              const isHovered = hoveredIdx === i

              return (
                <g key={s.key}>
                  <a href={s.href}>
                    <polygon
                      points={points}
                      fill={`url(#grad-${s.key})`}
                      stroke={isHovered ? s.color : 'transparent'}
                      strokeWidth={2}
                      style={{
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        filter: isHovered ? `drop-shadow(0 4px 12px ${s.color}60)` : 'none',
                      }}
                      onMouseEnter={() => setHoveredIdx(i)}
                      onMouseLeave={() => setHoveredIdx(null)}
                    />
                  </a>
                  {/* Label centré sur le segment */}
                  <text
                    x={W / 2}
                    y={yTop + segmentH / 2 - 4}
                    textAnchor="middle"
                    fill="#fff"
                    fontSize={14}
                    fontWeight={600}
                    style={{ pointerEvents: 'none' }}
                  >
                    {s.label}
                  </text>
                  <text
                    x={W / 2}
                    y={yTop + segmentH / 2 + 16}
                    textAnchor="middle"
                    fill="#fff"
                    fontSize={20}
                    fontWeight={700}
                    style={{ pointerEvents: 'none' }}
                  >
                    {s.value}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>

        {/* Sidebar : drop-off % entre étapes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {stages.map((s, i) => {
            if (i === 0) return null
            const prev = stages[i - 1]
            const conv = pct(s.value, prev.value)
            const isHovered = hoveredIdx === i || hoveredIdx === i - 1
            return (
              <div
                key={`step-${s.key}`}
                style={{
                  padding: '10px 12px',
                  borderRadius: 8,
                  background: isHovered ? 'var(--bg-elevated)' : 'transparent',
                  border: '1px solid',
                  borderColor: isHovered ? s.color : 'var(--border-primary)',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    background: `linear-gradient(135deg, ${prev.color}, ${s.color})`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <ArrowDown size={14} color="#fff" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {prev.label} → {s.label}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span
                      style={{
                        fontSize: 18,
                        fontWeight: 700,
                        color: conv !== null && conv >= 50
                          ? 'var(--color-success)'
                          : conv !== null && conv >= 25
                            ? 'var(--color-warning)'
                            : 'var(--color-danger)',
                      }}
                    >
                      {conv !== null ? `${conv}%` : '—'}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      ({s.value}/{prev.value})
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

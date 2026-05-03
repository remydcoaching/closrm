'use client'

import { useEffect, useState } from 'react'
import { Users, Calendar, CheckCircle2, Trophy, TrendingDown, TrendingUp } from 'lucide-react'
import type { FunnelData } from '@/lib/dashboard/v2-queries'

interface Stage {
  key: string
  label: string
  value: number
  href: string
  Icon: typeof Users
  color: string
  glow: string
}

function pct(num: number, denom: number): number | null {
  if (denom === 0) return null
  return Math.round((num / denom) * 100)
}

function deltaTone(p: number | null): { color: string; bg: string; ring: string } {
  if (p === null) return { color: 'var(--text-muted)', bg: 'var(--bg-elevated)', ring: 'var(--border-primary)' }
  if (p >= 50) return { color: '#10b981', bg: 'rgba(16,185,129,0.12)', ring: 'rgba(16,185,129,0.4)' }
  if (p >= 25) return { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', ring: 'rgba(245,158,11,0.4)' }
  return { color: '#ef4444', bg: 'rgba(239,68,68,0.12)', ring: 'rgba(239,68,68,0.4)' }
}

function useCountUp(target: number, duration = 700) {
  const [v, setV] = useState(0)
  useEffect(() => {
    const start = performance.now()
    let raf = 0
    const tick = (t: number) => {
      const elapsed = t - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setV(Math.round(target * eased))
      if (progress < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return v
}

export default function ConversionFunnel({ data }: { data: FunnelData }) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const id = setTimeout(() => setMounted(true), 50)
    return () => clearTimeout(id)
  }, [])

  const stages: Stage[] = [
    { key: 'leads', label: 'Leads',    value: data.leads,    href: '/leads',             Icon: Users,         color: '#3b82f6', glow: '59,130,246' },
    { key: 'book',  label: 'Bookés',   value: data.bookings, href: '/agenda',            Icon: Calendar,      color: '#8b5cf6', glow: '139,92,246' },
    { key: 'show',  label: 'Présents', value: data.showed,   href: '/closing',           Icon: CheckCircle2,  color: '#ec4899', glow: '236,72,153' },
    { key: 'close', label: 'Closés',   value: data.closed,   href: '/leads?status=clos', Icon: Trophy,        color: '#10b981', glow: '16,185,129' },
  ]

  const totalLeads = stages[0].value || 1
  const globalConv = pct(data.closed, data.leads)
  const allEmpty = stages.every(s => s.value === 0)

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
      {/* Header */}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {globalConv !== null && globalConv > 0 && (
            <TrendingUp size={12} color="#10b981" />
          )}
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Conversion globale :{' '}
            <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
              {globalConv !== null ? `${globalConv}%` : '—'}
            </span>
          </span>
        </div>
      </div>

      {allEmpty ? (
        <div
          style={{
            padding: '32px 16px',
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: 13,
          }}
        >
          Pas encore assez de données sur cette période. Crée un lead pour démarrer le funnel.
        </div>
      ) : (
        <>
      {/* Stacked visual flow bar */}
      <div
        style={{
          display: 'flex',
          gap: 2,
          height: 8,
          marginBottom: 20,
          borderRadius: 4,
          overflow: 'hidden',
        }}
      >
        {stages.map(s => {
          const w = (s.value / totalLeads) * 100
          return (
            <div
              key={s.key}
              style={{
                width: mounted ? `${Math.max(w, 1)}%` : '0%',
                background: `linear-gradient(90deg, ${s.color} 0%, ${s.color}dd 100%)`,
                transition: 'width 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            />
          )
        })}
      </div>

      {/* Stage cards row */}
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 0 }}>
        {stages.map((s, i) => (
          <StageWithConnector
            key={s.key}
            stage={s}
            nextStage={stages[i + 1]}
            isLast={i === stages.length - 1}
            totalLeads={totalLeads}
            isHovered={hoveredKey === s.key}
            onHoverChange={hov => setHoveredKey(hov ? s.key : null)}
          />
        ))}
      </div>
        </>
      )}
    </div>
  )
}

function StageWithConnector({
  stage,
  nextStage,
  isLast,
  totalLeads,
  isHovered,
  onHoverChange,
}: {
  stage: Stage
  nextStage?: Stage
  isLast: boolean
  totalLeads: number
  isHovered: boolean
  onHoverChange: (h: boolean) => void
}) {
  const animatedValue = useCountUp(stage.value)
  const widthRatio = stage.value / totalLeads
  const conv = nextStage ? pct(nextStage.value, stage.value) : null
  const tone = deltaTone(conv)

  return (
    <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
      <a
        href={stage.href}
        onMouseEnter={() => onHoverChange(true)}
        onMouseLeave={() => onHoverChange(false)}
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          padding: '14px 16px',
          borderRadius: 10,
          background: 'var(--bg-elevated)',
          border: '1px solid',
          borderColor: isHovered ? stage.color : 'var(--border-primary)',
          textDecoration: 'none',
          transition: 'all 0.2s ease',
          minHeight: 100,
          boxShadow: isHovered ? `0 4px 16px rgba(${stage.glow}, 0.18)` : 'none',
          transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: 7,
              background: `linear-gradient(135deg, ${stage.color}33, ${stage.color}1a)`,
              border: `1px solid ${stage.color}33`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <stage.Icon size={12} color={stage.color} />
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
            {stage.label}
          </span>
        </div>
        <div
          style={{
            fontSize: 26,
            fontWeight: 700,
            color: 'var(--text-primary)',
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {animatedValue}
        </div>
        {/* Volume bar with gradient */}
        <div
          style={{
            width: '100%',
            height: 5,
            background: 'rgba(255,255,255,0.04)',
            borderRadius: 3,
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <div
            style={{
              width: `${Math.max(widthRatio * 100, 3)}%`,
              height: '100%',
              background: `linear-gradient(90deg, ${stage.color}cc 0%, ${stage.color} 100%)`,
              borderRadius: 3,
              boxShadow: `0 0 8px ${stage.color}66`,
              transition: 'width 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          />
        </div>
      </a>

      {!isLast && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 6px',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              minWidth: 50,
              height: 50,
              padding: '0 10px',
              borderRadius: 25,
              background: tone.bg,
              border: `1.5px solid ${tone.ring}`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 0,
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: tone.color,
                lineHeight: 1,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {conv !== null ? `${conv}%` : '—'}
            </div>
            {conv !== null && (
              <div style={{ marginTop: 2, opacity: 0.7 }}>
                {conv >= 50 ? (
                  <TrendingUp size={9} color={tone.color} />
                ) : (
                  <TrendingDown size={9} color={tone.color} />
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

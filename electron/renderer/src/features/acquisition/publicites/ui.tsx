// Small shared pieces: health badge (StatCard caption) and the hand-made
// SVG daily bar chart (replaces recharts' BarChart used on the web).
import { useEffect, useRef, useState } from 'react'
import { HEALTH_LABEL, type HealthColor } from './health-thresholds'
import type { MetaDailyRow } from './types'
import { euro, num } from './metrics'

export function HealthBadge({ color, suffix }: { color: HealthColor | null; suffix?: string }) {
  if (!color) return suffix ? <span>{suffix}</span> : null
  return (
    <span className={`pub-health pub-health--${color}`}>
      <span className="pub-health-dot" />
      {HEALTH_LABEL[color]}
      {suffix && <span className="ds-muted"> · {suffix}</span>}
    </span>
  )
}

export type DailyMetric = 'leads' | 'spend' | 'impressions' | 'clicks'

export const DAILY_METRIC_LABEL: Record<DailyMetric, string> = {
  leads: 'Leads',
  spend: 'Dépense',
  impressions: 'Impressions',
  clicks: 'Clics',
}

function fmt(metric: DailyMetric, v: number): string {
  return metric === 'spend' ? euro(v, 2) : num(v)
}

function niceMax(v: number): number {
  if (v <= 0) return 1
  const exp = 10 ** Math.floor(Math.log10(v))
  const f = v / exp
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10
  return nice * exp
}

function shortDay(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

export function DailyBarChart({ daily, metric, height = 220 }: { daily: MetaDailyRow[]; metric: DailyMetric; height?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(600)
  const [hover, setHover] = useState<number | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w) setWidth(w)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  if (daily.length === 0) {
    return <div className="pub-empty-inline">Aucune donnée pour cette période</div>
  }

  const pad = { top: 12, right: 8, bottom: 22, left: 48 }
  const plotW = Math.max(width - pad.left - pad.right, 10)
  const plotH = height - pad.top - pad.bottom
  const values = daily.map((d) => d[metric])
  const max = niceMax(Math.max(...values))
  const ticks = [0, max / 2, max]
  const slot = plotW / daily.length
  const barW = Math.max(Math.min(slot * 0.7, 36), 2)
  const labelEvery = Math.max(1, Math.ceil(daily.length / Math.max(1, Math.floor(plotW / 48))))
  const total = values.reduce((s, v) => s + v, 0)

  return (
    <div className="pub-chart" ref={ref}>
      <svg width={width} height={height} role="img" aria-label={`${DAILY_METRIC_LABEL[metric]} par jour, total ${fmt(metric, total)}`}>
        {ticks.map((t) => {
          const y = pad.top + plotH - (t / max) * plotH
          return (
            <g key={t}>
              <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} className="pub-chart-grid" />
              <text x={pad.left - 6} y={y + 3} textAnchor="end" className="pub-chart-axis">
                {metric === 'spend' ? `${num(Math.round(t))} €` : num(Math.round(t))}
              </text>
            </g>
          )
        })}
        {daily.map((d, i) => {
          const v = d[metric]
          const h = (v / max) * plotH
          const x = pad.left + i * slot + (slot - barW) / 2
          return (
            <g key={d.date} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={pad.left + i * slot} y={pad.top} width={slot} height={plotH} fill="transparent" />
              <rect
                x={x}
                y={pad.top + plotH - h}
                width={barW}
                height={Math.max(h, v > 0 ? 1 : 0)}
                rx={3}
                className={`pub-chart-bar ${hover !== null && hover !== i ? 'pub-chart-bar--muted' : ''}`}
              />
              {i % labelEvery === 0 && (
                <text x={pad.left + i * slot + slot / 2} y={height - 6} textAnchor="middle" className="pub-chart-axis">
                  {shortDay(d.date)}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      {hover !== null && daily[hover] && (
        <div className="pub-chart-tooltip" style={{ left: pad.left + hover * slot + slot / 2 }}>
          {shortDay(daily[hover].date)} · {DAILY_METRIC_LABEL[metric]} : <strong>{fmt(metric, daily[hover][metric])}</strong>
        </div>
      )}
    </div>
  )
}

// Hand-built SVG/CSS charts (no charting lib in the renderer) — same
// restrained style as design-system/ScatterChart: faint gridlines, small
// axis labels, one accent colour, tooltip on hover.
import { useState } from 'react'
import { formatNumber } from '../../design-system/StatCard'
import { niceMax, type SeriesPoint } from './metrics'
import './stats.css'

// ─── Vertical bar chart (leads per day, MRR per month) ─────────────────────

export function BarChart({
  points,
  height = 200,
  format = formatNumber,
  color = 'var(--color-accent-solid)',
  emptyLabel = 'Aucune donnée sur la période.',
}: {
  points: SeriesPoint[]
  height?: number
  format?: (v: number) => string
  color?: string
  emptyLabel?: string
}) {
  const [hover, setHover] = useState<number | null>(null)
  if (points.length === 0 || points.every((p) => p.value === 0)) {
    return <div className="stats-chart-empty">{emptyLabel}</div>
  }
  const top = niceMax(Math.max(...points.map((p) => p.value)))
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * top)
  const W = 1000
  const H = height
  const pad = { top: 8, right: 4, bottom: 22, left: 4 }
  const plotW = W - pad.left - pad.right
  const plotH = H - pad.top - pad.bottom
  const slot = plotW / points.length
  const barW = Math.max(1, Math.min(slot * 0.72, 48))
  // Show at most ~12 x labels, evenly spaced.
  const labelEvery = Math.max(1, Math.ceil(points.length / 12))
  const hovered = hover !== null ? points[hover] : null

  return (
    <div className="stats-bar-chart">
      <div className="stats-bar-chart-axis" style={{ height: plotH, marginTop: pad.top }}>
        {[...ticks].reverse().map((t) => (
          <span key={t}>{format(t)}</span>
        ))}
      </div>
      <div className="stats-bar-chart-plot">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ height: H }} onMouseLeave={() => setHover(null)}>
          {ticks.map((t) => {
            const y = pad.top + plotH - (t / top) * plotH
            return <line key={t} x1={pad.left} x2={W - pad.right} y1={y} y2={y} className="stats-gridline" />
          })}
          {points.map((p, i) => {
            const h = (p.value / top) * plotH
            const x = pad.left + i * slot + (slot - barW) / 2
            return (
              <g key={p.key} onMouseEnter={() => setHover(i)}>
                <rect x={pad.left + i * slot} y={pad.top} width={slot} height={plotH} fill="transparent" />
                <rect
                  x={x}
                  y={pad.top + plotH - h}
                  width={barW}
                  height={Math.max(h, p.value > 0 ? 2 : 0)}
                  rx={Math.min(4, barW / 3)}
                  fill={color}
                  opacity={hover === null || hover === i ? 1 : 0.45}
                />
              </g>
            )
          })}
        </svg>
        <div className="stats-bar-chart-xlabels">
          {points.map((p, i) => (
            <span key={p.key} style={{ width: `${100 / points.length}%` }}>
              {i % labelEvery === 0 ? p.label : ''}
            </span>
          ))}
        </div>
        {hovered && hover !== null && (
          <div className="stats-chart-tooltip" style={{ left: `${((hover + 0.5) / points.length) * 100}%` }}>
            <div className="stats-chart-tooltip-label">{hovered.label}</div>
            <div className="stats-chart-tooltip-value">{format(hovered.value)}</div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Horizontal ranked bars (sources, etc.) ───────────────────────────────

export interface RankedRow {
  key: string
  label: string
  value: number
  color: string
  /** Secondary text on the right (e.g. "32 %"). */
  caption?: string
  /** % change vs previous period, only when computable. */
  delta?: number | null
}

export function RankedBars({ rows, emptyLabel = 'Aucune donnée sur la période.' }: { rows: RankedRow[]; emptyLabel?: string }) {
  if (rows.length === 0) return <div className="stats-chart-empty">{emptyLabel}</div>
  const max = Math.max(...rows.map((r) => r.value), 1)
  return (
    <ul className="stats-ranked">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="stats-ranked-head">
            <span className="stats-ranked-label">
              <span className="stats-dot" style={{ background: r.color }} />
              {r.label}
            </span>
            <span className="stats-ranked-figures">
              <span className="ds-num">{formatNumber(r.value)}</span>
              {r.caption && <span className="ds-muted">{r.caption}</span>}
              <DeltaTag delta={r.delta} />
            </span>
          </div>
          <div className="stats-ranked-track">
            <div className="stats-ranked-fill" style={{ width: `${(r.value / max) * 100}%`, background: r.color }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

/** Compact ▲/▼ tag for tables and lists (StatCard has its own for KPIs). */
export function DeltaTag({ delta }: { delta: number | null | undefined }) {
  if (delta == null || !Number.isFinite(delta)) return null
  const down = delta < 0
  return (
    <span className={`stats-delta ${down ? 'stats-delta--down' : ''}`} title="vs période précédente">
      {down ? '▼' : '▲'} {down ? '' : '+'}
      {formatNumber(delta)} %
    </span>
  )
}

// ─── Funnel (stages with % of first stage + step conversion) ──────────────

export interface FunnelStage {
  key: string
  label: string
  value: number
  color: string
  onClick?: () => void
}

export function FunnelSteps({ stages }: { stages: FunnelStage[] }) {
  const first = stages[0]?.value ?? 0
  if (stages.every((s) => s.value === 0)) {
    return <div className="stats-chart-empty">Pas encore assez de données sur cette période.</div>
  }
  return (
    <div className="stats-funnel">
      {stages.map((s, i) => {
        const prev = i > 0 ? stages[i - 1].value : null
        const step = prev !== null && prev > 0 ? Math.round((s.value / prev) * 100) : null
        const ofFirst = first > 0 ? Math.round((s.value / first) * 100) : 0
        const Tag = s.onClick ? 'button' : 'div'
        return (
          <div key={s.key} className="stats-funnel-row-wrap">
            {i > 0 && (
              <div className="stats-funnel-step" title={`Conversion ${stages[i - 1].label} → ${s.label}`}>
                ↓ {step !== null ? `${step} %` : '—'}
              </div>
            )}
            <Tag type={s.onClick ? 'button' : undefined} className={`stats-funnel-row ${s.onClick ? 'stats-funnel-row--clickable' : ''}`} onClick={s.onClick}>
              <span className="stats-funnel-label">{s.label}</span>
              <span className="stats-funnel-track">
                <span className="stats-funnel-fill" style={{ width: `${Math.max(ofFirst, s.value > 0 ? 2 : 0)}%`, background: s.color }} />
              </span>
              <span className="stats-funnel-value">
                <span className="ds-num">{formatNumber(s.value)}</span>
                <span className="ds-muted">{first > 0 ? `${ofFirst} %` : '—'}</span>
              </span>
            </Tag>
          </div>
        )
      })}
    </div>
  )
}

// ─── Sparkline (dashboard KPI cards) ──────────────────────────────────────

export function Sparkline({ values, width = 96, height = 28 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2 || values.every((v) => v === 0)) return null
  const max = Math.max(...values, 1)
  const step = width / (values.length - 1)
  const pts = values.map((v, i) => `${(i * step).toFixed(1)},${(height - (v / max) * (height - 2) - 1).toFixed(1)}`)
  return (
    <svg className="stats-sparkline" width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline points={`0,${height} ${pts.join(' ')} ${width},${height}`} className="stats-sparkline-area" />
      <polyline points={pts.join(' ')} className="stats-sparkline-line" />
    </svg>
  )
}

/** Titled white card for charts (same surface as TableCard). */
export function ChartCard({ title, subtitle, toolbar, children }: { title: string; subtitle?: React.ReactNode; toolbar?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="stats-card">
      <header className="stats-card-header">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {toolbar}
      </header>
      {children}
    </section>
  )
}

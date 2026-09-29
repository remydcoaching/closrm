// A log-x/linear-y bubble scatter chart, hand-built in SVG — no charting
// library added for this one view. X axis (views) is logarithmic:
// engagement data is extremely right-skewed (a handful of viral posts vs.
// hundreds of low-view ones), so a linear X axis would pile ~90% of points
// on the far left — the log scale is a data-correctness choice, not a
// styling one. Y axis (engagement rate) stays linear: a rate is a ratio, so
// a horizontal doubling of position must mean "twice the value", which only
// holds on a linear scale.
import { useState } from 'react'
import './scatter-chart.css'

export interface ScatterPoint {
  id: string
  x: number // views, > 0
  y: number // engagement rate, 0..1+
  radius: number // e.g. leads generated — bubble size
  color: string
  label: string
  tooltip: React.ReactNode
  onClick?: () => void
}

function logScale(value: number, min: number, max: number, rangeMin: number, rangeMax: number): number {
  const logMin = Math.log10(Math.max(min, 1))
  const logMax = Math.log10(Math.max(max, min + 1))
  const logValue = Math.log10(Math.max(value, 1))
  const t = (logValue - logMin) / (logMax - logMin || 1)
  return rangeMin + t * (rangeMax - rangeMin)
}

function linScale(value: number, min: number, max: number, rangeMin: number, rangeMax: number): number {
  const t = (value - min) / (max - min || 1)
  return rangeMin + t * (rangeMax - rangeMin)
}

export function ScatterChart({ points, height = 380 }: { points: ScatterPoint[]; height?: number }) {
  const [hovered, setHovered] = useState<string | null>(null)

  if (points.length === 0) {
    return <div className="scatter-chart-empty">Aucune donnée à afficher.</div>
  }

  const width = 100 // percentage-based viewBox, scales with container
  const padding = { top: 10, right: 6, bottom: 14, left: 8 }
  const plotW = width - padding.left - padding.right
  const plotH = height - padding.top - padding.bottom

  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const xMin = Math.min(...xs)
  const xMax = Math.max(...xs)
  const yMax = Math.max(...ys, 0.01)
  const maxRadius = Math.max(...points.map((p) => p.radius), 1)

  // Log-scale tick marks at each power of ten spanned by the data.
  const xTicks: number[] = []
  const startExp = Math.floor(Math.log10(Math.max(xMin, 1)))
  const endExp = Math.ceil(Math.log10(Math.max(xMax, 10)))
  for (let e = startExp; e <= endExp; e++) xTicks.push(10 ** e)

  const yTicks = [0, 0.02, 0.04, 0.06, 0.08].filter((t) => t <= yMax * 1.15)

  const hoveredPoint = points.find((p) => p.id === hovered)

  return (
    <div className="scatter-chart" style={{ height }}>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="scatter-chart-svg">
        {/* Y gridlines + labels */}
        {yTicks.map((t) => {
          const y = padding.top + plotH - linScale(t, 0, yMax * 1.15, 0, plotH)
          return (
            <g key={`y-${t}`}>
              <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} className="scatter-gridline" />
              <text x={0} y={y} className="scatter-axis-label scatter-axis-label--y">
                {(t * 100).toFixed(0)}%
              </text>
            </g>
          )
        })}

        {/* X gridlines + labels (log scale) */}
        {xTicks.map((t) => {
          const x = padding.left + logScale(t, xMin, xMax, 0, plotW)
          return (
            <g key={`x-${t}`}>
              <line x1={x} x2={x} y1={padding.top} y2={padding.top + plotH} className="scatter-gridline" />
              <text x={x} y={height - 2} className="scatter-axis-label scatter-axis-label--x">
                {t >= 1000 ? `${t / 1000}k` : t}
              </text>
            </g>
          )
        })}

        {/* Points */}
        {points.map((p) => {
          const cx = padding.left + logScale(p.x, xMin, xMax, 0, plotW)
          const cy = padding.top + plotH - linScale(p.y, 0, yMax * 1.15, 0, plotH)
          const r = 0.6 + (p.radius / maxRadius) * 1.8
          const isHovered = hovered === p.id
          return (
            <circle
              key={p.id}
              cx={cx}
              cy={cy}
              r={isHovered ? r * 1.3 : r}
              fill={p.color}
              fillOpacity={isHovered ? 0.9 : 0.6}
              stroke={isHovered ? p.color : 'none'}
              strokeWidth={0.3}
              className="scatter-point"
              onMouseEnter={() => setHovered(p.id)}
              onMouseLeave={() => setHovered(null)}
              onClick={p.onClick}
            />
          )
        })}
      </svg>

      {hoveredPoint && <div className="scatter-tooltip">{hoveredPoint.tooltip}</div>}
    </div>
  )
}

// A log-x/linear-y bubble scatter chart, hand-built in SVG — no charting
// library added for this one view. X axis (views) is logarithmic:
// engagement data is extremely right-skewed (a handful of viral posts vs.
// hundreds of low-view ones), so a linear X axis would pile ~90% of points
// on the far left — the log scale is a data-correctness choice, not a
// styling one. Y axis (engagement rate) stays linear: a rate is a ratio, so
// a horizontal doubling of position must mean "twice the value", which only
// holds on a linear scale.
//
// Drawn in real pixels at the measured container width: a stretched viewBox
// (preserveAspectRatio="none") turned the bubbles into dashes and squashed
// the axis labels.
import { useEffect, useRef, useState } from 'react'
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

/** ~4–6 round percentage ticks covering 0..max (e.g. 0, 2 %, 4 %, 6 %, 8 %). */
export function rateTicks(max: number): number[] {
  const steps = [0.001, 0.0025, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.25, 0.5]
  const step = steps.find((s) => max / s <= 5) ?? 1
  // The last tick is at or above max: no bubble can sit above the plot.
  const out: number[] = []
  for (let i = 0; ; i++) {
    const t = Number((i * step).toFixed(4))
    out.push(t)
    if (t >= max - 1e-9) break
  }
  return out
}

const formatViews = (v: number) => new Intl.NumberFormat('fr-FR').format(Math.round(v))
const formatRate = (r: number) => `${(r * 100).toFixed(r < 0.01 && r > 0 ? 1 : 0).replace('.', ',')} %`

const MIN_R = 6
const MAX_R = 26

export function ScatterChart({ points, height = 380 }: { points: ScatterPoint[]; height?: number }) {
  const [hovered, setHovered] = useState<string | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const update = () => setWidth(Math.round(el.getBoundingClientRect().width))
    update()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  if (points.length === 0) {
    return <div className="scatter-chart-empty">Aucune donnée à afficher.</div>
  }

  const padding = { top: 16, right: 24, bottom: 40, left: 56 }
  const plotW = Math.max(width - padding.left - padding.right, 10)
  const plotH = height - padding.top - padding.bottom

  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const xMin = Math.min(...xs)
  const xMax = Math.max(...xs)
  const yTicks = rateTicks(Math.max(...ys, 0.005) * 1.1)
  const yTop = yTicks[yTicks.length - 1] || 0.01
  const maxRadius = Math.max(...points.map((p) => p.radius), 0)

  // Log-scale ticks at each power of ten inside the data, plus the maximum
  // (100 · 1 000 · 10 000 · 100 000 · 414 700).
  const xTicks: number[] = []
  for (let e = Math.ceil(Math.log10(Math.max(xMin, 1))); 10 ** e <= xMax; e++) xTicks.push(10 ** e)
  const last = xTicks[xTicks.length - 1]
  if (!last || logScale(xMax, xMin, xMax, 0, 1) - logScale(last, xMin, xMax, 0, 1) > 0.08) xTicks.push(xMax)

  const px = (x: number) => padding.left + logScale(x, xMin, xMax, 0, plotW)
  const py = (y: number) => padding.top + plotH - linScale(y, 0, yTop, 0, plotH)
  const pr = (r: number) => (maxRadius > 0 ? MIN_R + Math.sqrt(r / maxRadius) * (MAX_R - MIN_R) : MIN_R)

  const hoveredPoint = points.find((p) => p.id === hovered)
  const tipLeft = hoveredPoint ? px(hoveredPoint.x) : 0
  const tipTop = hoveredPoint ? py(hoveredPoint.y) : 0

  return (
    <div className="scatter-chart" style={{ height }} ref={boxRef}>
      {width > 0 && (
        <svg width={width} height={height} className="scatter-chart-svg">
          {yTicks.map((t) => (
            <g key={`y-${t}`}>
              <line x1={padding.left} x2={width - padding.right} y1={py(t)} y2={py(t)} className="scatter-gridline" />
              <text x={padding.left - 8} y={py(t)} dy="0.32em" className="scatter-axis-label scatter-axis-label--y">
                {formatRate(t)}
              </text>
            </g>
          ))}
          {xTicks.map((t) => (
            <g key={`x-${t}`}>
              <line x1={px(t)} x2={px(t)} y1={padding.top} y2={padding.top + plotH} className="scatter-gridline" />
              <text x={px(t)} y={padding.top + plotH + 18} className="scatter-axis-label scatter-axis-label--x">
                {formatViews(t)}
              </text>
            </g>
          ))}
          <text x={padding.left + plotW / 2} y={height - 4} className="scatter-axis-title">
            Vues
          </text>
          <text x={14} y={padding.top + plotH / 2} transform={`rotate(-90 14 ${padding.top + plotH / 2})`} className="scatter-axis-title">
            Taux d&apos;engagement
          </text>

          {/* Biggest bubbles first so small ones stay clickable on top. */}
          {[...points]
            .sort((a, b) => b.radius - a.radius)
            .map((p) => {
              const isHovered = hovered === p.id
              const r = pr(p.radius)
              return (
                <circle
                  key={p.id}
                  cx={px(p.x)}
                  cy={py(p.y)}
                  r={isHovered ? r + 2 : r}
                  fill={p.color}
                  fillOpacity={isHovered ? 0.9 : 0.55}
                  stroke={p.color}
                  strokeWidth={isHovered ? 2 : 1}
                  className="scatter-point"
                  onMouseEnter={() => setHovered(p.id)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={p.onClick}
                >
                  <title>{p.label}</title>
                </circle>
              )
            })}
        </svg>
      )}

      {hoveredPoint && (
        <div
          className="scatter-tooltip"
          style={{
            left: Math.min(Math.max(tipLeft + 16, 8), Math.max(width - 240, 8)),
            top: Math.min(Math.max(tipTop - 20, 4), height - 120),
          }}
        >
          {hoveredPoint.tooltip}
        </div>
      )}
    </div>
  )
}

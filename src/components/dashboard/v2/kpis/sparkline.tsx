'use client'

interface SparklineProps {
  values: number[]
  width?: number
  height?: number
  color?: string
}

export default function Sparkline({
  values,
  width = 80,
  height = 28,
  color = 'var(--color-primary)',
}: SparklineProps) {
  if (values.length < 2) return <div style={{ width, height }} />

  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const range = max - min || 1
  const stepX = width / (values.length - 1)

  const points = values.map((v, i) => {
    const x = i * stepX
    const y = height - ((v - min) / range) * height
    return { x, y }
  })

  const linePath = points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const areaPath = `M0,${height} L${points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L')} L${width},${height} Z`
  const gradId = `sparkline-grad-${color.replace(/[^a-z0-9]/gi, '')}`

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.25} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <polyline fill="none" stroke={color} strokeWidth={1.5} points={linePath} />
    </svg>
  )
}

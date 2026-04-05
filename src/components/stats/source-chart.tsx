'use client'

import dynamic from 'next/dynamic'
import type { SourceData } from '@/lib/stats/queries'

interface SourceChartProps {
  data: SourceData[]
}

function ChartSkeleton() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, height: 140 }}>
      <div style={{ width: 110, height: 110, borderRadius: '50%', background: 'var(--bg-elevated)', animation: 'pulse 1.5s ease-in-out infinite' }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ height: 12, width: `${60 + i * 10}%`, background: 'var(--bg-elevated)', borderRadius: 4, animation: 'pulse 1.5s ease-in-out infinite' }} />
        ))}
      </div>
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
    </div>
  )
}

const SourcePieChart = dynamic(
  () => import('./source-chart-inner'),
  { ssr: false, loading: () => <ChartSkeleton /> },
)

export default function SourceChart({ data }: SourceChartProps) {
  if (data.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 140, color: 'var(--text-muted)', fontSize: 13 }}>
        Aucune donnée sur cette période
      </div>
    )
  }

  return <SourcePieChart data={data} />
}

'use client'

import dynamic from 'next/dynamic'
import type { LeadsPerDay } from '@/lib/stats/queries'

interface LeadsChartProps {
  data: LeadsPerDay[]
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

function ChartSkeleton() {
  return (
    <div style={{ width: '100%', height: 140, background: 'var(--bg-elevated)', borderRadius: 8, animation: 'pulse 1.5s ease-in-out infinite' }}>
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
    </div>
  )
}

const LeadsBarChart = dynamic(
  () => import('./leads-chart-inner').then(m => ({ default: m.default })),
  { ssr: false, loading: () => <ChartSkeleton /> },
)

export default function LeadsChart({ data }: LeadsChartProps) {
  if (data.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 140, color: 'var(--text-muted)', fontSize: 13 }}>
        Aucune donnée sur cette période
      </div>
    )
  }

  const formatted = data.map(d => ({ ...d, dateLabel: formatDate(d.date) }))

  return <LeadsBarChart formatted={formatted} />
}

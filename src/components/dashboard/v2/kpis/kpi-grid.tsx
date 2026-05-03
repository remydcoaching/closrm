'use client'

import KpiCard from './kpi-card'
import type { DashboardKpisV2 } from '@/lib/dashboard/v2-queries'

export default function KpiGrid({ kpis }: { kpis: DashboardKpisV2 }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 12,
        marginBottom: 16,
      }}
    >
      <KpiCard label="Cash collecté" value={kpis.cash_collected} />
      <KpiCard label="Show rate" value={kpis.show_rate} />
      <KpiCard label="Close rate" value={kpis.close_rate} />
      {kpis.cost_per_booking && <KpiCard label="Coût par RDV" value={kpis.cost_per_booking} />}
      <KpiCard label="Pipeline" value={kpis.pipeline_value} />
    </div>
  )
}

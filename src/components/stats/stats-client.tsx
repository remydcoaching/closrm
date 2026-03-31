'use client'

import StatsPeriodSelector from '@/components/stats/stats-period-selector'
import KpiCards from '@/components/stats/kpi-cards'
import LeadsChart from '@/components/stats/leads-chart'
import FunnelChart from '@/components/stats/funnel-chart'
import SourceChart from '@/components/stats/source-chart'
import MetaSection from '@/components/stats/meta-section'
import type { StatsKpis, LeadsPerDay, FunnelData, SourceData, MetaStats } from '@/lib/stats/queries'

interface StatsClientProps {
  period: number
  kpis: StatsKpis
  leadsPerDay: LeadsPerDay[]
  funnelData: FunnelData[]
  sourceData: SourceData[]
  meta: MetaStats
}

const CARD_STYLE = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-primary)',
  borderRadius: 12,
  padding: 16,
}

const CARD_TITLE_STYLE = {
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--text-tertiary)',
  letterSpacing: '0.5px',
  marginBottom: 12,
  textTransform: 'uppercase' as const,
}

export default function StatsClient({
  period, kpis, leadsPerDay, funnelData, sourceData, meta,
}: StatsClientProps) {
  return (
    <div style={{ padding: 32 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Statistiques</h1>
        <StatsPeriodSelector current={period} />
      </div>

      {/* 5 KPIs */}
      <KpiCards kpis={kpis} />

      {/* 3 charts en grille égale */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
        <div style={CARD_STYLE}>
          <div style={CARD_TITLE_STYLE}>Leads par jour</div>
          <LeadsChart data={leadsPerDay} />
        </div>
        <div style={CARD_STYLE}>
          <div style={CARD_TITLE_STYLE}>Funnel de conversion</div>
          <FunnelChart data={funnelData} />
        </div>
        <div style={CARD_STYLE}>
          <div style={CARD_TITLE_STYLE}>Par source</div>
          <SourceChart data={sourceData} />
        </div>
      </div>

      {/* Section Meta */}
      <MetaSection meta={meta} />
    </div>
  )
}

'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { MetaInsightsResponse } from '@/app/api/meta/insights/route'

interface AdsOverviewTabProps {
  data: MetaInsightsResponse | null
  closedCount: number
  closedRevenue: number
  loading: boolean
}

function formatEuro(n: number): string {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + '€'
}

function formatNumber(n: number): string {
  return n.toLocaleString('fr-FR')
}

const cardStyle: React.CSSProperties = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-primary)',
  borderRadius: 10,
  padding: 16,
}

export default function AdsOverviewTab({ data, closedCount, closedRevenue, loading }: AdsOverviewTabProps) {
  if (loading || !data) {
    return <OverviewSkeleton />
  }

  const { kpis, daily } = data
  const roas = kpis.spend > 0 ? Math.round((closedRevenue / kpis.spend) * 10) / 10 : null

  // Funnel steps
  const funnelSteps = [
    { label: 'Impressions', value: kpis.impressions, color: '#1877F2' },
    { label: 'Clics', value: kpis.clicks, color: '#1877F2', pct: kpis.impressions > 0 ? ((kpis.clicks / kpis.impressions) * 100).toFixed(1) + '%' : '—' },
    { label: 'Leads', value: kpis.leads, color: 'var(--color-primary)', pct: kpis.clicks > 0 ? ((kpis.leads / kpis.clicks) * 100).toFixed(1) + '%' : '—' },
    { label: 'Closés', value: closedCount, color: 'var(--color-primary)', pct: kpis.leads > 0 ? ((closedCount / kpis.leads) * 100).toFixed(1) + '%' : '—' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
        <KpiCard label="Budget dépensé" value={formatEuro(kpis.spend)} color="#1877F2" />
        <KpiCard label="Leads générés" value={formatNumber(kpis.leads)} color="var(--color-primary)" />
        <KpiCard label="Coût / lead" value={kpis.cpl !== null ? kpis.cpl.toFixed(2) + '€' : '—'} color="var(--text-primary)" />
        <KpiCard label="CTR" value={kpis.ctr.toFixed(2) + '%'} color="var(--text-primary)" />
        <KpiCard label="ROAS estimé" value={roas !== null ? roas + 'x' : '—'} color="var(--color-primary)" />
      </div>

      {/* Chart: Leads per day */}
      <div style={{ ...cardStyle, padding: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 12 }}>
          Leads / jour (Meta Ads)
        </div>
        {daily.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={daily}>
              <XAxis
                dataKey="date"
                tickFormatter={(d: string) => d.slice(5)}
                tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={30}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-primary)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelFormatter={(d) => `Date : ${String(d)}`}
                formatter={(value) => [String(value), 'Leads']}
              />
              <Bar dataKey="leads" fill="#1877F2" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>
            Aucune donnée pour cette période
          </div>
        )}
      </div>

      {/* Funnel */}
      <div style={{ ...cardStyle, padding: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 16 }}>
          Funnel marketing
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around' }}>
          {funnelSteps.map((step, i) => (
            <div key={step.label} style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
              <div style={{ textAlign: 'center', minWidth: 80 }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: step.color }}>
                  {formatNumber(step.value)}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {step.label}
                </div>
                {'pct' in step && step.pct && (
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 1 }}>
                    ({step.pct})
                  </div>
                )}
              </div>
              {i < funnelSteps.length - 1 && (
                <span style={{ color: 'var(--border-primary)', fontSize: 18, margin: '0 8px' }}>→</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function KpiCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={cardStyle}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
    </div>
  )
}

function OverviewSkeleton() {
  const skeletonCard: React.CSSProperties = {
    ...cardStyle,
    height: 72,
    background: 'var(--bg-elevated)',
    animation: 'pulse 1.5s ease-in-out infinite',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
        {[1, 2, 3, 4, 5].map(i => <div key={i} style={skeletonCard} />)}
      </div>
      <div style={{ ...skeletonCard, height: 230 }} />
      <div style={{ ...skeletonCard, height: 100 }} />
    </div>
  )
}

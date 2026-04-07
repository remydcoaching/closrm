'use client'

import dynamic from 'next/dynamic'
import type { MetaInsightsResponse } from '@/app/api/meta/insights/route'
import { getHealthColor, HEALTH_COLORS, type CampaignType, type HealthColor } from './health-thresholds'
import AdsInstagramGrowth from './ads-instagram-growth'

function AdsChartSkeleton() {
  return (
    <div style={{ width: '100%', height: 200, background: 'var(--bg-elevated)', borderRadius: 8, animation: 'pulse 1.5s ease-in-out infinite' }}>
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
    </div>
  )
}

const AdsBarChart = dynamic(
  () => import('./ads-chart-inner'),
  { ssr: false, loading: () => <AdsChartSkeleton /> },
)

interface AdsOverviewTabProps {
  data: MetaInsightsResponse | null
  closedCount: number
  closedRevenue: number
  loading: boolean
  campaignType: CampaignType | 'all'
  dateFrom: string
  dateTo: string
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

// ─── KPI Card with optional health dot ──────────────────────────────────────

interface KpiCardProps {
  label: string
  value: string
  color: string
  health?: HealthColor | null
}

function KpiCard({ label, value, color, health }: KpiCardProps) {
  return (
    <div style={cardStyle}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
        {health && (
          <span style={{
            display: 'inline-block',
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: HEALTH_COLORS[health],
          }} />
        )}
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
    </div>
  )
}

// ─── Funnel for Leadform ────────────────────────────────────────────────────

interface LeadformFunnelProps {
  impressions: number
  clicks: number
  leads: number
  closed: number
}

function LeadformFunnel({ impressions, clicks, leads, closed }: LeadformFunnelProps) {
  const steps = [
    { label: 'Impressions', value: impressions, color: '#1877F2' },
    { label: 'Clics', value: clicks, color: '#1877F2', pct: impressions > 0 ? ((clicks / impressions) * 100).toFixed(1) + '%' : '—' },
    { label: 'Leads', value: leads, color: 'var(--color-primary)', pct: clicks > 0 ? ((leads / clicks) * 100).toFixed(1) + '%' : '—' },
    { label: 'Closés', value: closed, color: 'var(--color-primary)', pct: leads > 0 ? ((closed / leads) * 100).toFixed(1) + '%' : '—' },
  ]
  return (
    <div style={{ ...cardStyle, padding: 20 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 16 }}>
        Funnel marketing
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around' }}>
        {steps.map((step, i) => (
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
            {i < steps.length - 1 && (
              <span style={{ color: 'var(--border-primary)', fontSize: 18, margin: '0 8px' }}>→</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Leadform section (KPIs + chart + funnel) ───────────────────────────────

interface LeadformSectionProps {
  kpis: MetaInsightsResponse['kpis']
  daily: MetaInsightsResponse['daily']
  closedCount: number
  closedRevenue: number
}

function LeadformSection({ kpis, daily, closedCount, closedRevenue }: LeadformSectionProps) {
  const roas = kpis.spend > 0 ? Math.round((closedRevenue / kpis.spend) * 10) / 10 : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
        <KpiCard label="Budget dépensé" value={formatEuro(kpis.spend)} color="#1877F2" />
        <KpiCard label="Leads générés" value={formatNumber(kpis.leads)} color="var(--color-primary)" />
        <KpiCard
          label="Coût / lead"
          value={kpis.cpl !== null ? kpis.cpl.toFixed(2) + '€' : '—'}
          color="var(--text-primary)"
          health={getHealthColor('leadform', 'cpl', kpis.cpl)}
        />
        <KpiCard
          label="CTR"
          value={kpis.ctr.toFixed(2) + '%'}
          color="var(--text-primary)"
          health={getHealthColor('leadform', 'ctr', kpis.ctr)}
        />
        <KpiCard
          label="ROAS estimé"
          value={roas !== null ? roas + 'x' : '—'}
          color="var(--color-primary)"
          health={getHealthColor('leadform', 'roas', roas)}
        />
      </div>

      <div style={{ ...cardStyle, padding: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 12 }}>
          Leads / jour (Meta Ads)
        </div>
        {daily.length > 0 ? (
          <AdsBarChart daily={daily} dataKey="leads" label="Leads" />
        ) : (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>
            Aucune donnée pour cette période
          </div>
        )}
      </div>

      <LeadformFunnel
        impressions={kpis.impressions}
        clicks={kpis.clicks}
        leads={kpis.leads}
        closed={closedCount}
      />
    </div>
  )
}

// ─── Follow Ads section (KPIs + chart + Instagram growth) ───────────────────

interface FollowAdsSectionProps {
  kpis: MetaInsightsResponse['kpis']
  daily: MetaInsightsResponse['daily']
  dateFrom: string
  dateTo: string
}

function FollowAdsSection({ kpis, daily, dateFrom, dateTo }: FollowAdsSectionProps) {
  const cpm = kpis.impressions > 0 ? Math.round((kpis.spend / kpis.impressions) * 100000) / 100 : null
  const costPerClick = kpis.clicks > 0 ? Math.round((kpis.spend / kpis.clicks) * 100) / 100 : null
  // For Follow Ads, we don't have a separate "reach" metric from insights — we approximate with impressions
  // (Meta returns impressions; reach would require an extra field)
  const reach = kpis.impressions

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
        <KpiCard label="Budget dépensé" value={formatEuro(kpis.spend)} color="#1877F2" />
        <KpiCard label="Impressions" value={formatNumber(kpis.impressions)} color="var(--text-primary)" />
        <KpiCard label="Reach" value={formatNumber(reach)} color="var(--text-primary)" />
        <KpiCard
          label="CPM"
          value={cpm !== null ? cpm.toFixed(2) + '€' : '—'}
          color="var(--text-primary)"
          health={getHealthColor('follow_ads', 'cpm', cpm)}
        />
        <KpiCard label="Clics profil" value={formatNumber(kpis.clicks)} color="var(--text-primary)" />
        <KpiCard
          label="Coût / clic"
          value={costPerClick !== null ? costPerClick.toFixed(2) + '€' : '—'}
          color="var(--text-primary)"
          health={getHealthColor('follow_ads', 'cost_per_click', costPerClick)}
        />
      </div>

      <div style={{ ...cardStyle, padding: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 12 }}>
          Impressions / jour (Meta Ads)
        </div>
        {daily.length > 0 ? (
          <AdsBarChart daily={daily} dataKey="impressions" label="Impressions" />
        ) : (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>
            Aucune donnée pour cette période
          </div>
        )}
      </div>

      <AdsInstagramGrowth dateFrom={dateFrom} dateTo={dateTo} />
    </div>
  )
}

// ─── Section header ─────────────────────────────────────────────────────────

function SectionHeader({ icon, title }: { icon: string; title: string }) {
  return (
    <div style={{
      fontSize: 11,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: 1,
      color: 'var(--text-muted)',
      marginBottom: 12,
      paddingBottom: 8,
      borderBottom: '1px solid var(--border-primary)',
    }}>
      {icon} {title}
    </div>
  )
}

// ─── Main component ─────────────────────────────────────────────────────────

export default function AdsOverviewTab({
  data,
  closedCount,
  closedRevenue,
  loading,
  campaignType,
  dateFrom,
  dateTo,
}: AdsOverviewTabProps) {
  if (loading || !data) {
    return <OverviewSkeleton />
  }

  // Mode Leadform: show only leadform KPIs/chart/funnel
  if (campaignType === 'leadform') {
    return (
      <LeadformSection
        kpis={data.kpis}
        daily={data.daily}
        closedCount={closedCount}
        closedRevenue={closedRevenue}
      />
    )
  }

  // Mode Follow Ads: show only follow ads KPIs/chart/Instagram growth
  if (campaignType === 'follow_ads') {
    return (
      <FollowAdsSection
        kpis={data.kpis}
        daily={data.daily}
        dateFrom={dateFrom}
        dateTo={dateTo}
      />
    )
  }

  // Mode 'all': stacked sections (Acquisition Prospects + Croissance & Notoriété)
  // Use per-type aggregates if available, otherwise fall back to total kpis
  const leadformKpis = data.leadformKpis ?? { spend: 0, impressions: 0, clicks: 0, ctr: 0, leads: 0, cpl: null }
  const leadformDaily = data.leadformDaily ?? []
  const followAdsKpis = data.followAdsKpis ?? { spend: 0, impressions: 0, clicks: 0, ctr: 0, leads: 0, cpl: null }
  const followAdsDaily = data.followAdsDaily ?? []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      <div>
        <SectionHeader icon="🎯" title="Acquisition Prospects" />
        <LeadformSection
          kpis={leadformKpis}
          daily={leadformDaily}
          closedCount={closedCount}
          closedRevenue={closedRevenue}
        />
      </div>
      <div>
        <SectionHeader icon="👥" title="Croissance & Notoriété" />
        <FollowAdsSection
          kpis={followAdsKpis}
          daily={followAdsDaily}
          dateFrom={dateFrom}
          dateTo={dateTo}
        />
      </div>
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

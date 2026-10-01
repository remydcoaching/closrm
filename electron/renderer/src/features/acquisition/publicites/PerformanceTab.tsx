// "Performance" — parity with the web's ads-performance-tab.tsx: overview
// metrics (followers, visit→follower rate, ad spend), conversion funnel
// (GET /api/performance/follow-ads), cost analysis, attribution by campaign
// type, and the recommendation cards (same insights engine).
// Improvements over the web, all from real data: the previous-period ad
// spend is fetched (web hardcodes 0 → fake +100 % deltas), and attribution
// uses the campaign-level breakdown (web passes the account-level one, which
// is always empty).
import { useCachedQuery } from '../../../lib/use-cached-query'
import { StatCard, StatGrid } from '../../../design-system/StatCard'
import { LoadingState, EmptyState } from '../../../design-system/States'
import { StatusPill } from '../../../design-system/StatusPill'
import { generateInsights, DEFAULT_TARGETS, type PerformanceInsight } from './insights-engine'
import { deltaPct, euro, num, pct, previousRange } from './metrics'
import type { CampaignTypeFilter, FollowAdsResponse, FunnelData, MetaBreakdownRow, MetaInsightsResponse } from './types'

interface Props {
  data: MetaInsightsResponse | null
  loading: boolean
  campaignType: CampaignTypeFilter
  dateFrom: string
  dateTo: string
  periodQuery: string
}

const TYPE_LABELS: Record<string, string> = {
  follow_ads: 'Instagram Follow Ads',
  leadform: 'Lead Form Ads',
  other: 'Autres campagnes',
}

const STATUS_STYLE: Record<PerformanceInsight['status'], { color: string; bg: string }> = {
  action_required: { color: 'var(--color-danger)', bg: 'var(--color-danger-soft)' },
  needs_optimization: { color: 'var(--color-warning)', bg: 'var(--color-warning-soft)' },
  on_track: { color: 'var(--color-success)', bg: 'var(--color-success-soft)' },
}

function convRate(visits: number, followers: number): number {
  return visits > 0 ? (followers / visits) * 100 : 0
}

export function PerformanceTab({ data, loading, campaignType, dateFrom, dateTo, periodQuery }: Props) {
  // Cached: instant on revisit, refreshed in the background.
  const funnelQuery = useCachedQuery<FollowAdsResponse>(`/api/performance/follow-ads?date_from=${dateFrom}&date_to=${dateTo}`, { screen: 'PublicitesFunnel', staleMs: 5 * 60_000 })
  const funnel: FunnelData | null = funnelQuery.data?.data.funnel ?? null
  const prevFunnel: FunnelData | null = funnelQuery.data?.data.previous_period ?? null
  const funnelState: 'loading' | 'ok' | 'error' = funnelQuery.data ? 'ok' : funnelQuery.error ? 'error' : 'loading'
  const prev = previousRange(dateFrom, dateTo)
  const prevQuery = useCachedQuery<MetaInsightsResponse>(`/api/meta/insights?level=account&date_from=${prev.dateFrom}&date_to=${prev.dateTo}&campaign_type=${campaignType}`, {
    screen: 'PublicitesPrev',
    staleMs: 30 * 60_000,
  })
  const prevSpend = prevQuery.data?.kpis.spend ?? null
  const campaignsQuery = useCachedQuery<MetaInsightsResponse>(`/api/meta/insights?level=campaign&${periodQuery}&campaign_type=${campaignType}`, { screen: 'PublicitesCampaigns', staleMs: 5 * 60_000 })
  const campaigns: MetaBreakdownRow[] | null = campaignsQuery.data ? (campaignsQuery.data.breakdown ?? []) : campaignsQuery.error ? [] : null

  if (loading || !data || funnelState === 'loading') return <LoadingState label="Analyse des performances…" />

  const adSpend = data.kpis.spend
  const followers = funnel?.followers ?? 0
  const followersPrev = prevFunnel?.followers ?? 0
  const visits = funnel?.profile_visits ?? 0
  const rate = convRate(visits, followers)
  const ratePrev = convRate(prevFunnel?.profile_visits ?? 0, followersPrev)
  const insights = funnel && prevFunnel ? generateInsights(funnel, prevFunnel, adSpend) : []

  return (
    <>
      <StatGrid>
        <StatCard label="Nouveaux abonnés" value={followers} delta={deltaPct(followers, followersPrev)} caption="vs période précédente" />
        <StatCard label="Taux de conversion" value={pct(rate)} delta={deltaPct(rate, ratePrev)} caption="Visite du profil → abonné" />
        <StatCard
          label="Budget publicitaire"
          value={euro(adSpend)}
          delta={prevSpend !== null ? deltaPct(adSpend, prevSpend) : null}
          caption={prevSpend !== null ? `Période précédente : ${euro(prevSpend)}` : 'Investissement total'}
        />
      </StatGrid>

      {funnelState === 'error' ? (
        <EmptyState title="Funnel indisponible" description="Les données de conversion Instagram n'ont pas pu être chargées." />
      ) : (
        <div className="pub-grid-2">
          {funnel && <FunnelPanel funnel={funnel} adSpend={adSpend} />}
          <CostPanel
            adSpend={adSpend}
            prevSpend={prevSpend}
            funnel={funnel}
            prevFunnel={prevFunnel}
            campaigns={campaigns}
          />
        </div>
      )}

      {insights.length > 0 && (
        <section className="pub-section">
          <div>
            <h2 className="pub-panel-title">Indicateurs de performance</h2>
            <p className="pub-panel-sub">Recommandations basées sur vos données pour maximiser vos résultats</p>
          </div>
          <div className="pub-grid-2">
            {insights.map((i) => (
              <InsightCard key={i.id} insight={i} />
            ))}
          </div>
        </section>
      )}
    </>
  )
}

function FunnelPanel({ funnel, adSpend }: { funnel: FunnelData; adSpend: number }) {
  const steps: { label: string; value: number | null; cash?: boolean }[] = [
    { label: 'Visites du profil', value: funnel.profile_visits },
    { label: 'Abonnés', value: funnel.followers },
    { label: 'Abonnés qualifiés', value: funnel.qualified_followers },
    { label: 'Conversations', value: funnel.conversations },
    { label: 'RDV pris', value: funnel.appointments },
    { label: 'Présences', value: funnel.show_ups },
    { label: 'CA généré', value: funnel.cash_collected, cash: true },
  ]
  const max = Math.max(...steps.filter((s) => !s.cash).map((s) => s.value ?? 0), 1)
  const cpf = funnel.followers > 0 ? adSpend / funnel.followers : null
  return (
    <div className="pub-panel">
      <div className="pub-panel-header">
        <div>
          <h3 className="pub-panel-title">Funnel de conversion</h3>
          <p className="pub-panel-sub">De la visite au cash</p>
        </div>
        {cpf !== null && <StatusPill label={`CPF : ${euro(cpf, 2)}`} color="var(--color-info)" bg="var(--color-info-soft)" />}
      </div>
      <div className="pub-vfunnel">
        {steps.map((s, i) => {
          const next = steps[i + 1]
          return (
            <div key={s.label}>
              <div className="pub-vfunnel-row">
                <span>{s.label}</span>
                <div className="pub-vfunnel-track">
                  {!s.cash && <div className="pub-vfunnel-fill" style={{ width: `${((s.value ?? 0) / max) * 100}%` }} />}
                </div>
                <span className="ds-num" style={{ textAlign: 'right' }}>
                  {s.value === null ? '—' : s.cash ? euro(s.value) : num(s.value)}
                </span>
              </div>
              {next && !next.cash && s.value !== null && s.value > 0 && next.value !== null && (
                <div className="pub-vfunnel-rate">↓ {pct((next.value / s.value) * 100, 2)} conversion</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CostPanel({
  adSpend,
  prevSpend,
  funnel,
  prevFunnel,
  campaigns,
}: {
  adSpend: number
  prevSpend: number | null
  funnel: FunnelData | null
  prevFunnel: FunnelData | null
  campaigns: MetaBreakdownRow[] | null
}) {
  const followers = funnel?.followers ?? 0
  const appts = funnel?.appointments ?? 0
  const cpf = followers > 0 ? adSpend / followers : null
  const cpa = appts > 0 ? adSpend / appts : null
  const cpfPrev = prevSpend !== null && (prevFunnel?.followers ?? 0) > 0 ? prevSpend / (prevFunnel?.followers ?? 1) : null
  const cpaPrev = prevSpend !== null && (prevFunnel?.appointments ?? 0) > 0 ? prevSpend / (prevFunnel?.appointments ?? 1) : null

  const grouped = new Map<string, { spend: number; clicks: number; impressions: number }>()
  for (const c of campaigns ?? []) {
    const g = grouped.get(c.campaign_type) ?? { spend: 0, clicks: 0, impressions: 0 }
    g.spend += c.spend
    g.clicks += c.clicks
    g.impressions += c.impressions
    grouped.set(c.campaign_type, g)
  }
  const entries = [...grouped.entries()].filter(([, g]) => g.spend > 0 || g.clicks > 0)
  const totalClicks = entries.reduce((s, [, g]) => s + g.clicks, 0)

  const costRows = [
    { label: 'Coût par abonné', value: cpf, prev: cpfPrev, target: DEFAULT_TARGETS.cost_per_follower },
    { label: 'Coût par RDV', value: cpa, prev: cpaPrev, target: DEFAULT_TARGETS.cost_per_appointment },
  ]

  return (
    <div className="pub-panel">
      <h3 className="pub-panel-title">Analyse des coûts</h3>
      <p className="pub-panel-sub">Métriques de coût par acquisition</p>
      <div style={{ margin: 'var(--space-3) 0 var(--space-5)' }}>
        {costRows.map((r) => {
          const d = r.value !== null && r.prev !== null ? deltaPct(r.value, r.prev) : null
          return (
            <div key={r.label} className="pub-cost-row">
              <div>
                <div className="ds-muted">{r.label}</div>
                <div className="pub-cost-value">
                  {r.value !== null ? euro(r.value, 2) : '—'}{' '}
                  {d !== null && (
                    <span className={d <= 0 ? 'pub-positive' : 'pub-negative'} style={{ fontSize: 'var(--font-size-xs)' }}>
                      {d <= 0 ? '▼' : '▲'} {d > 0 ? '+' : ''}
                      {Math.round(d)} %
                    </span>
                  )}
                </div>
              </div>
              <div className="pub-cost-meta">
                <span>Précédent : {r.prev !== null ? euro(r.prev, 2) : '—'}</span>
                <span>Objectif : {euro(r.target, 2)}</span>
              </div>
            </div>
          )
        })}
      </div>

      <h3 className="pub-panel-title">Attribution par source</h3>
      <p className="pub-panel-sub" style={{ marginBottom: 'var(--space-4)' }}>
        Répartition des clics par type de campagne
      </p>
      {campaigns === null ? (
        <p className="ds-muted">Chargement…</p>
      ) : entries.length === 0 ? (
        <p className="ds-muted">Aucune donnée de campagne disponible</p>
      ) : (
        entries.map(([type, g]) => {
          const share = totalClicks > 0 ? (g.clicks / totalClicks) * 100 : 0
          return (
            <div key={type} className="pub-attr">
              <div className="pub-attr-head">
                <span>{TYPE_LABELS[type] ?? type}</span>
                <span className="ds-num">
                  {num(g.clicks)} ({pct(share, 0)})
                </span>
              </div>
              <div className="pub-attr-track">
                <div className="pub-attr-fill" style={{ width: `${Math.min(share, 100)}%` }} />
              </div>
              <div className="pub-attr-foot">
                Dépense : {euro(g.spend, 2)} · Coût / clic : {g.clicks > 0 ? euro(g.spend / g.clicks, 2) : '—'}
              </div>
            </div>
          )
        })
      )}

      <div className="pub-kpi-mini-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginTop: 'var(--space-4)' }}>
        <div className="pub-kpi-mini">
          <span>Total abonnés</span>
          <strong>{num(followers)}</strong>
        </div>
        <div className="pub-kpi-mini">
          <span>Visites du profil</span>
          <strong>{num(funnel?.profile_visits ?? 0)}</strong>
        </div>
        <div className="pub-kpi-mini">
          <span>Conversations</span>
          <strong>{num(funnel?.conversations ?? 0)}</strong>
        </div>
      </div>
    </div>
  )
}

function InsightCard({ insight }: { insight: PerformanceInsight }) {
  const s = STATUS_STYLE[insight.status]
  return (
    <div className={`pub-insight pub-insight--${insight.status}`}>
      <div className="pub-insight-head">
        <span className="pub-insight-title">{insight.title}</span>
        <StatusPill label={insight.statusLabel} color={s.color} bg={s.bg} />
      </div>
      <div className="pub-insight-values">
        Actuel : {insight.currentValue} → Objectif : {insight.targetValue}
      </div>
      <p className="pub-insight-desc">{insight.description}</p>
      <div className="pub-insight-impact">
        <strong>Impact attendu : </strong>
        {insight.expectedImpact}
      </div>
      {insight.actionSteps.length > 0 && (
        <ol className="pub-insight-steps">
          {insight.actionSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      )}
    </div>
  )
}

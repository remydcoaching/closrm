// "Vue d'ensemble" — parity with the web's ads-overview-tab.tsx (Leadform /
// Follow Ads sections, KPIs with health dots, leads|impressions per day,
// marketing funnel, Instagram growth) plus the CRM results the web leaves at
// 0 (its closedRevenue is never set and closedCount reads json.total which
// /api/leads doesn't return): here they come from GET /api/meta/ad-performance
// (campaign level, split by campaign type via the campaign breakdown of
// GET /api/meta/insights). "Performance par plateforme" = real lead counts
// per Meta source from GET /api/leads (meta.total).
import { useMemo, useState } from 'react'
import { useCachedQuery } from '../../../lib/use-cached-query'
import { api } from '../../../lib/api-client'
import { openWeb } from '../../../lib/web-link'
import { StatCard, StatGrid } from '../../../design-system/StatCard'
import { TableCard } from '../../../design-system/TableCard'
import { Chips } from '../../../design-system/Tabs'
import { LoadingState } from '../../../design-system/States'
import { evaluateHealthColor } from './health-thresholds'
import { HealthBadge, DailyBarChart, DAILY_METRIC_LABEL, type DailyMetric } from './ui'
import { addCrm, crmByCampaignType, euro, num, pct, safeDiv, type CrmTotals } from './metrics'
import type {
  AdPerformanceResponse,
  CampaignTypeFilter,
  IgSnapshot,
  LeadsCountResponse,
  MetaDailyRow,
  MetaInsightsResponse,
  MetaKpis,
  ThresholdOverrides,
} from './types'

const EMPTY_KPIS: MetaKpis = {
  spend: 0, impressions: 0, clicks: 0, ctr: 0, leads: 0, cpl: null, frequency: 0,
  video_plays: 0, video_p25: 0, video_p50: 0, video_p75: 0, hook_rate: 0, hold_rate_25: 0, hold_rate_50: 0, hold_rate_75: 0,
}

interface Props {
  data: MetaInsightsResponse | null
  loading: boolean
  campaignType: CampaignTypeFilter
  dateFrom: string
  dateTo: string
  periodQuery: string
  thresholds: ThresholdOverrides
}

interface CrmState {
  global: CrmTotals
  leadform: CrmTotals
  follow: CrmTotals
  unattributed: CrmTotals
}

export function OverviewTab({ data, loading, campaignType, dateFrom, dateTo, periodQuery, thresholds }: Props) {
  // Cached: instant on revisit, refreshed in the background (same keys as the Campagnes tab).
  const perfQuery = useCachedQuery<AdPerformanceResponse>(`/api/meta/ad-performance?level=campaign&date_from=${dateFrom}&date_to=${dateTo}`, { screen: 'PublicitesCrm', staleMs: 5 * 60_000 })
  const campaignsQuery = useCachedQuery<MetaInsightsResponse>(`/api/meta/insights?level=campaign&${periodQuery}&campaign_type=all`, { screen: 'PublicitesCampaigns', staleMs: 5 * 60_000 })
  const crmError = !!perfQuery.error || !!campaignsQuery.error
  const crm = useMemo<CrmState | null>(() => {
    if (!perfQuery.data || !campaignsQuery.data) return null
    const split = crmByCampaignType(perfQuery.data.data ?? [], campaignsQuery.data.breakdown ?? [])
    const all = addCrm(addCrm(addCrm(split.leadform, split.follow_ads), split.other), split.unattributed)
    const global = campaignType === 'all' ? all : campaignType === 'leadform' ? split.leadform : campaignType === 'follow_ads' ? split.follow_ads : split.other
    return { global, leadform: split.leadform, follow: split.follow_ads, unattributed: split.unattributed }
  }, [perfQuery.data, campaignsQuery.data, campaignType])

  if (loading || !data) return <LoadingState label="Chargement des performances Meta…" />

  const showLeadform = campaignType === 'all' || campaignType === 'leadform'
  const showFollow = campaignType === 'all' || campaignType === 'follow_ads'
  const leadformKpis = campaignType === 'all' ? data.leadformKpis ?? EMPTY_KPIS : data.kpis
  const leadformDaily = campaignType === 'all' ? data.leadformDaily ?? [] : data.daily
  const followKpis = campaignType === 'all' ? data.followAdsKpis ?? EMPTY_KPIS : data.kpis
  const followDaily = campaignType === 'all' ? data.followAdsDaily ?? [] : data.daily

  return (
    <>
      <GlobalResults kpis={data.kpis} crm={crm} crmError={crmError} unattributed={campaignType === 'all' ? crm?.unattributed ?? null : null} thresholds={thresholds} />

      <PanelChart title="Dépense & leads par jour" subtitle="Toutes campagnes du filtre courant (Meta Ads)" daily={data.daily} initial="spend" />

      {showLeadform && (
        <section className="pub-section">
          {campaignType === 'all' && <h2 className="pub-section-title">Acquisition prospects (Leadform)</h2>}
          <LeadformSection kpis={leadformKpis} daily={leadformDaily} crm={crm ? (campaignType === 'all' ? crm.leadform : crm.global) : null} thresholds={thresholds} />
        </section>
      )}

      {showFollow && (
        <section className="pub-section">
          {campaignType === 'all' && <h2 className="pub-section-title">Croissance & notoriété (Follow Ads)</h2>}
          <FollowSection kpis={followKpis} daily={followDaily} dateFrom={dateFrom} dateTo={dateTo} thresholds={thresholds} />
        </section>
      )}

      {campaignType === 'other' && <PanelChart title="Leads / jour" subtitle="Campagnes « autres » (Meta Ads)" daily={data.daily} initial="leads" />}

      <PlatformPerformance dateFrom={dateFrom} dateTo={dateTo} />
    </>
  )
}

function GlobalResults({
  kpis,
  crm,
  crmError,
  unattributed,
  thresholds,
}: {
  kpis: MetaKpis
  crm: CrmState | null
  crmError: boolean
  unattributed: CrmTotals | null
  thresholds: ThresholdOverrides
}) {
  const c = crm?.global ?? null
  const dash = crmError ? '—' : '…'
  const cplQualified = c ? safeDiv(kpis.spend, c.qualified_count) : null
  const cpclose = c ? safeDiv(kpis.spend, c.closed_count) : null
  const roas = c ? safeDiv(c.revenue, kpis.spend) : null
  return (
    <section className="pub-section">
      <h2 className="pub-section-title">Résultats de la période</h2>
      <StatGrid>
        <StatCard label="Dépensé" value={euro(kpis.spend)} caption="Budget consommé (Meta)" />
        <StatCard label="Leads générés (Meta)" value={kpis.leads} caption={`${num(kpis.impressions)} impressions · ${num(kpis.clicks)} clics`} />
        <StatCard
          label="Coût par lead"
          value={kpis.cpl !== null ? euro(kpis.cpl, 2) : '—'}
          caption={<HealthBadge color={evaluateHealthColor('cpl', kpis.cpl, thresholds)} suffix="CPL Meta" />}
        />
        <StatCard
          label="ROAS"
          highlight
          value={c ? (roas !== null ? `${roas.toFixed(2).replace('.', ',')}x` : '—') : dash}
          caption={<HealthBadge color={evaluateHealthColor('roas', roas, thresholds)} suffix="CA contracté / dépense" />}
        />
      </StatGrid>
      <StatGrid>
        <StatCard
          label="Leads CRM"
          value={c ? c.lead_count : dash}
          caption={unattributed && unattributed.lead_count > 0 ? `dont ${num(unattributed.lead_count)} non attribués à une campagne` : 'Leads Meta présents dans ClosRM'}
        />
        <StatCard
          label="Qualifiés"
          value={c ? c.qualified_count : dash}
          caption={<HealthBadge color={evaluateHealthColor('cpl_qualified', cplQualified, thresholds)} suffix={cplQualified !== null ? `CPL qualifié ${euro(cplQualified, 2)}` : 'CPL qualifié —'} />}
        />
        <StatCard
          label="Closés"
          value={c ? c.closed_count : dash}
          caption={<HealthBadge color={evaluateHealthColor('cpclose', cpclose, thresholds)} suffix={cpclose !== null ? `Coût / vente ${euro(cpclose)}` : 'Coût / vente —'} />}
        />
        <StatCard
          label="CA contracté"
          value={c ? euro(c.revenue) : dash}
          caption={c ? `Cash collecté ${euro(c.cash_collected)} · marge ${euro(c.revenue - kpis.spend)}` : undefined}
        />
      </StatGrid>
      {crmError && <p className="ds-muted">Les résultats CRM (leads, closés, CA) n'ont pas pu être chargés.</p>}
    </section>
  )
}

function PanelChart({ title, subtitle, daily, initial }: { title: string; subtitle: string; daily: MetaDailyRow[]; initial: DailyMetric }) {
  const [metric, setMetric] = useState<DailyMetric>(initial)
  const items = (Object.keys(DAILY_METRIC_LABEL) as DailyMetric[]).map((k) => ({ key: k, label: DAILY_METRIC_LABEL[k] }))
  return (
    <div className="pub-panel">
      <div className="pub-panel-header">
        <div>
          <h3 className="pub-panel-title">{title}</h3>
          <p className="pub-panel-sub">{subtitle}</p>
        </div>
        <Chips items={items} active={metric} onChange={setMetric} />
      </div>
      <DailyBarChart daily={daily} metric={metric} />
    </div>
  )
}

function LeadformSection({ kpis, daily, crm, thresholds }: { kpis: MetaKpis; daily: MetaDailyRow[]; crm: CrmTotals | null; thresholds: ThresholdOverrides }) {
  const roas = crm ? safeDiv(crm.revenue, kpis.spend) : null
  const closed = crm?.closed_count ?? null
  const steps: { label: string; value: number | null; rate: string | null }[] = [
    { label: 'Impressions', value: kpis.impressions, rate: null },
    { label: 'Clics', value: kpis.clicks, rate: kpis.impressions > 0 ? pct((kpis.clicks / kpis.impressions) * 100) : '—' },
    { label: 'Leads', value: kpis.leads, rate: kpis.clicks > 0 ? pct((kpis.leads / kpis.clicks) * 100) : '—' },
    { label: 'Closés', value: closed, rate: closed !== null && kpis.leads > 0 ? pct((closed / kpis.leads) * 100) : '—' },
  ]
  return (
    <>
      <StatGrid>
        <StatCard label="Budget dépensé" value={euro(kpis.spend)} />
        <StatCard label="Leads générés" value={kpis.leads} />
        <StatCard label="Coût / lead" value={kpis.cpl !== null ? euro(kpis.cpl, 2) : '—'} caption={<HealthBadge color={evaluateHealthColor('cpl', kpis.cpl, thresholds)} />} />
        <StatCard label="CTR" value={`${kpis.ctr.toFixed(2)} %`} caption={<HealthBadge color={evaluateHealthColor('ctr', kpis.impressions > 0 ? kpis.ctr : null, thresholds)} />} />
        <StatCard
          label="ROAS"
          value={crm ? (roas !== null ? `${roas.toFixed(2).replace('.', ',')}x` : '—') : '…'}
          caption={<HealthBadge color={evaluateHealthColor('roas', roas, thresholds)} suffix={crm ? `CA ${euro(crm.revenue)}` : undefined} />}
        />
      </StatGrid>
      <PanelChart title="Leads / jour (Meta Ads)" subtitle="Campagnes Leadform" daily={daily} initial="leads" />
      <div className="pub-panel">
        <div className="pub-panel-header">
          <div>
            <h3 className="pub-panel-title">Funnel marketing</h3>
            <p className="pub-panel-sub">De l'impression à la vente — closés = leads CRM de ces campagnes passés en « Closé »</p>
          </div>
        </div>
        <div className="pub-funnel">
          {steps.map((s, i) => (
            <FunnelStep key={s.label} step={s} last={i === steps.length - 1} />
          ))}
        </div>
      </div>
    </>
  )
}

function FunnelStep({ step, last }: { step: { label: string; value: number | null; rate: string | null }; last: boolean }) {
  return (
    <>
      <div className="pub-funnel-step">
        <span className="pub-funnel-value">{step.value === null ? '…' : num(step.value)}</span>
        <span className="pub-funnel-label">{step.label}</span>
        {step.rate && <span className="pub-funnel-rate">({step.rate})</span>}
      </div>
      {!last && <span className="pub-funnel-arrow">→</span>}
    </>
  )
}

function FollowSection({
  kpis,
  daily,
  dateFrom,
  dateTo,
  thresholds,
}: {
  kpis: MetaKpis
  daily: MetaDailyRow[]
  dateFrom: string
  dateTo: string
  thresholds: ThresholdOverrides
}) {
  const cpm = kpis.impressions > 0 ? (kpis.spend / kpis.impressions) * 1000 : null
  const cpc = kpis.clicks > 0 ? kpis.spend / kpis.clicks : null
  return (
    <>
      <StatGrid>
        <StatCard label="Budget dépensé" value={euro(kpis.spend)} />
        <StatCard label="Impressions" value={kpis.impressions} caption={kpis.frequency > 0 ? `Répétition moy. ${kpis.frequency.toFixed(2)}` : undefined} />
        <StatCard label="CPM" value={cpm !== null ? euro(cpm, 2) : '—'} caption={<HealthBadge color={evaluateHealthColor('cpm', cpm, thresholds)} />} />
        <StatCard label="Clics profil" value={kpis.clicks} />
        <StatCard label="Coût / clic" value={cpc !== null ? euro(cpc, 2) : '—'} caption={<HealthBadge color={evaluateHealthColor('cpc', cpc, thresholds)} />} />
      </StatGrid>
      <PanelChart title="Impressions / jour (Meta Ads)" subtitle="Campagnes Follow Ads" daily={daily} initial="impressions" />
      <InstagramGrowth dateFrom={dateFrom} dateTo={dateTo} />
    </>
  )
}

function InstagramGrowth({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const query = useCachedQuery<{ data: IgSnapshot[] }>('/api/instagram/snapshots', { screen: 'PublicitesIgGrowth', staleMs: 10 * 60_000 })
  const failed = !!query.error
  const snapshots = useMemo(
    () =>
      query.data
        ? (query.data.data ?? []).filter((s) => s.snapshot_date >= dateFrom && s.snapshot_date <= dateTo).sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date))
        : null,
    [query.data, dateFrom, dateTo],
  )

  if (!failed && snapshots === null) return <LoadingState label="Croissance Instagram…" />

  if (failed || !snapshots || snapshots.length === 0) {
    return (
      <div className="pub-banner pub-banner--info">
        <div>
          <p className="pub-banner-title">Connecte Instagram</p>
          <p className="pub-banner-text">pour voir ta croissance followers en temps réel (aucun relevé sur la période).</p>
        </div>
        <button type="button" className="ds-pill-button ds-pill-button--dark" onClick={() => void openWeb('/parametres/integrations')}>
          Connecter →
        </button>
      </div>
    )
  }

  const first = snapshots[0]
  const last = snapshots[snapshots.length - 1]
  const gained = last.followers - first.followers
  const growth = first.followers > 0 ? (gained / first.followers) * 100 : null
  return (
    <div className="pub-panel">
      <div className="pub-panel-header">
        <div>
          <h3 className="pub-panel-title">Croissance Instagram (période)</h3>
          <p className="pub-panel-sub">
            Relevés du {first.snapshot_date} au {last.snapshot_date}
          </p>
        </div>
      </div>
      <div className="pub-ig-growth">
        <div>
          <strong>
            {gained >= 0 ? '+' : ''}
            {num(gained)}
          </strong>
          <span>Nouveaux followers</span>
        </div>
        <div>
          <strong>{num(last.followers)}</strong>
          <span>Total followers</span>
        </div>
        <div>
          <strong>{growth !== null ? pct(growth) : '—'}</strong>
          <span>Taux de croissance</span>
        </div>
      </div>
    </div>
  )
}

const PLATFORMS: { source: string; label: string }[] = [
  { source: 'facebook_ads', label: 'Facebook Ads' },
  { source: 'instagram_ads', label: 'Instagram Ads' },
  { source: 'follow_ads', label: 'Follow Ads (Instagram)' },
]

// ad-performance counts a lead as "qualifié" when status !== 'dead'.
const QUALIFIED_STATUSES = 'nouveau,scripte,setting_planifie,no_show_setting,closing_planifie,no_show_closing,clos,pas_qualifie'

interface PlatformRow {
  source: string
  label: string
  leads: number
  qualified: number
  closed: number
}

function PlatformPerformance({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const query = useCachedQuery<PlatformRow[]>(`desktop:ads-platforms:${dateFrom}:${dateTo}`, {
    screen: 'PublicitesPlatforms',
    staleMs: 5 * 60_000,
    fetcher: () => {
      const range = `date_from=${encodeURIComponent(`${dateFrom}T00:00:00.000Z`)}&date_to=${encodeURIComponent(`${dateTo}T23:59:59.999Z`)}`
      const count = (qs: string) => api.get<LeadsCountResponse>(`/api/leads?${qs}&${range}&page=1&per_page=1`).then((r) => r.meta?.total ?? 0)
      return Promise.all(
        PLATFORMS.map(async (p) => {
          const [leads, qualified, closed] = await Promise.all([
            count(`source=${p.source}`),
            count(`source=${p.source}&status=${QUALIFIED_STATUSES}`),
            count(`source=${p.source}&status=clos`),
          ])
          return { ...p, leads, qualified, closed }
        }),
      )
    },
  })
  const rows = query.data ?? null
  const failed = !!query.error

  const total = rows?.reduce((s, r) => s + r.leads, 0) ?? 0

  return (
    <TableCard title="Performance par plateforme" subtitle="Leads CRM créés sur la période, par source Meta">
      {failed ? (
        <p className="ds-muted" style={{ padding: 'var(--space-4)' }}>
          Impossible de charger la répartition par plateforme.
        </p>
      ) : !rows ? (
        <LoadingState />
      ) : (
        <table className="ds-table">
          <thead>
            <tr>
              <th>Plateforme</th>
              <th className="ds-num-cell">Leads</th>
              <th className="ds-num-cell">Part</th>
              <th className="ds-num-cell">Qualifiés</th>
              <th className="ds-num-cell">Closés</th>
              <th className="ds-num-cell">Taux de closing</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.source}>
                <td>
                  <span className="pub-row-name">{r.label}</span>
                </td>
                <td className="ds-num-cell">
                  <span className="ds-num">{num(r.leads)}</span>
                </td>
                <td className="ds-num-cell">
                  <span className="ds-num">{total > 0 ? pct((r.leads / total) * 100, 0) : '—'}</span>
                </td>
                <td className="ds-num-cell">
                  <span className="ds-num">{num(r.qualified)}</span>
                </td>
                <td className="ds-num-cell">
                  <span className="ds-num">{num(r.closed)}</span>
                </td>
                <td className="ds-num-cell">
                  <span className="ds-num">{r.leads > 0 ? pct((r.closed / r.leads) * 100) : '—'}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </TableCard>
  )
}


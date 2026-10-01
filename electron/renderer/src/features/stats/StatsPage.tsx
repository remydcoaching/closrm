// Statistiques — parity with the web's src/app/(dashboard)/statistiques
// (5 KPIs, leads par jour, funnel, par source, bloc Meta Ads) plus, as
// requested ("stats grandement améliorées, inspiration Insyder"):
//  • delta vs previous window on every KPI (2 fetches: current + previous
//    window of the SAME endpoints — never for "Tout", which has no previous)
//  • CA signé / cash collecté (GET /api/deals, started_at in window)
//  • ROAS = cash collecté / dépense Meta on the same window
//  • performance par membre (GET /api/workspaces/reporting, admin only)
// The web page is a Server Component querying Supabase directly (no API
// route), so every figure is rebuilt from the list endpoints — see
// stats-api.ts / stats-compute.ts for the exact mapping.
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCachedQuery } from '../../lib/use-cached-query'
import { registerLoader } from '../../lib/query-cache'
import { openWeb } from '../../lib/web-link'
import { StatCard, StatGrid, formatNumber } from '../../design-system/StatCard'
import { TableCard } from '../../design-system/TableCard'
import { Chips } from '../../design-system/Tabs'
import { Avatar } from '../../design-system/Avatar'
import { LoadingState, ErrorState, EmptyState } from '../../design-system/States'
import { sourceEntry } from '../leads/status'
import type { Lead, LeadSource } from '../leads/types'
import {
  countLeads,
  fetchCallsCreatedSince,
  fetchDeals,
  fetchLeadsInWindow,
  fetchMetaInsights,
  fetchReporting,
  LEAD_SOURCES,
  type MemberReport,
  type MetaInsightsResult,
} from './stats-api'
import { bucketSeries, formatEuro, formatEuroCents, inWindow, isoDate, pctDelta, periodWindows, sumBy, type StatsPeriod, type TimeWindow } from './metrics'
import { computePeriodFigures, countBySource, type PeriodFigures } from './stats-compute'
import { BarChart, ChartCard, DeltaTag, FunnelSteps, RankedBars } from './charts'
import './stats.css'

const PERIODS: { key: string; label: string }[] = [
  { key: '7', label: '7 jours' },
  { key: '30', label: '30 jours' },
  { key: '90', label: '90 jours' },
  { key: '0', label: 'Tout' },
]

interface StatsData {
  period: StatsPeriod
  current: TimeWindow | null
  cur: PeriodFigures
  prev: PeriodFigures | null
  leads: Lead[]
  leadsTruncated: boolean
  callsTruncated: boolean
  sourcesPrev: Partial<Record<LeadSource, number>> | null
  meta: { current: MetaInsightsResult; previous: MetaInsightsResult | null; window: TimeWindow; cash: number; cashPrev: number | null }
  team: MemberReport[] | null
  teamPrev: MemberReport[] | null
}

async function loadStats(period: StatsPeriod): Promise<StatsData> {
  const now = new Date()
  const { current, previous } = periodWindows(period, now)
  // Meta block: same window as the page; "Tout" falls back to the web's
  // fixed 30-day window (fetchMetaStats) since Meta needs explicit dates.
  const metaWindows = periodWindows(period === 0 ? 30 : period, now)
  const metaCur = metaWindows.current as TimeWindow
  const metaPrev = period === 0 ? null : metaWindows.previous

  const [leadsCount, leadsPrevCount, closedCount, closedPrevCount, leadsPaged, callsPaged, deals, sourcesPrevList, metaCurRes, metaPrevRes, team, teamPrev] = await Promise.all([
    countLeads({ window: current }),
    previous ? countLeads({ window: previous }) : Promise.resolve(null),
    countLeads({ window: current, status: 'clos', dateField: 'updated_at' }),
    previous ? countLeads({ window: previous, status: 'clos', dateField: 'updated_at' }) : Promise.resolve(null),
    fetchLeadsInWindow(current),
    fetchCallsCreatedSince(previous ? previous.from : current ? current.from : null),
    fetchDeals(),
    previous ? Promise.all(LEAD_SOURCES.map(async (s) => [s, await countLeads({ window: previous, source: s })] as const)) : Promise.resolve(null),
    fetchMetaInsights(isoDate(metaCur.from), isoDate(metaCur.to)),
    metaPrev ? fetchMetaInsights(isoDate(metaPrev.from), isoDate(new Date(metaPrev.to.getTime() - 86_400_000))) : Promise.resolve(null),
    fetchReporting(current ? isoDate(current.from) : '2000-01-01', isoDate(now)).catch(() => null),
    previous ? fetchReporting(isoDate(previous.from), isoDate(new Date(previous.to.getTime() - 86_400_000))).catch(() => null) : Promise.resolve(null),
  ])

  const cur = computePeriodFigures({ window: current, leadsCount, closedCount, calls: callsPaged.rows, deals })
  const prev =
    previous && leadsPrevCount !== null && closedPrevCount !== null
      ? computePeriodFigures({ window: previous, leadsCount: leadsPrevCount, closedCount: closedPrevCount, calls: callsPaged.rows, deals })
      : null

  const cashIn = (w: TimeWindow) => sumBy(deals.filter((d) => inWindow(d.started_at, w)), (d) => d.cash_collected)

  return {
    period,
    current,
    cur,
    prev,
    leads: leadsPaged.rows,
    leadsTruncated: leadsPaged.truncated,
    callsTruncated: callsPaged.truncated,
    sourcesPrev: sourcesPrevList ? Object.fromEntries(sourcesPrevList) : null,
    meta: { current: metaCurRes, previous: metaPrevRes, window: metaCur, cash: cashIn(metaCur), cashPrev: metaPrev ? cashIn(metaPrev) : null },
    team,
    teamPrev,
  }
}

function pctLabel(v: number | null): string {
  return v === null ? '—' : `${v} %`
}

/** Delta in percentage POINTS for rates would be more precise, but the
 *  StatCard contract is "% vs période précédente" — keep it consistent. */
function d(cur: number | null, prev: PeriodFigures | null, pick: (p: PeriodFigures) => number | null): number | null {
  if (!prev) return null
  return pctDelta(cur, pick(prev))
}

/** Windows come back from the persisted cache as ISO strings. */
function reviveStats(d: StatsData): StatsData {
  const win = (w: TimeWindow | null) => (w ? { ...w, from: new Date(w.from), to: new Date(w.to) } : null)
  return { ...d, current: win(d.current), meta: { ...d.meta, window: win(d.meta.window) as TimeWindow } }
}

/** Cache key of a period's figures — also used to prefetch the page. */
const statsKey = (period: StatsPeriod) => `desktop:stats:${period}`
registerLoader('desktop:stats:', (key) => {
  const period = Number(key.slice('desktop:stats:'.length))
  return period === 0 || period === 7 || period === 30 || period === 90 ? () => loadStats(period) : null
})

export function StatsPage() {
  const navigate = useNavigate()
  const [period, setPeriod] = useState<StatsPeriod>(30)
  // Last figures shown at once, recomputed in the background (≈ 20 requests).
  const query = useCachedQuery<StatsData>(statsKey(period), { screen: 'Stats', staleMs: 60_000, keepPrevious: true, fetcher: () => loadStats(period) })
  const data = useMemo(() => (query.data ? reviveStats(query.data) : null), [query.data])
  const error = query.error
  const load = query.refresh

  return (
    <div className="stats-page">
      <div className="stats-page-header">
        <div>
          <h1>Statistiques</h1>
          <p>{period === 0 ? 'Depuis le début' : `${period} derniers jours, comparés aux ${period} jours précédents`}</p>
        </div>
        <Chips items={PERIODS} active={String(period)} onChange={(k) => setPeriod(Number(k) as StatsPeriod)} />
      </div>

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : !data ? (
        <LoadingState label="Calcul des statistiques…" />
      ) : (
        <StatsBody data={data} onOpenLeads={() => navigate('/leads')} onOpenDeals={() => navigate('/deals')} onOpenClosing={() => navigate('/closing')} />
      )}
    </div>
  )
}

function StatsBody({ data, onOpenLeads, onOpenDeals, onOpenClosing }: { data: StatsData; onOpenLeads: () => void; onOpenDeals: () => void; onOpenClosing: () => void }) {
  const { cur, prev } = data
  const seriesFrom = data.current?.from ?? (data.leads[0] ? new Date(data.leads[0].created_at) : new Date())
  const series = bucketSeries(data.leads.map((l) => ({ at: l.created_at })), seriesFrom, new Date())
  const sources = countBySource(data.leads)
  const totalForShare = data.leads.length

  return (
    <>
      {(data.leadsTruncated || data.callsTruncated) && (
        <div className="stats-notice stats-notice--warning">
          Volume très élevé : une partie des lignes n'a pas pu être chargée, le graphique et le funnel peuvent être partiels. Les KPI « Leads » et « Deals closés » restent exacts.
        </div>
      )}

      <StatGrid>
        <StatCard label="Leads totaux" value={cur.leads} delta={d(cur.leads, prev, (p) => p.leads)} caption={prev ? `${formatNumber(prev.leads)} la période précédente` : undefined} onClick={onOpenLeads} />
        <StatCard label="Calls bookés" value={cur.booked} delta={d(cur.booked, prev, (p) => p.booked)} caption={`Taux de booking : ${pctLabel(cur.bookingRate)}`} onClick={onOpenClosing} />
        <StatCard label="Taux de booking" value={pctLabel(cur.bookingRate)} delta={d(cur.bookingRate, prev, (p) => p.bookingRate)} caption="Calls bookés / leads" />
        <StatCard label="Deals closés" value={cur.closed} delta={d(cur.closed, prev, (p) => p.closed)} caption={`Win rate : ${pctLabel(cur.winRate)}`} highlight />
        <StatCard label="Win rate" value={pctLabel(cur.winRate)} delta={d(cur.winRate, prev, (p) => p.winRate)} caption="Deals closés / calls bookés" />
      </StatGrid>

      <StatGrid>
        <StatCard label="CA signé" value={formatEuro(cur.revenue)} delta={d(cur.revenue, prev, (p) => p.revenue)} caption={`${formatNumber(cur.dealsCount)} deal${cur.dealsCount > 1 ? 's' : ''} démarré${cur.dealsCount > 1 ? 's' : ''} sur la période`} onClick={onOpenDeals} />
        <StatCard label="Cash collecté" value={formatEuro(cur.cash)} delta={d(cur.cash, prev, (p) => p.cash)} caption={cur.revenue > 0 ? `${Math.round((cur.cash / cur.revenue) * 100)} % du CA signé` : 'Sur les deals de la période'} />
        <StatCard label="Panier moyen" value={cur.dealsCount > 0 ? formatEuro(cur.revenue / cur.dealsCount) : '—'} delta={prev && prev.dealsCount > 0 && cur.dealsCount > 0 ? pctDelta(Math.round(cur.revenue / cur.dealsCount), Math.round(prev.revenue / prev.dealsCount)) : null} caption="CA signé / nombre de deals" />
      </StatGrid>

      <ChartCard
        title="Leads par jour"
        subtitle={`${formatNumber(data.leads.length)} leads${series.granularity === 'month' ? ' · regroupés par mois' : ''}`}
      >
        <BarChart points={series.points} />
      </ChartCard>

      <div className="stats-grid-2">
        <ChartCard title="Funnel de conversion" subtitle="Leads uniques ayant atteint chaque étape">
          <FunnelSteps
            stages={[
              { key: 'leads', label: 'Leads', value: cur.leads, color: 'var(--color-info)', onClick: onOpenLeads },
              { key: 'setting', label: 'Setting', value: cur.settingLeads, color: 'var(--color-warning)' },
              { key: 'closing', label: 'Closing', value: cur.closingLeads, color: '#a855f7', onClick: onOpenClosing },
              { key: 'clos', label: 'Closé', value: cur.closed, color: 'var(--color-success)' },
            ]}
          />
        </ChartCard>
        <ChartCard title="Par source" subtitle={data.sourcesPrev ? 'Variation vs période précédente' : undefined}>
          <RankedBars
            rows={sources.map((s) => {
              const e = sourceEntry(s.source as LeadSource)
              const prevCount = data.sourcesPrev?.[s.source as LeadSource]
              return {
                key: s.source,
                label: e.label,
                value: s.count,
                color: e.color,
                caption: totalForShare > 0 ? `${Math.round((s.count / totalForShare) * 100)} %` : undefined,
                delta: prevCount !== undefined ? pctDelta(s.count, prevCount) : null,
              }
            })}
          />
        </ChartCard>
      </div>

      <MetaBlock meta={data.meta} period={data.period} crmLeadsFromAds={data.leads.filter((l) => inWindow(l.created_at, data.meta.window) && (l.source === 'facebook_ads' || l.source === 'instagram_ads')).length} />

      {data.team && <TeamReportTable team={data.team} teamPrev={data.teamPrev} />}
    </>
  )
}

function MetaBlock({ meta, period, crmLeadsFromAds }: { meta: StatsData['meta']; period: StatsPeriod; crmLeadsFromAds: number }) {
  const res = meta.current
  if (res.state === 'not_connected' || res.state === 'needs_upgrade') {
    return (
      <div className="stats-meta-banner">
        <div>
          <strong>Performance Meta Ads</strong>
          <span>
            {res.state === 'not_connected'
              ? 'Connecte ton compte Meta pour voir le coût par lead et le ROAS.'
              : 'Reconnecte Meta pour accéder aux données publicitaires.'}
          </span>
        </div>
        <button type="button" className="ds-pill-button ds-pill-button--dark" onClick={() => openWeb('/parametres/integrations')}>
          Connecter Meta →
        </button>
      </div>
    )
  }
  if (res.state === 'error') {
    return (
      <ChartCard title="Performance Meta Ads">
        <EmptyState title="Données Meta indisponibles" description={res.message} />
      </ChartCard>
    )
  }
  const k = res.kpis
  const p = meta.previous?.state === 'connected' ? meta.previous.kpis : null
  const roas = k.spend > 0 ? meta.cash / k.spend : null
  const roasPrev = p && p.spend > 0 && meta.cashPrev !== null ? meta.cashPrev / p.spend : null
  return (
    <section className="stats-card">
      <header className="stats-card-header">
        <div>
          <h2>Performance Meta Ads</h2>
          <p>{period === 0 ? '30 derniers jours' : `${period} derniers jours`} · données Meta Ads (compte publicitaire)</p>
        </div>
      </header>
      <StatGrid>
        <StatCard label="Budget dépensé" value={formatEuro(k.spend)} delta={p ? pctDelta(k.spend, p.spend) : null} caption={`${formatNumber(k.impressions)} impressions · CTR ${k.ctr.toLocaleString('fr-FR')} %`} />
        <StatCard label="Coût / lead" value={k.cpl !== null ? formatEuroCents(k.cpl) : '—'} delta={p && k.cpl !== null && p.cpl !== null ? pctDelta(k.cpl, p.cpl) : null} caption={`${formatNumber(k.leads)} leads comptés par Meta · ${formatNumber(crmLeadsFromAds)} dans le CRM`} />
        <StatCard
          label="ROAS"
          value={roas !== null ? `${roas.toLocaleString('fr-FR', { maximumFractionDigits: 1 })}x` : '—'}
          delta={roas !== null && roasPrev !== null ? pctDelta(Math.round(roas * 100), Math.round(roasPrev * 100)) : null}
          caption={`Cash collecté (${formatEuro(meta.cash)}) / dépense`}
          highlight
        />
      </StatGrid>
    </section>
  )
}

function TeamReportTable({ team, teamPrev }: { team: MemberReport[]; teamPrev: MemberReport[] | null }) {
  const prevById = new Map((teamPrev ?? []).map((m) => [m.user_id, m]))
  const rows = [...team].sort((a, b) => b.stats.deal_amount - a.stats.deal_amount || b.stats.closings - a.stats.closings)
  return (
    <TableCard title="Performance par membre" subtitle="Appels et closings attribués (assigned_to) sur la période">
      {rows.length === 0 ? (
        <EmptyState title="Aucun membre actif" />
      ) : (
        <table className="ds-table">
          <thead>
            <tr>
              <th>Membre</th>
              <th>Rôle</th>
              <th className="ds-num-cell">Appels</th>
              <th className="ds-num-cell">Joignabilité</th>
              <th className="ds-num-cell">RDV closing</th>
              <th className="ds-num-cell">No-shows</th>
              <th className="ds-num-cell">Closings</th>
              <th className="ds-num-cell">Taux closing</th>
              <th className="ds-num-cell">CA</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => {
              const p = prevById.get(m.user_id)
              return (
                <tr key={m.user_id}>
                  <td>
                    <div className="ds-contact">
                      <Avatar name={m.full_name} size={30} />
                      <div className="ds-contact-text">
                        <div className="ds-contact-name">{m.full_name}</div>
                        <div className="ds-muted">{m.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="stats-role-tag">{m.role}</span>
                  </td>
                  <td className="ds-num-cell">
                    <span className="ds-num">{formatNumber(m.stats.calls_total)}</span> <DeltaTag delta={p ? pctDelta(m.stats.calls_total, p.stats.calls_total) : null} />
                  </td>
                  <td className="ds-num-cell">
                    <span className="ds-num">{m.stats.calls_total > 0 ? `${m.stats.joignabilite} %` : '—'}</span>
                  </td>
                  <td className="ds-num-cell">
                    <span className="ds-num">{formatNumber(m.stats.rdv_booked)}</span>
                  </td>
                  <td className="ds-num-cell">
                    <span className="ds-num">{formatNumber(m.stats.no_shows)}</span>
                  </td>
                  <td className="ds-num-cell">
                    <span className="ds-num">{formatNumber(m.stats.closings)}</span> <DeltaTag delta={p ? pctDelta(m.stats.closings, p.stats.closings) : null} />
                  </td>
                  <td className="ds-num-cell">
                    <span className="ds-num">{m.stats.rdv_booked > 0 ? `${m.stats.closing_rate} %` : '—'}</span>
                  </td>
                  <td className="ds-num-cell">
                    <span className="ds-num">{formatEuro(m.stats.deal_amount)}</span> <DeltaTag delta={p ? pctDelta(m.stats.deal_amount, p.stats.deal_amount) : null} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </TableCard>
  )
}


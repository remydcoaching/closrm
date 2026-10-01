// Acquisition > Publicités — full parity with the web's
// src/app/(dashboard)/acquisition/publicites (publicites-client.tsx + tabs).
// Same endpoints: GET /api/meta/insights (account / campaign / adset / ad,
// preset or custom range, campaign_type filter, drill-down ids),
// GET /api/meta/ad-performance (CRM attribution per row),
// GET|PUT /api/ads-thresholds (health thresholds), GET /api/meta/ads/:id,
// GET /api/performance/follow-ads, GET /api/instagram/snapshots, GET /api/leads.
// Meta connection state is derived from the insights route's own errors
// (404 "Meta not connected" / 403 "needs_upgrade") — the web reads it
// server-side from the same integrations row.
import { useMemo, useState } from 'react'
import { useCachedQuery } from '../../lib/use-cached-query'
import { setCached } from '../../lib/query-cache'
import { openWeb } from '../../lib/web-link'
import { Tabs, Chips } from '../../design-system/Tabs'
import { Input } from '../../design-system/Input'
import { LoadingState } from '../../design-system/States'
import { OverviewTab } from './publicites/OverviewTab'
import { PerformanceTab } from './publicites/PerformanceTab'
import { AdsTable } from './publicites/AdsTable'
import { AdDrawer } from './publicites/AdDrawer'
import { ThresholdsModal } from './publicites/ThresholdsModal'
import { PERIOD_ITEMS, presetRange, type PeriodPreset } from './publicites/metrics'
import type {
  AdPerformanceResponse,
  AdPerformanceRow,
  CampaignTypeFilter,
  CrmLevel,
  InsightsLevel,
  MetaBreakdownRow,
  MetaInsightsResponse,
  ThresholdOverrides,
} from './publicites/types'
import './publicites/publicites.css'

type TabKey = 'overview' | 'performance' | 'campaigns' | 'adsets' | 'ads'
type Connection = 'unknown' | 'connected' | 'not_connected' | 'needs_upgrade'

interface DrillDown {
  campaignId?: string
  campaignName?: string
  adsetId?: string
  adsetName?: string
}

const TAB_ITEMS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: "Vue d'ensemble" },
  { key: 'performance', label: 'Performance' },
  { key: 'campaigns', label: 'Campagnes' },
  { key: 'adsets', label: 'Ad sets' },
  { key: 'ads', label: 'Ads' },
]

const TAB_TO_LEVEL: Record<TabKey, InsightsLevel> = {
  overview: 'account',
  performance: 'account',
  campaigns: 'campaign',
  adsets: 'adset',
  ads: 'ad',
}

const TYPE_ITEMS: { key: CampaignTypeFilter; label: string }[] = [
  { key: 'all', label: 'Tout' },
  { key: 'leadform', label: 'Leadform' },
  { key: 'follow_ads', label: 'Follow Ads' },
]

function errorText(message: string): string {
  if (message === 'Erreur inconnue') return 'Erreur réseau. Vérifiez votre connexion.'
  switch (message) {
    case 'token_expired':
      return 'Votre token Meta a expiré. Reconnectez votre compte.'
    case 'rate_limited':
      return 'Trop de requêtes vers Meta. Réessayez dans quelques minutes.'
    case 'meta_error':
      return 'Erreur Meta lors de la récupération des données.'
    default:
      return message || 'Erreur lors de la récupération des données'
  }
}

function PageHeader({ children }: { children?: React.ReactNode }) {
  return (
    <div className="pub-header">
      <div>
        <h1>Publicités</h1>
        <p>Performance de tes campagnes Meta Ads</p>
      </div>
      {children}
    </div>
  )
}

export function PublicitesPage() {
  const [tab, setTab] = useState<TabKey>('overview')
  const [drill, setDrill] = useState<DrillDown>({})
  const [campaignType, setCampaignType] = useState<CampaignTypeFilter>('all')
  const [period, setPeriod] = useState<PeriodPreset>('7d')
  const initialCustom = presetRange('7d')
  const [customFrom, setCustomFrom] = useState(initialCustom.dateFrom)
  const [customTo, setCustomTo] = useState(initialCustom.dateTo)
  const [applied, setApplied] = useState(initialCustom)

  const [thresholdsOpen, setThresholdsOpen] = useState(false)
  const [selectedAd, setSelectedAd] = useState<MetaBreakdownRow | null>(null)

  // Resolved date range + query fragment for the insights route.
  const { dateFrom, dateTo, periodQuery } = useMemo(() => {
    if (period === 'custom') {
      return { ...applied, periodQuery: `date_from=${applied.dateFrom}&date_to=${applied.dateTo}` }
    }
    return { ...presetRange(period), periodQuery: `preset=${period}` }
  }, [period, applied])

  // Every block reads the cache first (instant on revisit), Meta is re-read in the background.
  const thresholdsQuery = useCachedQuery<{ data: ThresholdOverrides }>('/api/ads-thresholds', { screen: 'PublicitesThresholds', staleMs: 10 * 60_000 })
  const thresholds = thresholdsQuery.data?.data ?? {}

  const insightsKey = useMemo(() => {
    const params = new URLSearchParams(periodQuery)
    params.set('level', TAB_TO_LEVEL[tab])
    if (drill.campaignId && (tab === 'adsets' || tab === 'ads')) params.set('campaign_id', drill.campaignId)
    if (drill.adsetId && tab === 'ads') params.set('adset_id', drill.adsetId)
    params.set('campaign_type', campaignType)
    return `/api/meta/insights?${params.toString()}`
  }, [periodQuery, tab, drill, campaignType])
  const insightsQuery = useCachedQuery<MetaInsightsResponse>(insightsKey, { screen: 'Publicites', staleMs: 5 * 60_000 })
  const data = insightsQuery.data ?? null
  const loading = insightsQuery.loading
  const fetchInsights = insightsQuery.refresh
  const connection: Connection =
    insightsQuery.error === 'Meta not connected' ? 'not_connected' : insightsQuery.error === 'needs_upgrade' ? 'needs_upgrade' : data || insightsQuery.error ? 'connected' : 'unknown'
  const error = connection === 'connected' && insightsQuery.error ? errorText(insightsQuery.error) : null

  // CRM attribution for table tabs (same params as the web's fetchCrm).
  const level: CrmLevel | null = tab === 'campaigns' ? 'campaign' : tab === 'adsets' ? 'adset' : tab === 'ads' ? 'ad' : null
  const crmKey = useMemo(() => {
    if (connection !== 'connected' || !level) return null
    const params = new URLSearchParams({ level, date_from: dateFrom, date_to: dateTo })
    if (drill.campaignId && (tab === 'adsets' || tab === 'ads')) params.set('campaign_id', drill.campaignId)
    if (drill.adsetId && tab === 'ads') params.set('adset_id', drill.adsetId)
    return `/api/meta/ad-performance?${params.toString()}`
  }, [connection, level, tab, dateFrom, dateTo, drill])
  // Non-critical: on error the CRM columns fall back to 0 / —.
  const crmQuery = useCachedQuery<AdPerformanceResponse>(crmKey, { screen: 'PublicitesCrm', staleMs: 5 * 60_000 })
  const crmMap = useMemo(() => (crmQuery.data ? new Map<string, AdPerformanceRow>((crmQuery.data.data ?? []).map((r) => [r.id, r])) : undefined), [crmQuery.data])

  function handleTabChange(next: TabKey) {
    if (next === 'campaigns') setDrill({})
    else if (next === 'adsets') setDrill((d) => ({ campaignId: d.campaignId, campaignName: d.campaignName }))
    setTab(next)
  }

  function handleRowClick(row: MetaBreakdownRow) {
    if (tab === 'campaigns') {
      setDrill({ campaignId: row.id, campaignName: row.name })
      setTab('adsets')
    } else if (tab === 'adsets') {
      setDrill((d) => ({ ...d, adsetId: row.id, adsetName: row.name }))
      setTab('ads')
    } else if (tab === 'ads') {
      setSelectedAd(row)
    }
  }

  if (connection === 'unknown' && loading) {
    return (
      <div className="pub-page">
        <PageHeader />
        <LoadingState label="Connexion à Meta Ads…" />
      </div>
    )
  }

  if (connection === 'not_connected' || connection === 'needs_upgrade') {
    const upgrade = connection === 'needs_upgrade'
    return (
      <div className="pub-page">
        <PageHeader />
        <div className={`pub-banner ${upgrade ? 'pub-banner--warning' : 'pub-banner--info'}`}>
          <div>
            <p className="pub-banner-title">{upgrade ? 'Mets à jour ta connexion Meta' : 'Connecte ton compte Meta'}</p>
            <p className="pub-banner-text">
              {upgrade
                ? "De nouvelles permissions sont nécessaires pour accéder aux statistiques publicitaires. Tes leads continuent d'arriver normalement."
                : 'Relie ton compte publicitaire pour voir tes performances Facebook & Instagram Ads en temps réel.'}
            </p>
          </div>
          <div className="pub-controls">
            <button type="button" className="ds-pill-button" onClick={() => void fetchInsights()}>
              Revérifier
            </button>
            <button
              type="button"
              className="ds-pill-button ds-pill-button--dark"
              onClick={() => void openWeb(upgrade ? '/api/integrations/meta' : '/parametres/integrations')}
            >
              {upgrade ? 'Mettre à jour →' : 'Connecter Meta →'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  const rangeLabel = `Du ${dateFrom} au ${dateTo}`

  return (
    <div className="pub-page">
      <PageHeader>
        <div className="pub-controls">
          <Chips items={TYPE_ITEMS} active={campaignType} onChange={setCampaignType} />
          <button type="button" className="ds-pill-button" title="Configurer les seuils vert / orange / rouge des KPIs" onClick={() => setThresholdsOpen(true)}>
            Seuils
          </button>
        </div>
      </PageHeader>

      <div className="pub-header">
        <Tabs items={TAB_ITEMS} active={tab} onChange={handleTabChange} />
        <div className="pub-controls">
          <Chips items={PERIOD_ITEMS} active={period} onChange={setPeriod} />
          {period === 'custom' ? (
            <div className="pub-custom-range">
              Du
              <Input type="date" value={customFrom} max={customTo} onChange={(e) => setCustomFrom(e.target.value)} />
              au
              <Input type="date" value={customTo} min={customFrom} onChange={(e) => setCustomTo(e.target.value)} />
              <button
                type="button"
                className="ds-pill-button ds-pill-button--dark"
                disabled={!customFrom || !customTo || customFrom > customTo}
                onClick={() => setApplied({ dateFrom: customFrom, dateTo: customTo })}
              >
                OK
              </button>
            </div>
          ) : (
            <span className="pub-range-label">{rangeLabel}</span>
          )}
        </div>
      </div>

      {(drill.campaignName || drill.adsetName) && (tab === 'adsets' || tab === 'ads') && (
        <nav className="pub-breadcrumb" aria-label="Fil d'Ariane">
          <button type="button" onClick={() => handleTabChange('campaigns')}>
            Campagnes
          </button>
          {drill.campaignName && (
            <>
              <span>›</span>
              {tab === 'ads' && drill.adsetName ? (
                <button type="button" onClick={() => handleTabChange('adsets')}>
                  {drill.campaignName}
                </button>
              ) : (
                <strong>{drill.campaignName}</strong>
              )}
            </>
          )}
          {drill.adsetName && tab === 'ads' && (
            <>
              <span>›</span>
              <strong>{drill.adsetName}</strong>
            </>
          )}
        </nav>
      )}

      {error ? (
        <div className="pub-banner pub-banner--danger">
          <div>
            <p className="pub-banner-title">Erreur de connexion Meta</p>
            <p className="pub-banner-text">{error}</p>
          </div>
          <button type="button" className="ds-pill-button ds-pill-button--dark" onClick={() => void fetchInsights()}>
            Réessayer
          </button>
        </div>
      ) : tab === 'overview' ? (
        <OverviewTab
          data={data}
          loading={loading}
          campaignType={campaignType}
          dateFrom={dateFrom}
          dateTo={dateTo}
          periodQuery={periodQuery}
          thresholds={thresholds}
        />
      ) : tab === 'performance' ? (
        <PerformanceTab data={data} loading={loading} campaignType={campaignType} dateFrom={dateFrom} dateTo={dateTo} periodQuery={periodQuery} />
      ) : (
        level && (
          <AdsTable
            tabKey={tab}
            rows={data?.breakdown ?? null}
            loading={loading}
            crmMap={crmMap}
            thresholds={thresholds}
            subtitle={`${rangeLabel}${tab === 'ads' ? ' · clic = créative et leads' : ' · clic = détail'}`}
            onRowClick={handleRowClick}
          />
        )
      )}

      {thresholdsOpen && <ThresholdsModal onClose={() => setThresholdsOpen(false)} onSaved={(t) => setCached('/api/ads-thresholds', { data: t })} />}
      {selectedAd && <AdDrawer ad={selectedAd} onClose={() => setSelectedAd(null)} />}
    </div>
  )
}

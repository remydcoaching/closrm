'use client'

import { useState, useEffect, useCallback } from 'react'
import type { MetaConnectionState } from './page'
import type { MetaInsightsResponse } from '@/app/api/meta/insights/route'
import AdsMetaBanner from './ads-meta-banner'
import AdsPeriodSelector, { type PeriodPreset } from './ads-period-selector'
import AdsOverviewTab from './ads-overview-tab'
import AdsTableTab from './ads-table-tab'
import AdsCampaignTypeToggle, { type CampaignTypeFilter } from './ads-campaign-type-toggle'

type TabKey = 'overview' | 'campaigns' | 'adsets' | 'ads'

interface PublicitesClientProps {
  connectionState: MetaConnectionState
}

// Drill-down context: which campaign/adset is selected
interface DrillDown {
  campaignId?: string
  campaignName?: string
  adsetId?: string
  adsetName?: string
}

const TAB_TO_LEVEL: Record<TabKey, string> = {
  overview: 'account',
  campaigns: 'campaign',
  adsets: 'adset',
  ads: 'ad',
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function getDefaultDates(): { dateFrom: string; dateTo: string } {
  const now = new Date()
  const from = new Date()
  from.setDate(from.getDate() - 7)
  return { dateFrom: formatDate(from), dateTo: formatDate(now) }
}

export default function PublicitesClient({ connectionState }: PublicitesClientProps) {
  const [tab, setTab] = useState<TabKey>('overview')
  const [drillDown, setDrillDown] = useState<DrillDown>({})
  const [campaignType, setCampaignType] = useState<CampaignTypeFilter>('all')
  const [period, setPeriod] = useState<PeriodPreset>('7d')
  const [dateFrom, setDateFrom] = useState(getDefaultDates().dateFrom)
  const [dateTo, setDateTo] = useState(getDefaultDates().dateTo)
  const [data, setData] = useState<MetaInsightsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [closedCount, setClosedCount] = useState(0)
  const [closedRevenue] = useState(0)

  const fetchInsights = useCallback(async () => {
    if (connectionState !== 'connected') return

    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        level: TAB_TO_LEVEL[tab],
      })

      if (period === 'custom') {
        params.set('date_from', dateFrom)
        params.set('date_to', dateTo)
      } else {
        params.set('preset', period)
      }

      // Drill-down filters
      if (drillDown.campaignId && (tab === 'adsets' || tab === 'ads')) {
        params.set('campaign_id', drillDown.campaignId)
      }
      if (drillDown.adsetId && tab === 'ads') {
        params.set('adset_id', drillDown.adsetId)
      }

      // Campaign type filter
      params.set('campaign_type', campaignType)

      const res = await fetch(`/api/meta/insights?${params.toString()}`)

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        if (body.error === 'needs_upgrade') {
          setError('needs_upgrade')
        } else if (body.error === 'token_expired') {
          setError('Votre token Meta a expiré. Reconnectez votre compte.')
        } else if (body.error === 'rate_limited') {
          setError('Trop de requêtes vers Meta. Réessayez dans quelques minutes.')
        } else {
          setError(body.message ?? 'Erreur lors de la récupération des données')
        }
        setData(null)
        return
      }

      const json: MetaInsightsResponse = await res.json()
      setData(json)
    } catch {
      setError('Erreur réseau. Vérifiez votre connexion.')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [connectionState, tab, period, dateFrom, dateTo, drillDown, campaignType])

  const fetchClosedCount = useCallback(async () => {
    if (connectionState !== 'connected') return
    try {
      const params = new URLSearchParams({
        status: 'clos',
        source: 'facebook_ads,instagram_ads',
        page: '1',
        per_page: '1',
      })
      const res = await fetch(`/api/leads?${params.toString()}`)
      if (res.ok) {
        const json = await res.json()
        setClosedCount(json.total ?? 0)
      }
    } catch { /* non-critical */ }
  }, [connectionState])

  useEffect(() => { Promise.all([fetchInsights(), fetchClosedCount()]) }, [fetchInsights, fetchClosedCount])

  function handlePeriodChange(preset: PeriodPreset, customFrom?: string, customTo?: string) {
    setPeriod(preset)
    if (preset === 'custom' && customFrom && customTo) {
      setDateFrom(customFrom)
      setDateTo(customTo)
    }
  }

  // Navigation helpers
  function handleTabChange(newTab: TabKey) {
    // When manually clicking a tab, reset drill-down for that level
    if (newTab === 'campaigns') {
      setDrillDown({})
    } else if (newTab === 'adsets') {
      setDrillDown(prev => ({ campaignId: prev.campaignId, campaignName: prev.campaignName }))
    }
    setTab(newTab)
  }

  function handleDrillIntoCampaign(campaignId: string, campaignName: string) {
    setDrillDown({ campaignId, campaignName })
    setTab('adsets')
  }

  function handleDrillIntoAdset(adsetId: string, adsetName: string) {
    setDrillDown(prev => ({ ...prev, adsetId, adsetName }))
    setTab('ads')
  }

  // Breadcrumb navigation
  function navigateToCampaigns() {
    setDrillDown({})
    setTab('campaigns')
  }

  function navigateToAdsets() {
    setDrillDown(prev => ({ campaignId: prev.campaignId, campaignName: prev.campaignName }))
    setTab('adsets')
  }

  // Get tab label with context
  function getTabLabel(key: TabKey): string {
    if (key === 'adsets' && drillDown.campaignName) return `Ad Sets`
    if (key === 'ads' && drillDown.adsetName) return `Ads`
    return { overview: "Vue d'ensemble", campaigns: 'Campagnes', adsets: 'Ad Sets', ads: 'Ads' }[key]
  }

  // Banner states
  if (connectionState === 'not_connected') {
    return (
      <div style={{ padding: 32 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>Publicités</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>Performance de tes campagnes Meta Ads</p>
        <AdsMetaBanner state="not_connected" />
      </div>
    )
  }

  if (connectionState === 'needs_upgrade') {
    return (
      <div style={{ padding: 32 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>Publicités</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>Performance de tes campagnes Meta Ads</p>
        <AdsMetaBanner state="needs_upgrade" />
      </div>
    )
  }

  const tabs: TabKey[] = ['overview', 'campaigns', 'adsets', 'ads']

  return (
    <div style={{ padding: 32 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>Publicités</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Performance de tes campagnes Meta Ads</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <AdsCampaignTypeToggle value={campaignType} onChange={setCampaignType} />
          <AdsPeriodSelector
            value={period}
            dateFrom={dateFrom}
            dateTo={dateTo}
            onChange={handlePeriodChange}
          />
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: 0,
        borderBottom: '1px solid var(--border-primary)',
        marginBottom: 12,
      }}>
        {tabs.map(t => (
          <button
            key={t}
            onClick={() => handleTabChange(t)}
            style={{
              padding: '10px 20px',
              fontSize: 13,
              fontWeight: tab === t ? 600 : 400,
              color: tab === t ? '#1877F2' : 'var(--text-muted)',
              background: 'transparent',
              border: 'none',
              borderBottom: tab === t ? '2px solid #1877F2' : '2px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {getTabLabel(t)}
          </button>
        ))}
      </div>

      {/* Breadcrumbs for drill-down */}
      {(drillDown.campaignName || drillDown.adsetName) && tab !== 'overview' && tab !== 'campaigns' && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 14,
          fontSize: 12,
        }}>
          <button
            onClick={navigateToCampaigns}
            style={{
              background: 'none',
              border: 'none',
              color: '#1877F2',
              cursor: 'pointer',
              fontSize: 12,
              padding: 0,
            }}
          >
            Campagnes
          </button>
          {drillDown.campaignName && (
            <>
              <span style={{ color: 'var(--text-muted)' }}>›</span>
              {tab === 'ads' && drillDown.adsetName ? (
                <button
                  onClick={navigateToAdsets}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#1877F2',
                    cursor: 'pointer',
                    fontSize: 12,
                    padding: 0,
                  }}
                >
                  {drillDown.campaignName}
                </button>
              ) : (
                <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                  {drillDown.campaignName}
                </span>
              )}
            </>
          )}
          {drillDown.adsetName && tab === 'ads' && (
            <>
              <span style={{ color: 'var(--text-muted)' }}>›</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                {drillDown.adsetName}
              </span>
            </>
          )}
        </div>
      )}

      {/* Error state */}
      {error && (
        <div style={{ marginBottom: 16 }}>
          <AdsMetaBanner state="error" errorMessage={error} onRetry={fetchInsights} />
        </div>
      )}

      {/* Tab content */}
      {!error && tab === 'overview' && (
        <AdsOverviewTab
          data={data}
          closedCount={closedCount}
          closedRevenue={closedRevenue}
          loading={loading}
          campaignType={campaignType}
          dateFrom={dateFrom}
          dateTo={dateTo}
        />
      )}
      {!error && tab !== 'overview' && (
        <AdsTableTab
          data={data}
          loading={loading}
          tabKey={tab}
          campaignType={campaignType}
          onRowClick={
            tab === 'campaigns'
              ? (id, name) => handleDrillIntoCampaign(id, name)
              : tab === 'adsets'
              ? (id, name) => handleDrillIntoAdset(id, name)
              : undefined
          }
        />
      )}
    </div>
  )
}

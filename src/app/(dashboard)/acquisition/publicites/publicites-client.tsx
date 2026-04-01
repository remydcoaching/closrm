'use client'

import { useState, useEffect, useCallback } from 'react'
import type { MetaConnectionState } from './page'
import type { MetaInsightsResponse } from '@/app/api/meta/insights/route'
import AdsMetaBanner from './ads-meta-banner'
import AdsPeriodSelector, { type PeriodPreset } from './ads-period-selector'
import AdsOverviewTab from './ads-overview-tab'
import AdsTableTab from './ads-table-tab'

type TabKey = 'overview' | 'campaigns' | 'adsets' | 'ads'

interface PublicitesClientProps {
  connectionState: MetaConnectionState
}

const TAB_LABELS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: "Vue d'ensemble" },
  { key: 'campaigns', label: 'Campagnes' },
  { key: 'adsets', label: 'Ad Sets' },
  { key: 'ads', label: 'Ads' },
]

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
  const [period, setPeriod] = useState<PeriodPreset>('7d')
  const [dateFrom, setDateFrom] = useState(getDefaultDates().dateFrom)
  const [dateTo, setDateTo] = useState(getDefaultDates().dateTo)
  const [data, setData] = useState<MetaInsightsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [closedCount, setClosedCount] = useState(0)
  const [closedRevenue] = useState(0) // V1: no revenue tracking yet

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
  }, [connectionState, tab, period, dateFrom, dateTo])

  // Fetch closed leads count from Supabase for the funnel
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
    } catch {
      // Non-critical, funnel will show 0
    }
  }, [connectionState])

  useEffect(() => {
    fetchInsights()
  }, [fetchInsights])

  useEffect(() => {
    fetchClosedCount()
  }, [fetchClosedCount])

  function handlePeriodChange(preset: PeriodPreset, customFrom?: string, customTo?: string) {
    setPeriod(preset)
    if (preset === 'custom' && customFrom && customTo) {
      setDateFrom(customFrom)
      setDateTo(customTo)
    }
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

  return (
    <div style={{ padding: 32 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>Publicités</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Performance de tes campagnes Meta Ads</p>
        </div>
        <AdsPeriodSelector
          value={period}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onChange={handlePeriodChange}
        />
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: 0,
        borderBottom: '1px solid var(--border-primary)',
        marginBottom: 20,
      }}>
        {TAB_LABELS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '10px 20px',
              fontSize: 13,
              fontWeight: tab === t.key ? 600 : 400,
              color: tab === t.key ? '#1877F2' : 'var(--text-muted)',
              background: 'transparent',
              border: 'none',
              borderBottom: tab === t.key ? '2px solid #1877F2' : '2px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

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
        />
      )}
      {!error && tab !== 'overview' && (
        <AdsTableTab data={data} loading={loading} />
      )}
    </div>
  )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import type { MetaInsightsResponse } from '@/app/api/meta/insights/route'
import type { FunnelData, PerformanceInsight } from './performance/insights-engine'
import { generateInsights } from './performance/insights-engine'
import OverviewMetrics from './performance/overview-metrics'
import FunnelColumn from './performance/funnel-column'
import CostAnalysis from './performance/cost-analysis'
import InsightCard from './performance/insight-card'

interface Props {
  data: MetaInsightsResponse | null
  loading: boolean
  campaignType: string
  dateFrom: string
  dateTo: string
  closedCount?: number
}

interface FollowAdsApiResponse {
  data: {
    funnel: FunnelData
    previous_period: FunnelData
  }
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────

function PerformanceSkeleton() {
  const pulseStyle: React.CSSProperties = {
    background: 'var(--bg-elevated, #141414)',
    border: '1px solid var(--border-primary, #262626)',
    borderRadius: 12,
    animation: 'perfPulse 1.5s ease-in-out infinite',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <style>{`@keyframes perfPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>

      {/* Metrics row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ ...pulseStyle, height: 110 }} />
        ))}
      </div>

      {/* Funnel + Cost */}
      <div style={{ display: 'grid', gridTemplateColumns: '45fr 55fr', gap: 20 }}>
        <div style={{ ...pulseStyle, height: 500 }} />
        <div style={{ ...pulseStyle, height: 500 }} />
      </div>

      {/* Insights */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{ ...pulseStyle, height: 260 }} />
        ))}
      </div>
    </div>
  )
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function computeConversionRate(visits: number, followers: number): number {
  if (visits === 0) return 0
  return Math.round((followers / visits) * 10000) / 100
}

// ─── Main ──────────────────────────────────────────────────────────────────────

export default function AdsPerformanceTab({
  data,
  loading,
  dateFrom,
  dateTo,
}: Props) {
  const [funnel, setFunnel] = useState<FunnelData | null>(null)
  const [previousFunnel, setPreviousFunnel] = useState<FunnelData | null>(null)
  const [insights, setInsights] = useState<PerformanceInsight[]>([])
  const [funnelLoading, setFunnelLoading] = useState(true)

  const fetchFollowAdsData = useCallback(async () => {
    setFunnelLoading(true)
    try {
      const params = new URLSearchParams({
        date_from: dateFrom,
        date_to: dateTo,
      })
      const res = await fetch(`/api/performance/follow-ads?${params.toString()}`)
      if (!res.ok) {
        setFunnel(null)
        setPreviousFunnel(null)
        return
      }
      const json: FollowAdsApiResponse = await res.json()
      setFunnel(json.data.funnel)
      setPreviousFunnel(json.data.previous_period)

      // Generate insights
      const adSpend = data?.kpis?.spend ?? 0
      const generated = generateInsights(
        json.data.funnel,
        json.data.previous_period,
        adSpend,
      )
      setInsights(generated)
    } catch {
      setFunnel(null)
      setPreviousFunnel(null)
    } finally {
      setFunnelLoading(false)
    }
  }, [dateFrom, dateTo, data])

  useEffect(() => {
    fetchFollowAdsData()
  }, [fetchFollowAdsData])

  if (loading || funnelLoading) {
    return <PerformanceSkeleton />
  }

  const adSpend = data?.kpis?.spend ?? 0
  const adSpendPrev = 0 // We only have current period Meta data

  const currentFollowers = funnel?.followers ?? 0
  const prevFollowers = previousFunnel?.followers ?? 0
  const currentVisits = funnel?.profile_visits ?? 0
  const prevVisits = previousFunnel?.profile_visits ?? 0

  const conversionRate = computeConversionRate(currentVisits, currentFollowers)
  const conversionRatePrev = computeConversionRate(prevVisits, prevFollowers)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Overview Metrics */}
      <OverviewMetrics
        followers={currentFollowers}
        followersPrev={prevFollowers}
        conversionRate={conversionRate}
        conversionRatePrev={conversionRatePrev}
        adSpend={adSpend}
        adSpendPrev={adSpendPrev}
      />

      {/* Funnel + Cost Analysis */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '45fr 55fr',
        gap: 20,
        alignItems: 'start',
      }}>
        {funnel && (
          <FunnelColumn
            funnel={funnel}
            adSpend={adSpend}
          />
        )}
        <CostAnalysis
          adSpend={adSpend}
          followers={currentFollowers}
          followersPrev={prevFollowers}
          appointments={funnel?.appointments ?? 0}
          appointmentsPrev={previousFunnel?.appointments ?? 0}
          adSpendPrev={adSpendPrev}
          breakdown={data?.breakdown?.map(b => ({
            campaign_type: b.name,
            spend: b.spend,
            clicks: b.clicks,
            impressions: b.impressions,
          }))}
          profileVisits={currentVisits}
          conversations={funnel?.conversations ?? 0}
        />
      </div>

      {/* Performance Insights */}
      {insights.length > 0 && (
        <div>
          <div style={{ marginBottom: 20 }}>
            <div style={{
              fontSize: 18,
              fontWeight: 800,
              color: 'var(--text-primary, #FFFFFF)',
              marginBottom: 4,
            }}>
              Indicateurs de performance
            </div>
            <div style={{
              fontSize: 13,
              color: 'var(--text-muted, #666)',
            }}>
              Recommandations basees sur vos donnees pour maximiser vos resultats
            </div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 16,
          }}>
            {insights.map((insight) => (
              <InsightCard key={insight.id} {...insight} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

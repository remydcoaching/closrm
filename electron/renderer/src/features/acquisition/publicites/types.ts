// Mirrors the response shapes of the EXISTING web routes used by the
// Publicités page (src/app/api/meta/insights, /api/meta/ad-performance,
// /api/meta/ads/[adId], /api/performance/follow-ads, /api/instagram/snapshots,
// /api/ads-thresholds). Copied, not imported cross-package — keep in sync.

export type CampaignType = 'leadform' | 'follow_ads' | 'other'
export type CampaignTypeFilter = CampaignType | 'all'
export type InsightsLevel = 'account' | 'campaign' | 'adset' | 'ad'
export type CrmLevel = 'campaign' | 'adset' | 'ad'

/** KpisData in src/app/api/meta/insights/route.ts */
export interface MetaKpis {
  spend: number
  impressions: number
  clicks: number
  ctr: number
  leads: number
  cpl: number | null
  frequency: number
  video_plays: number
  video_p25: number
  video_p50: number
  video_p75: number
  hook_rate: number
  hold_rate_25: number
  hold_rate_50: number
  hold_rate_75: number
}

/** BreakdownRow in src/app/api/meta/insights/route.ts */
export interface MetaBreakdownRow extends MetaKpis {
  id: string
  name: string
  status: string
  campaign_type: CampaignType
}

export interface MetaDailyRow {
  date: string
  spend: number
  leads: number
  impressions: number
  clicks: number
}

export interface MetaInsightsResponse {
  kpis: MetaKpis
  breakdown: MetaBreakdownRow[]
  daily: MetaDailyRow[]
  campaignTypeFilter: CampaignTypeFilter
  leadformKpis?: MetaKpis
  followAdsKpis?: MetaKpis
  leadformDaily?: MetaDailyRow[]
  followAdsDaily?: MetaDailyRow[]
}

/** AdPerformanceRow in src/app/api/meta/ad-performance/route.ts */
export interface AdPerformanceRow {
  id: string
  name: string
  status: string
  spend: number
  impressions: number
  clicks: number
  meta_leads: number
  lead_count: number
  qualified_count: number
  closed_count: number
  calls_count: number
  calls_reached: number
  bookings_total: number
  bookings_show_up: number
  revenue: number
  cash_collected: number
  cpl: number | null
  cpl_qualified: number | null
  roas: number | null
}

export interface AdPerformanceResponse {
  data: AdPerformanceRow[]
  meta?: { level: CrmLevel; date_from: string; date_to: string }
}

/** MetaAdCreative in src/lib/meta/client.ts */
export interface MetaAdCreative {
  id: string
  name: string
  image_url: string | null
  video_url: string | null
  thumbnail_url: string | null
  body: string | null
  title: string | null
  link_url: string | null
}

export interface AdDetailResponse {
  data: {
    id: string
    name: string
    creative: MetaAdCreative | null
    kpis: { spend: number; impressions: number; clicks: number; ctr: number; leads: number; cpl: number | null }
  }
}

/** FunnelData in src/app/(dashboard)/acquisition/publicites/performance/insights-engine.ts */
export interface FunnelData {
  profile_visits: number
  followers: number
  followers_total: number
  qualified_followers: number
  conversations: number
  appointments: number
  show_ups: number
  cash_collected: number | null
}

export interface FollowAdsResponse {
  data: { funnel: FunnelData; previous_period: FunnelData }
}

export interface IgSnapshot {
  snapshot_date: string
  followers: number
  views: number
  reach: number
}

export type ThresholdOverrides = Record<string, { green?: number; orange?: number; red?: number }>

/** GET /api/leads meta block. */
export interface LeadsCountResponse {
  data: unknown[]
  meta: { total: number; page: number; per_page: number; total_pages: number }
}

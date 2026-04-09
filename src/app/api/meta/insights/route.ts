import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { decrypt } from '@/lib/meta/encryption'
import {
  getInsights,
  listAdObjects,
  extractLeadCount,
  extractCostPerLead,
  extractVideoPlays,
  extractVideoP25,
  extractVideoP50,
  extractVideoP75,
  type MetaCredentials,
  type InsightsParams,
  type MetaInsightRow,
} from '@/lib/meta/client'
import {
  classifyCampaignObjective,
  type CampaignType,
} from '@/app/(dashboard)/acquisition/publicites/health-thresholds'

interface KpisData {
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

interface BreakdownRow {
  id: string
  name: string
  status: string
  campaign_type: CampaignType
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

interface DailyRow {
  date: string
  spend: number
  leads: number
  impressions: number
  clicks: number
}

export interface MetaInsightsResponse {
  kpis: KpisData
  breakdown: BreakdownRow[]
  daily: DailyRow[]
  campaignTypeFilter: CampaignType | 'all'
  // Per-type aggregated data (only populated at account level when filter='all')
  leadformKpis?: KpisData
  followAdsKpis?: KpisData
  leadformDaily?: DailyRow[]
  followAdsDaily?: DailyRow[]
}

// ─── Aggregation helpers ────────────────────────────────────────────────────

function aggregateKpis(rows: MetaInsightRow[]): KpisData {
  let spend = 0, impressions = 0, clicks = 0, leads = 0
  let videoPlays = 0, videoP25 = 0, videoP50 = 0, videoP75 = 0
  let frequencySum = 0, frequencyCount = 0
  for (const row of rows) {
    spend += parseFloat(row.spend || '0')
    impressions += parseInt(row.impressions || '0', 10)
    clicks += parseInt(row.clicks || '0', 10)
    leads += extractLeadCount(row)
    videoPlays += extractVideoPlays(row)
    videoP25 += extractVideoP25(row)
    videoP50 += extractVideoP50(row)
    videoP75 += extractVideoP75(row)
    const freq = parseFloat(row.frequency || '0')
    if (freq > 0) {
      frequencySum += freq
      frequencyCount++
    }
  }
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0
  const frequency = frequencyCount > 0 ? frequencySum / frequencyCount : 0
  return {
    spend: Math.round(spend * 100) / 100,
    impressions,
    clicks,
    ctr: Math.round(ctr * 100) / 100,
    leads,
    cpl: leads > 0 ? Math.round((spend / leads) * 100) / 100 : null,
    frequency: Math.round(frequency * 100) / 100,
    video_plays: videoPlays,
    video_p25: videoP25,
    video_p50: videoP50,
    video_p75: videoP75,
    hook_rate: impressions > 0 ? Math.round((videoPlays / impressions) * 100 * 100) / 100 : 0,
    hold_rate_25: videoPlays > 0 ? Math.round((videoP25 / videoPlays) * 100 * 100) / 100 : 0,
    hold_rate_50: videoPlays > 0 ? Math.round((videoP50 / videoPlays) * 100 * 100) / 100 : 0,
    hold_rate_75: videoPlays > 0 ? Math.round((videoP75 / videoPlays) * 100 * 100) / 100 : 0,
  }
}

function aggregateDaily(rows: MetaInsightRow[]): DailyRow[] {
  const daily: DailyRow[] = []
  for (const row of rows) {
    daily.push({
      date: row.date_start,
      spend: parseFloat(row.spend || '0'),
      leads: extractLeadCount(row),
      impressions: parseInt(row.impressions || '0', 10),
      clicks: parseInt(row.clicks || '0', 10),
    })
  }
  return daily.sort((a, b) => a.date.localeCompare(b.date))
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function getDefaultDateRange(preset: string): { dateFrom: string; dateTo: string } {
  const now = new Date()
  const dateTo = formatDate(now)

  const daysMap: Record<string, number> = {
    today: 0,
    '7d': 7,
    '14d': 14,
    '30d': 30,
    '90d': 90,
  }

  const days = daysMap[preset]
  if (days === undefined) {
    // Default 7d
    const from = new Date()
    from.setDate(from.getDate() - 7)
    return { dateFrom: formatDate(from), dateTo }
  }

  if (days === 0) {
    return { dateFrom: dateTo, dateTo }
  }

  const from = new Date()
  from.setDate(from.getDate() - days)
  return { dateFrom: formatDate(from), dateTo }
}

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    // Parse query params
    const searchParams = request.nextUrl.searchParams
    const level = (searchParams.get('level') ?? 'account') as InsightsParams['level']
    const preset = searchParams.get('preset') ?? '7d'
    const customFrom = searchParams.get('date_from')
    const customTo = searchParams.get('date_to')
    const campaignId = searchParams.get('campaign_id')
    const adsetId = searchParams.get('adset_id')
    const campaignTypeFilter = (searchParams.get('campaign_type') ?? 'all') as CampaignType | 'all'

    // Validate level
    if (!['account', 'campaign', 'adset', 'ad'].includes(level)) {
      return NextResponse.json({ error: 'Invalid level parameter' }, { status: 400 })
    }

    // Date range
    const { dateFrom, dateTo } = customFrom && customTo
      ? { dateFrom: customFrom, dateTo: customTo }
      : getDefaultDateRange(preset)

    // Fetch Meta integration
    const { data: integration } = await supabase
      .from('integrations')
      .select('credentials_encrypted, is_active')
      .eq('workspace_id', workspaceId)
      .eq('type', 'meta')
      .eq('is_active', true)
      .maybeSingle()

    if (!integration?.credentials_encrypted) {
      return NextResponse.json({ error: 'Meta not connected' }, { status: 404 })
    }

    // Decrypt credentials
    const credentials: MetaCredentials = JSON.parse(
      decrypt(integration.credentials_encrypted)
    )

    if (!credentials.ad_account_id) {
      return NextResponse.json(
        { error: 'needs_upgrade', message: 'Reconnectez Meta pour accéder aux publicités' },
        { status: 403 }
      )
    }

    // ── ACCOUNT LEVEL ──────────────────────────────────────────────────────
    if (level === 'account') {
      // For non-'all' filters or 'all', we always need the campaign type map
      // to know which campaigns belong to which type.
      const campaigns = await listAdObjects(
        credentials.ad_account_id,
        credentials.user_access_token,
        'campaign'
      )

      const leadformIds: string[] = []
      const followAdsIds: string[] = []
      for (const c of campaigns) {
        const type = classifyCampaignObjective(c.objective)
        if (type === 'leadform') leadformIds.push(c.id)
        else if (type === 'follow_ads') followAdsIds.push(c.id)
      }

      // Determine which campaign IDs to fetch insights for based on filter
      let mainCampaignIds: string[] | undefined
      if (campaignTypeFilter === 'leadform') mainCampaignIds = leadformIds
      else if (campaignTypeFilter === 'follow_ads') mainCampaignIds = followAdsIds
      // 'all' → undefined (no filter, all campaigns)

      // If filter is set but no campaigns match, return empty response
      if (mainCampaignIds && mainCampaignIds.length === 0) {
        return NextResponse.json({
          kpis: { spend: 0, impressions: 0, clicks: 0, ctr: 0, leads: 0, cpl: null, frequency: 0, video_plays: 0, video_p25: 0, video_p50: 0, video_p75: 0, hook_rate: 0, hold_rate_25: 0, hold_rate_50: 0, hold_rate_75: 0 },
          breakdown: [],
          daily: [],
          campaignTypeFilter,
        } satisfies MetaInsightsResponse)
      }

      // Fetch main insights
      const mainRows = await getInsights(credentials.ad_account_id, credentials.user_access_token, {
        level: 'account',
        dateFrom,
        dateTo,
        campaignIds: mainCampaignIds,
      })

      const response: MetaInsightsResponse = {
        kpis: aggregateKpis(mainRows),
        breakdown: [],
        daily: aggregateDaily(mainRows),
        campaignTypeFilter,
      }

      // For 'all' filter, also fetch per-type aggregates so the dual-section
      // overview can render both Leadform and Follow Ads separately.
      if (campaignTypeFilter === 'all') {
        const [leadformRows, followAdsRows] = await Promise.all([
          leadformIds.length > 0
            ? getInsights(credentials.ad_account_id, credentials.user_access_token, {
                level: 'account', dateFrom, dateTo, campaignIds: leadformIds,
              })
            : Promise.resolve([]),
          followAdsIds.length > 0
            ? getInsights(credentials.ad_account_id, credentials.user_access_token, {
                level: 'account', dateFrom, dateTo, campaignIds: followAdsIds,
              })
            : Promise.resolve([]),
        ])
        response.leadformKpis = aggregateKpis(leadformRows)
        response.followAdsKpis = aggregateKpis(followAdsRows)
        response.leadformDaily = aggregateDaily(leadformRows)
        response.followAdsDaily = aggregateDaily(followAdsRows)
      }

      return NextResponse.json(response)
    }

    // ── CAMPAIGN / ADSET / AD LEVEL ─────────────────────────────────────────
    // Build campaign type map for classification (needed for all non-account levels)
    const campaignsForMap = await listAdObjects(
      credentials.ad_account_id,
      credentials.user_access_token,
      'campaign'
    )
    const campaignTypeMap = new Map<string, CampaignType>()
    for (const c of campaignsForMap) {
      campaignTypeMap.set(c.id, classifyCampaignObjective(c.objective))
    }

    // Fetch insights from Meta Marketing API
    const rows = await getInsights(credentials.ad_account_id, credentials.user_access_token, {
      level,
      dateFrom,
      dateTo,
      campaignIds: campaignId ? [campaignId] : undefined,
      adsetIds: adsetId ? [adsetId] : undefined,
    })

    // Determine parent for listAdObjects
    let parentId: string | undefined
    if (level === 'adset' && campaignId) parentId = campaignId
    if (level === 'ad' && adsetId) parentId = adsetId

    // Reuse campaignsForMap when level === 'campaign' to avoid double fetch
    const allObjects = level === 'campaign'
      ? campaignsForMap
      : await listAdObjects(credentials.ad_account_id, credentials.user_access_token, level, parentId)

    // Helper to determine campaign_type for a row
    const getRowType = (
      objId: string,
      insightCampaignId?: string,
      objObjective?: string
    ): CampaignType => {
      if (level === 'campaign') {
        return classifyCampaignObjective(objObjective)
      }
      // For adsets/ads, look up via insight's campaign_id
      if (insightCampaignId) {
        return campaignTypeMap.get(insightCampaignId) ?? 'other'
      }
      // Fallback: try to look up via the object's id (if we can find a matching insight)
      const matchingInsight = rows.find(r => {
        if (level === 'adset') return r.adset_id === objId
        if (level === 'ad') return r.ad_id === objId
        return false
      })
      if (matchingInsight?.campaign_id) {
        return campaignTypeMap.get(matchingInsight.campaign_id) ?? 'other'
      }
      return 'other'
    }

    // Build insights map by id
    const insightsMap = new Map<string, BreakdownRow>()
    for (const row of rows) {
      const spend = parseFloat(row.spend || '0')
      const impressions = parseInt(row.impressions || '0', 10)
      const clicks = parseInt(row.clicks || '0', 10)
      const leads = extractLeadCount(row)
      const cpl = extractCostPerLead(row)
      const rowCtr = parseFloat(row.ctr || '0')
      const videoPlays = extractVideoPlays(row)
      const videoP25 = extractVideoP25(row)
      const videoP50 = extractVideoP50(row)
      const videoP75 = extractVideoP75(row)
      const frequency = parseFloat(row.frequency || '0')

      let id = ''
      let name = ''
      if (level === 'campaign') {
        id = row.campaign_id ?? ''
        name = row.campaign_name ?? 'Sans nom'
      } else if (level === 'adset') {
        id = row.adset_id ?? ''
        name = row.adset_name ?? 'Sans nom'
      } else if (level === 'ad') {
        id = row.ad_id ?? ''
        name = row.ad_name ?? 'Sans nom'
      }

      // Classify
      let campaign_type: CampaignType = 'other'
      if (level === 'campaign') {
        // Find matching object to get its objective
        const obj = allObjects.find(o => o.id === id)
        campaign_type = classifyCampaignObjective(obj?.objective)
      } else if (row.campaign_id) {
        campaign_type = campaignTypeMap.get(row.campaign_id) ?? 'other'
      }

      insightsMap.set(id, {
        id,
        name,
        status: 'ACTIVE',
        campaign_type,
        spend: Math.round(spend * 100) / 100,
        impressions,
        clicks,
        ctr: Math.round(rowCtr * 100) / 100,
        leads,
        cpl: cpl !== null ? Math.round(cpl * 100) / 100 : null,
        frequency: Math.round(frequency * 100) / 100,
        video_plays: videoPlays,
        video_p25: videoP25,
        video_p50: videoP50,
        video_p75: videoP75,
        hook_rate: impressions > 0 ? Math.round((videoPlays / impressions) * 100 * 100) / 100 : 0,
        hold_rate_25: videoPlays > 0 ? Math.round((videoP25 / videoPlays) * 100 * 100) / 100 : 0,
        hold_rate_50: videoPlays > 0 ? Math.round((videoP50 / videoPlays) * 100 * 100) / 100 : 0,
        hold_rate_75: videoPlays > 0 ? Math.round((videoP75 / videoPlays) * 100 * 100) / 100 : 0,
      })
    }

    // Merge: start with all objects, overlay insights
    const breakdown: BreakdownRow[] = []

    if (allObjects.length > 0) {
      for (const obj of allObjects) {
        const existing = insightsMap.get(obj.id)
        if (existing) {
          // Has insights — use real status from Meta object
          breakdown.push({ ...existing, status: obj.effective_status })
          insightsMap.delete(obj.id)
        } else {
          // No insights — inactive/draft object
          breakdown.push({
            id: obj.id,
            name: obj.name,
            status: obj.effective_status,
            campaign_type: getRowType(obj.id, undefined, obj.objective),
            spend: 0,
            impressions: 0,
            clicks: 0,
            ctr: 0,
            leads: 0,
            cpl: null,
            frequency: 0,
            video_plays: 0,
            video_p25: 0,
            video_p50: 0,
            video_p75: 0,
            hook_rate: 0,
            hold_rate_25: 0,
            hold_rate_50: 0,
            hold_rate_75: 0,
          })
        }
      }
      // Add remaining insights only if we're NOT scoped to a parent
      if (!parentId) {
        for (const row of insightsMap.values()) {
          breakdown.push(row)
        }
      }
    } else {
      // Fallback if listAdObjects failed — use insights only
      breakdown.push(...insightsMap.values())
    }

    // Filter by campaign_type
    const filteredBreakdown = campaignTypeFilter === 'all'
      ? breakdown
      : breakdown.filter(row => row.campaign_type === campaignTypeFilter)

    // Recalculate KPIs from the filtered breakdown
    let totalSpend = 0, totalImpressions = 0, totalClicks = 0, totalLeads = 0
    let totalVideoPlays = 0, totalVideoP25 = 0, totalVideoP50 = 0, totalVideoP75 = 0
    let freqSum = 0, freqCount = 0
    for (const row of filteredBreakdown) {
      totalSpend += row.spend
      totalImpressions += row.impressions
      totalClicks += row.clicks
      totalLeads += row.leads
      totalVideoPlays += row.video_plays
      totalVideoP25 += row.video_p25
      totalVideoP50 += row.video_p50
      totalVideoP75 += row.video_p75
      if (row.frequency > 0) {
        freqSum += row.frequency
        freqCount++
      }
    }
    const overallCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0
    const overallFrequency = freqCount > 0 ? freqSum / freqCount : 0

    const response: MetaInsightsResponse = {
      kpis: {
        spend: Math.round(totalSpend * 100) / 100,
        impressions: totalImpressions,
        clicks: totalClicks,
        ctr: Math.round(overallCtr * 100) / 100,
        leads: totalLeads,
        cpl: totalLeads > 0 ? Math.round((totalSpend / totalLeads) * 100) / 100 : null,
        frequency: Math.round(overallFrequency * 100) / 100,
        video_plays: totalVideoPlays,
        video_p25: totalVideoP25,
        video_p50: totalVideoP50,
        video_p75: totalVideoP75,
        hook_rate: totalImpressions > 0 ? Math.round((totalVideoPlays / totalImpressions) * 100 * 100) / 100 : 0,
        hold_rate_25: totalVideoPlays > 0 ? Math.round((totalVideoP25 / totalVideoPlays) * 100 * 100) / 100 : 0,
        hold_rate_50: totalVideoPlays > 0 ? Math.round((totalVideoP50 / totalVideoPlays) * 100 * 100) / 100 : 0,
        hold_rate_75: totalVideoPlays > 0 ? Math.round((totalVideoP75 / totalVideoPlays) * 100 * 100) / 100 : 0,
      },
      breakdown: filteredBreakdown.sort((a, b) => b.spend - a.spend),
      daily: [],
      campaignTypeFilter,
    }

    return NextResponse.json(response)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'

    if (message === 'META_TOKEN_EXPIRED') {
      return NextResponse.json(
        { error: 'token_expired', message: 'Reconnectez votre compte Meta' },
        { status: 401 }
      )
    }
    if (message === 'META_RATE_LIMITED') {
      return NextResponse.json(
        { error: 'rate_limited', message: 'Trop de requêtes, réessayez dans quelques minutes' },
        { status: 429 }
      )
    }
    if (message === 'Not authenticated') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    console.error('Meta insights error:', err)
    return NextResponse.json(
      { error: 'meta_error', message: 'Erreur lors de la récupération des données Meta' },
      { status: 502 }
    )
  }
}

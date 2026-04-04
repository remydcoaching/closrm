import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { decrypt } from '@/lib/meta/encryption'
import {
  getInsights,
  listAdObjects,
  extractLeadCount,
  extractCostPerLead,
  type MetaCredentials,
  type InsightsParams,
} from '@/lib/meta/client'

interface KpisData {
  spend: number
  impressions: number
  clicks: number
  ctr: number
  leads: number
  cpl: number | null
}

interface BreakdownRow {
  id: string
  name: string
  status: string
  spend: number
  impressions: number
  clicks: number
  ctr: number
  leads: number
  cpl: number | null
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

    // === DEBUG LOGS ===
    console.log('[META INSIGHTS] Request params:', {
      level,
      preset,
      dateFrom: customFrom ?? 'from preset',
      dateTo: customTo ?? 'from preset',
      campaignId: campaignId ?? 'none',
      adsetId: adsetId ?? 'none',
      resolvedDateRange: { dateFrom, dateTo },
      adAccountId: credentials.ad_account_id,
    })

    // Fetch insights from Meta Marketing API
    const rows = await getInsights(credentials.ad_account_id, credentials.user_access_token, {
      level,
      dateFrom,
      dateTo,
      campaignIds: campaignId ? [campaignId] : undefined,
      adsetIds: adsetId ? [adsetId] : undefined,
    })

    console.log(`[META INSIGHTS] Insights returned: ${rows.length} rows`)
    if (rows.length > 0 && rows.length <= 10) {
      console.log('[META INSIGHTS] Insight rows:', rows.map(r => ({
        campaign_id: r.campaign_id,
        campaign_name: r.campaign_name,
        adset_id: r.adset_id,
        adset_name: r.adset_name,
        ad_id: r.ad_id,
        ad_name: r.ad_name,
        spend: r.spend,
      })))
    }

    // Build response based on level
    if (level === 'account') {
      // Aggregate KPIs from daily rows
      let totalSpend = 0
      let totalImpressions = 0
      let totalClicks = 0
      let totalLeads = 0
      const daily: DailyRow[] = []

      for (const row of rows) {
        const spend = parseFloat(row.spend || '0')
        const impressions = parseInt(row.impressions || '0', 10)
        const clicks = parseInt(row.clicks || '0', 10)
        const leads = extractLeadCount(row)

        totalSpend += spend
        totalImpressions += impressions
        totalClicks += clicks
        totalLeads += leads

        daily.push({
          date: row.date_start,
          spend,
          leads,
          impressions,
          clicks,
        })
      }

      const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0

      const response: MetaInsightsResponse = {
        kpis: {
          spend: totalSpend,
          impressions: totalImpressions,
          clicks: totalClicks,
          ctr: Math.round(ctr * 100) / 100,
          leads: totalLeads,
          cpl: totalLeads > 0 ? Math.round((totalSpend / totalLeads) * 100) / 100 : null,
        },
        breakdown: [],
        daily: daily.sort((a, b) => a.date.localeCompare(b.date)),
      }

      return NextResponse.json(response)
    }

    // Campaign / AdSet / Ad level — fetch all objects + merge with insights
    // Determine parent for listAdObjects
    let parentId: string | undefined
    if (level === 'adset' && campaignId) parentId = campaignId
    if (level === 'ad' && adsetId) parentId = adsetId

    console.log(`[META INSIGHTS] listAdObjects: level=${level}, parentId=${parentId ?? 'none'}`)

    const [allObjects] = await Promise.all([
      listAdObjects(credentials.ad_account_id, credentials.user_access_token, level as 'campaign' | 'adset' | 'ad', parentId),
    ])

    console.log(`[META INSIGHTS] Objects returned: ${allObjects.length}`, allObjects.map(o => ({ id: o.id, name: o.name, status: o.effective_status })))

    // Build insights map by id
    const insightsMap = new Map<string, BreakdownRow>()
    let totalSpend = 0
    let totalImpressions = 0
    let totalClicks = 0
    let totalLeads = 0

    for (const row of rows) {
      const spend = parseFloat(row.spend || '0')
      const impressions = parseInt(row.impressions || '0', 10)
      const clicks = parseInt(row.clicks || '0', 10)
      const leads = extractLeadCount(row)
      const cpl = extractCostPerLead(row)
      const rowCtr = parseFloat(row.ctr || '0')

      totalSpend += spend
      totalImpressions += impressions
      totalClicks += clicks
      totalLeads += leads

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

      insightsMap.set(id, {
        id,
        name,
        status: 'ACTIVE',
        spend: Math.round(spend * 100) / 100,
        impressions,
        clicks,
        ctr: Math.round(rowCtr * 100) / 100,
        leads,
        cpl: cpl !== null ? Math.round(cpl * 100) / 100 : null,
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
            spend: 0,
            impressions: 0,
            clicks: 0,
            ctr: 0,
            leads: 0,
            cpl: null,
          })
        }
      }
      // Add remaining insights only if we're NOT scoped to a parent
      // (when scoped, unmatched insights are from other parents and should be excluded)
      if (!parentId) {
        for (const row of insightsMap.values()) {
          breakdown.push(row)
        }
      }
    } else {
      // Fallback if listAdObjects failed — use insights only
      breakdown.push(...insightsMap.values())
    }

    console.log(`[META INSIGHTS] Final breakdown: ${breakdown.length} items`, breakdown.map(b => ({ id: b.id, name: b.name, status: b.status, spend: b.spend })))

    const overallCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0

    const response: MetaInsightsResponse = {
      kpis: {
        spend: totalSpend,
        impressions: totalImpressions,
        clicks: totalClicks,
        ctr: Math.round(overallCtr * 100) / 100,
        leads: totalLeads,
        cpl: totalLeads > 0 ? Math.round((totalSpend / totalLeads) * 100) / 100 : null,
      },
      breakdown: breakdown.sort((a, b) => b.spend - a.spend),
      daily: [],
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

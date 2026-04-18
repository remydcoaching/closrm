import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { decrypt } from '@/lib/meta/encryption'
import {
  listAdObjects,
  getInsights,
  extractLeadCount,
  type MetaCredentials,
  type MetaAdObject,
} from '@/lib/meta/client'

type Level = 'campaign' | 'adset' | 'ad'

const LEVEL_COLUMN: Record<Level, string> = {
  campaign: 'meta_campaign_id',
  adset: 'meta_adset_id',
  ad: 'meta_ad_id',
}

export interface AdPerformanceRow {
  id: string
  name: string
  status: string
  spend: number
  impressions: number
  clicks: number
  meta_leads: number // as reported by Meta
  lead_count: number // from our DB
  qualified_count: number
  closed_count: number
  calls_count: number
  revenue: number
  cash_collected: number
  cpl: number | null
  cpl_qualified: number | null
  roas: number | null
}

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const sp = request.nextUrl.searchParams
    const level = (sp.get('level') || 'ad') as Level
    if (!['campaign', 'adset', 'ad'].includes(level)) {
      return NextResponse.json({ error: 'invalid level' }, { status: 400 })
    }
    const parentCampaignId = sp.get('campaign_id') || undefined
    const parentAdsetId = sp.get('adset_id') || undefined

    const today = new Date()
    const defaultFrom = new Date()
    defaultFrom.setDate(today.getDate() - 30)
    const dateFrom = sp.get('date_from') || defaultFrom.toISOString().slice(0, 10)
    const dateTo = sp.get('date_to') || today.toISOString().slice(0, 10)

    const supabase = await createClient()

    // 1. Fetch Meta integration
    const { data: integration } = await supabase
      .from('integrations')
      .select('credentials_encrypted, is_active')
      .eq('workspace_id', workspaceId)
      .eq('type', 'meta')
      .eq('is_active', true)
      .maybeSingle()

    if (!integration?.credentials_encrypted) {
      return NextResponse.json({ error: 'meta_not_connected' }, { status: 404 })
    }
    const credentials: MetaCredentials = JSON.parse(decrypt(integration.credentials_encrypted))
    if (!credentials.ad_account_id) {
      return NextResponse.json({ error: 'needs_upgrade' }, { status: 403 })
    }

    // 2. Fetch leads from DB in period with meta ID at this level
    const column = LEVEL_COLUMN[level]
    let leadQuery = supabase
      .from('leads')
      .select(`id, status, deal_amount, cash_collected, meta_campaign_id, meta_adset_id, meta_ad_id`)
      .eq('workspace_id', workspaceId)
      .not(column, 'is', null)
      .gte('created_at', `${dateFrom}T00:00:00Z`)
      .lte('created_at', `${dateTo}T23:59:59Z`)
    if (parentCampaignId) leadQuery = leadQuery.eq('meta_campaign_id', parentCampaignId)
    if (parentAdsetId) leadQuery = leadQuery.eq('meta_adset_id', parentAdsetId)

    const { data: leadsData, error: leadsErr } = await leadQuery
    if (leadsErr) {
      console.error('ad-performance leads error', leadsErr)
      return NextResponse.json({ error: 'db_error' }, { status: 500 })
    }
    type LeadRow = { id: string; status: string; deal_amount: number | null; cash_collected: number | null; meta_campaign_id: string | null; meta_adset_id: string | null; meta_ad_id: string | null }
    const leads = (leadsData ?? []) as LeadRow[]

    // 3. Fetch call counts per lead (single query)
    const leadIds = leads.map(l => l.id)
    const callCountByLead = new Map<string, number>()
    if (leadIds.length > 0) {
      const { data: callsData } = await supabase
        .from('calls')
        .select('lead_id')
        .eq('workspace_id', workspaceId)
        .in('lead_id', leadIds)
      for (const c of callsData ?? []) {
        callCountByLead.set(c.lead_id, (callCountByLead.get(c.lead_id) ?? 0) + 1)
      }
    }

    // 4. Aggregate by level id
    type Agg = { lead_count: number; qualified_count: number; closed_count: number; calls_count: number; revenue: number; cash_collected: number }
    const aggById = new Map<string, Agg>()
    const ensure = (id: string) => {
      let a = aggById.get(id)
      if (!a) {
        a = { lead_count: 0, qualified_count: 0, closed_count: 0, calls_count: 0, revenue: 0, cash_collected: 0 }
        aggById.set(id, a)
      }
      return a
    }
    for (const l of leads) {
      const groupId = (l as Record<string, string | null>)[column]
      if (!groupId) continue
      const a = ensure(groupId)
      a.lead_count += 1
      if (l.status !== 'dead') a.qualified_count += 1
      if (l.status === 'clos') {
        a.closed_count += 1
        a.revenue += Number(l.deal_amount ?? 0)
        a.cash_collected += Number(l.cash_collected ?? 0)
      }
      a.calls_count += callCountByLead.get(l.id) ?? 0
    }

    // 5. Fetch Meta insights at this level
    const insightRows = await getInsights(credentials.ad_account_id, credentials.user_access_token, {
      level,
      dateFrom,
      dateTo,
      campaignIds: parentCampaignId ? [parentCampaignId] : undefined,
      adsetIds: parentAdsetId ? [parentAdsetId] : undefined,
    }).catch((e) => { console.warn('insights failed', e); return [] })

    const insightByInsId = new Map<string, { spend: number; impressions: number; clicks: number; leads: number; name: string }>()
    for (const row of insightRows) {
      const id = level === 'campaign' ? row.campaign_id : level === 'adset' ? row.adset_id : row.ad_id
      if (!id) continue
      const name = level === 'campaign' ? row.campaign_name : level === 'adset' ? row.adset_name : row.ad_name
      insightByInsId.set(id, {
        spend: parseFloat(row.spend || '0'),
        impressions: parseInt(row.impressions || '0', 10),
        clicks: parseInt(row.clicks || '0', 10),
        leads: extractLeadCount(row),
        name: name ?? id,
      })
    }

    // 6. Resolve missing names via listAdObjects
    const allIds = new Set<string>([...aggById.keys(), ...insightByInsId.keys()])
    const objectByLevel: MetaAdObject[] = await listAdObjects(
      credentials.ad_account_id,
      credentials.user_access_token,
      level,
      parentAdsetId || parentCampaignId,
    ).catch(() => [])
    const objectById = new Map(objectByLevel.map(o => [o.id, o]))

    // 7. Build rows
    const rows: AdPerformanceRow[] = []
    for (const id of allIds) {
      const agg = aggById.get(id) ?? { lead_count: 0, qualified_count: 0, closed_count: 0, calls_count: 0, revenue: 0, cash_collected: 0 }
      const ins = insightByInsId.get(id)
      const obj = objectById.get(id)
      const spend = ins?.spend ?? 0
      const cpl = agg.lead_count > 0 && spend > 0 ? spend / agg.lead_count : null
      const cpl_qualified = agg.qualified_count > 0 && spend > 0 ? spend / agg.qualified_count : null
      const roas = spend > 0 ? agg.revenue / spend : null
      rows.push({
        id,
        name: ins?.name ?? obj?.name ?? id,
        status: obj?.effective_status ?? 'UNKNOWN',
        spend: Math.round(spend * 100) / 100,
        impressions: ins?.impressions ?? 0,
        clicks: ins?.clicks ?? 0,
        meta_leads: ins?.leads ?? 0,
        lead_count: agg.lead_count,
        qualified_count: agg.qualified_count,
        closed_count: agg.closed_count,
        calls_count: agg.calls_count,
        revenue: Math.round(agg.revenue * 100) / 100,
        cash_collected: Math.round(agg.cash_collected * 100) / 100,
        cpl: cpl !== null ? Math.round(cpl * 100) / 100 : null,
        cpl_qualified: cpl_qualified !== null ? Math.round(cpl_qualified * 100) / 100 : null,
        roas: roas !== null ? Math.round(roas * 100) / 100 : null,
      })
    }

    // Default sort by revenue desc then lead_count desc
    rows.sort((a, b) => (b.revenue - a.revenue) || (b.lead_count - a.lead_count))

    return NextResponse.json({ data: rows, meta: { level, date_from: dateFrom, date_to: dateTo } })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    console.error('ad-performance error', err)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}

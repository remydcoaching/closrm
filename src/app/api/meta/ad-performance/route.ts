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
  calls_reached: number
  bookings_total: number
  bookings_show_up: number
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

    // 2. Fetch leads from DB in period. We're permissive on inclusion :
    //    every lead that either declares a Meta source OR carries any
    //    meta_*_id is considered Meta-attributable. Older leads imported
    //    via CSV or tagged as 'follow_ads'/'formulaire' can still have
    //    valid Meta IDs and we don't want to lose them. Orphans (no level
    //    ID) land in the "Non attribué" bucket.
    const column = LEVEL_COLUMN[level]
    let leadQuery = supabase
      .from('leads')
      .select(`id, status, deal_amount, cash_collected, source, meta_campaign_id, meta_adset_id, meta_ad_id`)
      .eq('workspace_id', workspaceId)
      // Match leads that look Meta-related: either declared Meta source,
      // OR any campaign/adset/ad attribution.
      .or('source.in.(facebook_ads,instagram_ads,follow_ads),meta_campaign_id.not.is.null,meta_adset_id.not.is.null,meta_ad_id.not.is.null')
      .gte('created_at', `${dateFrom}T00:00:00Z`)
      .lte('created_at', `${dateTo}T23:59:59Z`)
    // NOTE: parent filtering is applied AFTER parent resolution below.
    // Filtering at the DB level on meta_campaign_id / meta_adset_id would
    // drop every lead that only has meta_ad_id stored — which is most of
    // them per Pierre's diagnostic (9/10 facebook_ads leads).

    const { data: leadsData, error: leadsErr } = await leadQuery
    if (leadsErr) {
      console.error('ad-performance leads error', leadsErr)
      return NextResponse.json({ error: 'db_error' }, { status: 500 })
    }
    type LeadRow = { id: string; status: string; deal_amount: number | null; cash_collected: number | null; source: string | null; meta_campaign_id: string | null; meta_adset_id: string | null; meta_ad_id: string | null }
    const leads = (leadsData ?? []) as LeadRow[]

    // Synthetic ID used for the "Non attribué" bucket at the current level.
    const UNATTRIBUTED_ID = '__unattributed__'

    // 3. Fetch call counts + reached per lead (single query)
    const leadIds = leads.map(l => l.id)
    const callCountByLead = new Map<string, number>()
    const callReachedByLead = new Map<string, number>()
    const bookingTotalByLead = new Map<string, number>()
    const bookingShowUpByLead = new Map<string, number>()
    if (leadIds.length > 0) {
      const { data: callsData } = await supabase
        .from('calls')
        .select('lead_id, outcome, reached')
        .eq('workspace_id', workspaceId)
        .in('lead_id', leadIds)
      for (const c of callsData ?? []) {
        callCountByLead.set(c.lead_id, (callCountByLead.get(c.lead_id) ?? 0) + 1)
        if (c.reached || c.outcome === 'done') {
          callReachedByLead.set(c.lead_id, (callReachedByLead.get(c.lead_id) ?? 0) + 1)
        }
      }
      // Bookings
      const { data: bookingsData } = await supabase
        .from('bookings')
        .select('lead_id, status')
        .eq('workspace_id', workspaceId)
        .in('lead_id', leadIds)
      for (const b of bookingsData ?? []) {
        if (!b.lead_id) continue
        bookingTotalByLead.set(b.lead_id, (bookingTotalByLead.get(b.lead_id) ?? 0) + 1)
        if (b.status === 'completed' || b.status === 'confirmed') {
          bookingShowUpByLead.set(b.lead_id, (bookingShowUpByLead.get(b.lead_id) ?? 0) + 1)
        }
      }
    }

    // 3.5 Backfill parent IDs (campaign + adset) from Meta. Pierre's
    //    diagnostic showed his leadgen webhook delivers only ad_id
    //    reliably — meta_campaign_id and meta_adset_id end up null on
    //    most leads. We resolve parents on the fly via listAdObjects so
    //    the Campaigns and Adsets tabs aren't empty.
    let adIdToParents: Map<string, { campaign_id?: string; adset_id?: string }> = new Map()
    const leadsNeedingParents = leads.some(l => l.meta_ad_id && (!l.meta_campaign_id || !l.meta_adset_id))
    if (leadsNeedingParents) {
      const allAds = await listAdObjects(credentials.ad_account_id, credentials.user_access_token, 'ad').catch(() => [])
      adIdToParents = new Map(allAds.map(a => [a.id, { campaign_id: a.campaign_id, adset_id: a.adset_id }]))
    }

    // Returns the lead's effective ID at the chosen level, falling back
    // to the resolved parent map when the direct column is null.
    function resolveLevelId(lead: LeadRow, lvl: typeof level): string | null {
      if (lvl === 'campaign') {
        if (lead.meta_campaign_id) return lead.meta_campaign_id
        if (lead.meta_ad_id) return adIdToParents.get(lead.meta_ad_id)?.campaign_id ?? null
      }
      if (lvl === 'adset') {
        if (lead.meta_adset_id) return lead.meta_adset_id
        if (lead.meta_ad_id) return adIdToParents.get(lead.meta_ad_id)?.adset_id ?? null
      }
      if (lvl === 'ad') return lead.meta_ad_id ?? null
      return null
    }

    // 4. Aggregate by level id
    type Agg = { lead_count: number; qualified_count: number; closed_count: number; calls_count: number; calls_reached: number; bookings_total: number; bookings_show_up: number; revenue: number; cash_collected: number }
    const aggById = new Map<string, Agg>()
    const ensure = (id: string) => {
      let a = aggById.get(id)
      if (!a) {
        a = { lead_count: 0, qualified_count: 0, closed_count: 0, calls_count: 0, calls_reached: 0, bookings_total: 0, bookings_show_up: 0, revenue: 0, cash_collected: 0 }
        aggById.set(id, a)
      }
      return a
    }
    // Resolve each lead's full hierarchy once, then apply the drill-down
    // filters here (post-resolution) so leads that only carry meta_ad_id
    // are still attributable to the parent campaign / adset.
    function resolveCampaign(l: LeadRow): string | null {
      return l.meta_campaign_id ?? (l.meta_ad_id ? adIdToParents.get(l.meta_ad_id)?.campaign_id ?? null : null)
    }
    function resolveAdset(l: LeadRow): string | null {
      return l.meta_adset_id ?? (l.meta_ad_id ? adIdToParents.get(l.meta_ad_id)?.adset_id ?? null : null)
    }

    for (const l of leads) {
      if (parentCampaignId && resolveCampaign(l) !== parentCampaignId) continue
      if (parentAdsetId && resolveAdset(l) !== parentAdsetId) continue
      const groupId = resolveLevelId(l, level) || UNATTRIBUTED_ID
      const a = ensure(groupId)
      a.lead_count += 1
      if (l.status !== 'dead') a.qualified_count += 1
      if (l.status === 'clos') {
        a.closed_count += 1
        a.revenue += Number(l.deal_amount ?? 0)
        a.cash_collected += Number(l.cash_collected ?? 0)
      }
      a.calls_count += callCountByLead.get(l.id) ?? 0
      a.calls_reached += callReachedByLead.get(l.id) ?? 0
      a.bookings_total += bookingTotalByLead.get(l.id) ?? 0
      a.bookings_show_up += bookingShowUpByLead.get(l.id) ?? 0
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
    const emptyAgg: Agg = { lead_count: 0, qualified_count: 0, closed_count: 0, calls_count: 0, calls_reached: 0, bookings_total: 0, bookings_show_up: 0, revenue: 0, cash_collected: 0 }
    for (const id of allIds) {
      const agg = aggById.get(id) ?? emptyAgg
      const ins = insightByInsId.get(id)
      const obj = objectById.get(id)
      const spend = ins?.spend ?? 0
      const cpl = agg.lead_count > 0 && spend > 0 ? spend / agg.lead_count : null
      const cpl_qualified = agg.qualified_count > 0 && spend > 0 ? spend / agg.qualified_count : null
      const roas = spend > 0 ? agg.revenue / spend : null
      const isUnattributed = id === UNATTRIBUTED_ID
      rows.push({
        id,
        name: isUnattributed
          ? `Non attribué (${agg.lead_count} lead${agg.lead_count > 1 ? 's' : ''} sans ${level === 'campaign' ? 'campagne' : level === 'adset' ? 'adset' : 'ad'} Meta)`
          : ins?.name ?? obj?.name ?? id,
        status: isUnattributed ? 'UNATTRIBUTED' : (obj?.effective_status ?? 'UNKNOWN'),
        spend: Math.round(spend * 100) / 100,
        impressions: ins?.impressions ?? 0,
        clicks: ins?.clicks ?? 0,
        meta_leads: ins?.leads ?? 0,
        lead_count: agg.lead_count,
        qualified_count: agg.qualified_count,
        closed_count: agg.closed_count,
        calls_count: agg.calls_count,
        calls_reached: agg.calls_reached,
        bookings_total: agg.bookings_total,
        bookings_show_up: agg.bookings_show_up,
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

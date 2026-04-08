const GRAPH_URL = 'https://graph.facebook.com/v18.0'

function appId(): string {
  const id = process.env.META_APP_ID
  if (!id) throw new Error('META_APP_ID not set')
  return id
}

function appSecret(): string {
  const s = process.env.META_APP_SECRET
  if (!s) throw new Error('META_APP_SECRET not set')
  return s
}

function callbackUrl(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL
  if (!base) throw new Error('NEXT_PUBLIC_APP_URL not set')
  return `${base}/api/integrations/meta/callback`
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MetaPage {
  id: string
  name: string
  access_token: string
}

export interface MetaLeadField {
  name: string
  values: string[]
}

export interface MetaLeadData {
  id: string
  created_time: string
  field_data: MetaLeadField[]
  ad_id: string | null
  adset_id: string | null
  campaign_id: string | null
  page_id: string | null
}

export interface MetaTokenResponse {
  access_token: string
  token_type: string
  expires_in?: number
}

export interface MetaCredentials {
  user_access_token: string
  token_expires_at: string | null  // ISO date or null if no expiry
  page_id: string
  page_name: string
  page_access_token: string
  ad_account_id?: string  // added in T-017
}

// ─── Ad Accounts ────────────────────────────────────────────────────────────

export interface MetaAdAccount {
  id: string        // format "act_123456"
  name: string
  account_status: number  // 1=ACTIVE, 2=DISABLED, 3=UNSETTLED, etc.
}

// ─── Marketing API Insights ─────────────────────────────────────────────────

export interface MetaInsightAction {
  action_type: string
  value: string
}

export interface MetaInsightRow {
  date_start: string
  date_stop: string
  campaign_id?: string
  campaign_name?: string
  adset_id?: string
  adset_name?: string
  ad_id?: string
  ad_name?: string
  spend: string
  impressions: string
  clicks: string
  ctr: string
  actions?: MetaInsightAction[]
  cost_per_action_type?: MetaInsightAction[]
}

export interface InsightsParams {
  level: 'account' | 'campaign' | 'adset' | 'ad'
  dateFrom: string  // YYYY-MM-DD
  dateTo: string    // YYYY-MM-DD
  campaignIds?: string[]  // filter insights to these campaigns
  adsetIds?: string[]     // filter insights to these adsets
}

// ─── OAuth ───────────────────────────────────────────────────────────────────

export function buildOAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: appId(),
    redirect_uri: callbackUrl(),
    state,
    scope: 'leads_retrieval,pages_show_list,pages_manage_metadata,pages_read_engagement,business_management,ads_read,read_insights,instagram_basic,instagram_manage_messages,instagram_content_publish,instagram_manage_insights,instagram_manage_comments',
    response_type: 'code',
  })
  return `https://www.facebook.com/v18.0/dialog/oauth?${params.toString()}`
}

export async function exchangeCodeForToken(code: string): Promise<string> {
  const params = new URLSearchParams({
    client_id: appId(),
    redirect_uri: callbackUrl(),
    client_secret: appSecret(),
    code,
  })
  const res = await fetch(`${GRAPH_URL}/oauth/access_token?${params.toString()}`)
  if (!res.ok) {
    const err = await res.json()
    throw new Error(`Meta token exchange failed: ${JSON.stringify(err)}`)
  }
  const data: MetaTokenResponse = await res.json()
  return data.access_token
}

export async function getLongLivedToken(
  shortToken: string
): Promise<{ access_token: string; expires_at: string | null }> {
  const params = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: appId(),
    client_secret: appSecret(),
    fb_exchange_token: shortToken,
  })
  const res = await fetch(`${GRAPH_URL}/oauth/access_token?${params.toString()}`)
  if (!res.ok) {
    const err = await res.json()
    throw new Error(`Meta long-lived token exchange failed: ${JSON.stringify(err)}`)
  }
  const data: MetaTokenResponse & { expires_in?: number } = await res.json()
  const expires_at = data.expires_in
    ? new Date(Date.now() + data.expires_in * 1000).toISOString()
    : null
  return { access_token: data.access_token, expires_at }
}

// ─── Pages ───────────────────────────────────────────────────────────────────

export async function getPages(userToken: string): Promise<MetaPage[]> {
  // 1. Try direct user pages (/me/accounts)
  const res = await fetch(
    `${GRAPH_URL}/me/accounts?fields=id,name,access_token&access_token=${userToken}`
  )
  if (res.ok) {
    const data: { data: MetaPage[] } = await res.json()
    if (data.data && data.data.length > 0) {
      return data.data
    }
  }

  // 2. Fallback: pages managed via Business Manager (Meta Business Suite)
  // Pages linked to a Business don't appear in /me/accounts
  const bizRes = await fetch(
    `${GRAPH_URL}/me/businesses?fields=owned_pages{id,name,access_token}&access_token=${userToken}`
  )
  if (!bizRes.ok) {
    return []
  }
  const bizData: {
    data: Array<{
      id: string
      owned_pages?: { data: MetaPage[] }
    }>
  } = await bizRes.json()

  const pages: MetaPage[] = []
  for (const biz of bizData.data ?? []) {
    if (biz.owned_pages?.data) {
      pages.push(...biz.owned_pages.data)
    }
  }
  return pages
}

export async function subscribePageToLeadgen(
  pageId: string,
  pageToken: string
): Promise<void> {
  const res = await fetch(
    `${GRAPH_URL}/${pageId}/subscribed_apps`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        subscribed_fields: 'leadgen',
        access_token: pageToken,
      }).toString(),
    }
  )
  if (!res.ok) {
    const err = await res.json()
    throw new Error(`Meta page subscription failed: ${JSON.stringify(err)}`)
  }
}

export async function unsubscribePageFromLeadgen(
  pageId: string,
  pageToken: string
): Promise<void> {
  const res = await fetch(
    `${GRAPH_URL}/${pageId}/subscribed_apps?access_token=${pageToken}`,
    { method: 'DELETE' }
  )
  // Ignore errors — page may already be unsubscribed or token expired
  if (!res.ok) {
    console.warn('Meta unsubscribe warning (ignored):', await res.text())
  }
}

// ─── Ad Accounts ────────────────────────────────────────────────────────────

export async function getAdAccounts(userToken: string): Promise<MetaAdAccount[]> {
  const res = await fetch(
    `${GRAPH_URL}/me/adaccounts?fields=id,name,account_status&access_token=${userToken}`
  )
  if (!res.ok) {
    const err = await res.json()
    throw new Error(`Meta ad accounts fetch failed: ${JSON.stringify(err)}`)
  }
  const data: { data: MetaAdAccount[] } = await res.json()
  return data.data ?? []
}

// ─── List all objects (including inactive) ──────────────────────────────────

export interface MetaAdObject {
  id: string
  name: string
  status: string           // ACTIVE, PAUSED, DELETED, ARCHIVED
  effective_status: string  // ACTIVE, PAUSED, CAMPAIGN_PAUSED, IN_PROCESS, WITH_ISSUES, etc.
  objective?: string        // Only on campaigns: OUTCOME_LEADS, OUTCOME_AWARENESS, etc.
}

const LEVEL_TO_EDGE: Record<string, string> = {
  campaign: 'campaigns',
  adset: 'adsets',
  ad: 'ads',
}

export async function listAdObjects(
  adAccountId: string,
  token: string,
  level: 'campaign' | 'adset' | 'ad',
  parentId?: string // campaign_id for adsets, adset_id for ads
): Promise<MetaAdObject[]> {
  const baseFields = 'id,name,status,effective_status'
  // Add objective for campaigns (used for Leadform/Follow Ads classification)
  const fields = level === 'campaign' ? `${baseFields},objective` : baseFields

  // If we have a parent, fetch from the parent's edge instead of account level
  let url: string
  if (parentId && level === 'adset') {
    url = `${GRAPH_URL}/${parentId}/adsets?fields=${fields}&limit=200&access_token=${token}`
  } else if (parentId && level === 'ad') {
    url = `${GRAPH_URL}/${parentId}/ads?fields=${fields}&limit=200&access_token=${token}`
  } else {
    const edge = LEVEL_TO_EDGE[level]
    url = `${GRAPH_URL}/${adAccountId}/${edge}?fields=${fields}&limit=200&access_token=${token}`
  }

  const res = await fetch(url)
  if (!res.ok) {
    console.warn(`Failed to list ${level}s:`, await res.text())
    return []
  }
  const data: { data: MetaAdObject[] } = await res.json()
  return data.data ?? []
}

// ─── Marketing API Insights ─────────────────────────────────────────────────

export async function getInsights(
  adAccountId: string,
  token: string,
  params: InsightsParams
): Promise<MetaInsightRow[]> {
  const timeRange = JSON.stringify({ since: params.dateFrom, until: params.dateTo })

  const baseFields = [
    'spend', 'impressions', 'clicks', 'ctr',
    'actions', 'cost_per_action_type',
  ]

  // Add ID + name fields based on level so Meta returns them
  if (params.level === 'campaign') {
    baseFields.push('campaign_id', 'campaign_name')
  } else if (params.level === 'adset') {
    baseFields.push('adset_id', 'adset_name', 'campaign_id', 'campaign_name')
  } else if (params.level === 'ad') {
    baseFields.push('ad_id', 'ad_name', 'adset_id', 'adset_name', 'campaign_id', 'campaign_name')
  }

  const fields = baseFields.join(',')

  const searchParams = new URLSearchParams({
    fields,
    level: params.level,
    time_range: timeRange,
    access_token: token,
  })

  // Daily breakdown for account-level (chart data)
  if (params.level === 'account') {
    searchParams.set('time_increment', '1')
  } else {
    searchParams.set('limit', '100')
  }

  // Filter by parent (campaign or adset)
  const filtering: Array<{ field: string; operator: string; value: string[] }> = []
  if (params.campaignIds && params.campaignIds.length > 0) {
    filtering.push({ field: 'campaign.id', operator: 'IN', value: params.campaignIds })
  }
  if (params.adsetIds && params.adsetIds.length > 0) {
    filtering.push({ field: 'adset.id', operator: 'IN', value: params.adsetIds })
  }
  if (filtering.length > 0) {
    searchParams.set('filtering', JSON.stringify(filtering))
  }

  const res = await fetch(
    `${GRAPH_URL}/${adAccountId}/insights?${searchParams.toString()}`
  )

  if (!res.ok) {
    const err = await res.json()
    const metaError = err?.error
    if (metaError?.code === 190) {
      throw new Error('META_TOKEN_EXPIRED')
    }
    if (metaError?.code === 17 || metaError?.code === 4) {
      throw new Error('META_RATE_LIMITED')
    }
    throw new Error(`Meta insights fetch failed: ${JSON.stringify(err)}`)
  }

  const data: { data: MetaInsightRow[] } = await res.json()
  return data.data ?? []
}

// ─── Insight helpers ────────────────────────────────────────────────────────

export function extractLeadCount(row: MetaInsightRow): number {
  if (!row.actions) return 0
  const leadAction = row.actions.find(
    a => a.action_type === 'lead' || a.action_type === 'offsite_conversion.fb_pixel_lead'
  )
  return leadAction ? parseInt(leadAction.value, 10) : 0
}

export function extractCostPerLead(row: MetaInsightRow): number | null {
  if (!row.cost_per_action_type) return null
  const cplAction = row.cost_per_action_type.find(
    a => a.action_type === 'lead' || a.action_type === 'offsite_conversion.fb_pixel_lead'
  )
  return cplAction ? parseFloat(cplAction.value) : null
}

// ─── Lead data ───────────────────────────────────────────────────────────────

export async function getLeadData(
  leadgenId: string,
  pageToken: string
): Promise<MetaLeadData> {
  const res = await fetch(
    `${GRAPH_URL}/${leadgenId}?fields=field_data,created_time,ad_id,adset_id,campaign_id&access_token=${pageToken}`
  )
  if (!res.ok) {
    const err = await res.json()
    throw new Error(`Meta get lead failed: ${JSON.stringify(err)}`)
  }
  return res.json()
}

// ─── Field mapping ───────────────────────────────────────────────────────────

export interface ParsedLead {
  first_name: string
  last_name: string
  email: string | null
  phone: string
}

const FIELD_ALIASES: Record<string, keyof ParsedLead> = {
  first_name: 'first_name',
  prenom: 'first_name',
  'prénom': 'first_name',
  last_name: 'last_name',
  nom: 'last_name',
  family_name: 'last_name',
  full_name: 'first_name',        // handled specially below
  email: 'email',
  email_address: 'email',
  phone_number: 'phone',
  phone: 'phone',
  mobile_phone: 'phone',
  telephone: 'phone',
}

// ─── Ad Creative ────────────────────────────────────────────────────────────

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

export async function getAdCreative(adId: string, token: string): Promise<MetaAdCreative | null> {
  const fields = 'id,name,creative{id,image_url,thumbnail_url,body,title,object_story_spec}'
  const res = await fetch(`${GRAPH_URL}/${adId}?fields=${fields}&access_token=${token}`)
  if (!res.ok) return null
  const data = await res.json()
  const creative = data.creative || {}
  return {
    id: data.id,
    name: data.name,
    image_url: creative.image_url || null,
    video_url: null, // Video URL requires separate fetch
    thumbnail_url: creative.thumbnail_url || creative.image_url || null,
    body: creative.body || null,
    title: creative.title || null,
    link_url: creative.object_story_spec?.link_data?.link || null,
  }
}

// ─── Field mapping ───────────────────────────────────────────────────────────

export function parseLeadFields(fields: MetaLeadField[]): ParsedLead {
  const result: ParsedLead = { first_name: '', last_name: '', email: null, phone: '' }

  for (const { name, values } of fields) {
    const value = values[0] ?? ''
    const key = name.toLowerCase()

    if (key === 'full_name') {
      const parts = value.trim().split(/\s+/)
      result.first_name = parts[0] ?? ''
      result.last_name = parts.slice(1).join(' ')
      continue
    }

    const mapped = FIELD_ALIASES[key]
    if (mapped) {
      if (mapped === 'email') {
        result.email = value || null
      } else if (value) {
        result[mapped] = value
      }
    }
  }

  // Fallback: if no first_name, use email prefix or 'Inconnu'
  if (!result.first_name) {
    result.first_name = result.email?.split('@')[0] ?? 'Inconnu'
  }

  return result
}

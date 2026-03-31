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
}

// ─── OAuth ───────────────────────────────────────────────────────────────────

export function buildOAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: appId(),
    redirect_uri: callbackUrl(),
    state,
    scope: 'leads_retrieval,pages_show_list,pages_manage_metadata,pages_read_engagement,business_management',
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

// ─── Lead data ───────────────────────────────────────────────────────────────

export async function getLeadData(
  leadgenId: string,
  pageToken: string
): Promise<MetaLeadData> {
  const res = await fetch(
    `${GRAPH_URL}/${leadgenId}?fields=field_data,created_time,ad_id,adset_id,campaign_id,page_id&access_token=${pageToken}`
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

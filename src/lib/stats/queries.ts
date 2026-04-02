import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/meta/encryption'
import { getInsights, extractLeadCount, type MetaCredentials } from '@/lib/meta/client'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface StatsKpis {
  totalLeads: number
  bookedCalls: number
  bookingRate: number | null   // null si 0 leads
  closedDeals: number
  winRate: number | null       // null si 0 calls bookés
}

export interface LeadsPerDay {
  date: string   // "2026-03-01"
  count: number
}

export interface FunnelData {
  label: string
  count: number
  pct: number    // % par rapport au total leads
  color: string
}

export interface SourceData {
  source: string
  count: number
  label: string  // libellé lisible
  color: string
}

export interface MetaStats {
  isConnected: boolean
  // Données temps réel Meta non disponibles en V1 — placeholder
  costPerLead: number | null
  roas: number | null
  budgetSpent: number | null
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getSinceIso(period: number): string | null {
  if (period === 0) return null   // "Tout" = pas de filtre
  const since = new Date()
  since.setDate(since.getDate() - period)
  return since.toISOString()
}

// ─── KPIs ───────────────────────────────────────────────────────────────────

export async function fetchStatsKpis(workspaceId: string, period: number): Promise<StatsKpis> {
  const supabase = await createClient()
  const since = getSinceIso(period)

  let leadsQuery = supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
  if (since) leadsQuery = leadsQuery.gte('created_at', since)

  // Every row in `calls` = a booked appointment (setting or closing).
  // Raw dial attempts are tracked in leads.call_attempts, not here.
  let callsQuery = supabase
    .from('calls')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
  if (since) callsQuery = callsQuery.gte('created_at', since)

  let closedQuery = supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('status', 'clos')
  if (since) closedQuery = closedQuery.gte('updated_at', since)

  const [leadsRes, callsRes, closedRes] = await Promise.all([leadsQuery, callsQuery, closedQuery])

  const totalLeads = leadsRes.count ?? 0
  const bookedCalls = callsRes.count ?? 0
  const closedDeals = closedRes.count ?? 0
  const bookingRate = totalLeads > 0 ? Math.round((bookedCalls / totalLeads) * 100) : null
  const winRate = bookedCalls > 0 ? Math.round((closedDeals / bookedCalls) * 100) : null

  return { totalLeads, bookedCalls, bookingRate, closedDeals, winRate }
}

// ─── Leads par jour ──────────────────────────────────────────────────────────

export async function fetchLeadsPerDay(workspaceId: string, period: number): Promise<LeadsPerDay[]> {
  const supabase = await createClient()
  const since = getSinceIso(period)

  let query = supabase
    .from('leads')
    .select('created_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: true })
  if (since) query = query.gte('created_at', since)

  const { data } = await query

  // Grouper par date (YYYY-MM-DD) côté JS
  const counts: Record<string, number> = {}
  for (const row of data ?? []) {
    const day = row.created_at.slice(0, 10)
    counts[day] = (counts[day] ?? 0) + 1
  }
  return Object.entries(counts).map(([date, count]) => ({ date, count }))
}

// ─── Funnel ──────────────────────────────────────────────────────────────────

export async function fetchFunnelData(workspaceId: string, period: number): Promise<FunnelData[]> {
  const supabase = await createClient()
  const since = getSinceIso(period)

  // Leads total
  let leadsQ = supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
  if (since) leadsQ = leadsQ.gte('created_at', since)

  // Setting bookés (appels setting planifiés)
  let settingQ = supabase
    .from('calls')
    .select('lead_id')
    .eq('workspace_id', workspaceId)
    .eq('type', 'setting')
  if (since) settingQ = settingQ.gte('created_at', since)

  // Closing bookés
  let closingQ = supabase
    .from('calls')
    .select('lead_id')
    .eq('workspace_id', workspaceId)
    .eq('type', 'closing')
  if (since) closingQ = closingQ.gte('created_at', since)

  // Closés
  let closedQ = supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('status', 'clos')
  if (since) closedQ = closedQ.gte('updated_at', since)

  const [leadsRes, settingRes, closingRes, closedRes] = await Promise.all([
    leadsQ, settingQ, closingQ, closedQ,
  ])

  const totalLeads = leadsRes.count ?? 0
  // DISTINCT lead_id côté JS
  const settingCount = new Set((settingRes.data ?? []).map(r => r.lead_id)).size
  const closingCount = new Set((closingRes.data ?? []).map(r => r.lead_id)).size
  const closedCount = closedRes.count ?? 0

  const pct = (n: number) => totalLeads > 0 ? Math.round((n / totalLeads) * 100) : 0

  return [
    { label: 'Leads', count: totalLeads, pct: totalLeads > 0 ? 100 : 0, color: '#3b82f6' },
    { label: 'Setting', count: settingCount, pct: pct(settingCount), color: '#f59e0b' },
    { label: 'Closing', count: closingCount, pct: pct(closingCount), color: '#a855f7' },
    { label: 'Closé', count: closedCount, pct: pct(closedCount), color: 'var(--color-primary)' },
  ]
}

// ─── Sources ─────────────────────────────────────────────────────────────────

const SOURCE_META: Record<string, { label: string; color: string }> = {
  facebook_ads:  { label: 'Facebook Ads',   color: '#1877F2' },
  instagram_ads: { label: 'Instagram Ads',  color: '#E1306C' },
  formulaire:    { label: 'Formulaire',     color: '#f59e0b' },
  manuel:        { label: 'Manuel',         color: '#555' },
}

export async function fetchSourceData(workspaceId: string, period: number): Promise<SourceData[]> {
  const supabase = await createClient()
  const since = getSinceIso(period)

  let query = supabase
    .from('leads')
    .select('source')
    .eq('workspace_id', workspaceId)
  if (since) query = query.gte('created_at', since)

  const { data } = await query

  const counts: Record<string, number> = {}
  for (const row of data ?? []) {
    counts[row.source] = (counts[row.source] ?? 0) + 1
  }

  return Object.entries(counts)
    .map(([source, count]) => ({
      source,
      count,
      label: SOURCE_META[source]?.label ?? source,
      color: SOURCE_META[source]?.color ?? '#888',
    }))
    .sort((a, b) => b.count - a.count)
}

// ─── Meta status ─────────────────────────────────────────────────────────────

export async function fetchMetaStats(workspaceId: string): Promise<MetaStats> {
  const supabase = await createClient()
  const { data: integration } = await supabase
    .from('integrations')
    .select('credentials_encrypted')
    .eq('workspace_id', workspaceId)
    .eq('type', 'meta')
    .eq('is_active', true)
    .maybeSingle()

  if (!integration?.credentials_encrypted) {
    return { isConnected: false, costPerLead: null, roas: null, budgetSpent: null }
  }

  try {
    const credentials: MetaCredentials = JSON.parse(decrypt(integration.credentials_encrypted))

    if (!credentials.ad_account_id) {
      return { isConnected: true, costPerLead: null, roas: null, budgetSpent: null }
    }

    const now = new Date()
    const from = new Date()
    from.setDate(from.getDate() - 30)

    const rows = await getInsights(credentials.ad_account_id, credentials.user_access_token, {
      level: 'account',
      dateFrom: from.toISOString().slice(0, 10),
      dateTo: now.toISOString().slice(0, 10),
    })

    let totalSpend = 0
    let totalLeads = 0
    for (const row of rows) {
      totalSpend += parseFloat(row.spend || '0')
      totalLeads += extractLeadCount(row)
    }

    return {
      isConnected: true,
      costPerLead: totalLeads > 0 ? Math.round((totalSpend / totalLeads) * 100) / 100 : null,
      roas: null,
      budgetSpent: Math.round(totalSpend * 100) / 100,
    }
  } catch (err) {
    console.warn('Failed to fetch Meta stats (non-blocking):', err)
    return { isConnected: true, costPerLead: null, roas: null, budgetSpent: null }
  }
}

import { createClient } from '@/lib/supabase/server'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface KpiValue {
  current: number
  previous: number
  delta_pct: number | null
  sparkline: number[] // 14 points
  format?: 'currency' | 'percent' | 'integer'
}

export interface DashboardKpisV2 {
  cash_collected: KpiValue
  show_rate: KpiValue
  close_rate: KpiValue
  cost_per_booking: KpiValue | null
  pipeline_value: KpiValue
}

export interface NextBooking {
  id: string
  lead_id: string
  lead_name: string
  scheduled_at: string
  source: string | null
  email: string | null
  phone: string | null
  meet_url: string | null
  location_type: string | null
}

export interface DayPlanItem {
  type: 'booking' | 'hot_lead' | 'overdue_followup' | 'no_show'
  lead_id: string
  lead_name: string
  context: string
  scheduled_at?: string
  priority: number
}

export interface PriorityLead {
  id: string
  name: string
  context: string
  last_activity: string | null
  status: string
}

export interface FunnelData {
  leads: number
  bookings: number
  showed: number
  closed: number
}

export interface ActivityEventV2 {
  id: string
  type: 'new_lead' | 'new_booking' | 'call_done' | 'deal_closed' | 'follow_up_done'
  description: string
  created_at: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pctDelta(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null
  return Math.round(((current - previous) / previous) * 100)
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function buildSparkline(rows: { date: string; value: number }[], days = 14): number[] {
  const map = new Map(rows.map(r => [r.date, r.value]))
  const out: number[] = []
  const now = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    out.push(map.get(dayKey(d)) ?? 0)
  }
  return out
}

// ─── KPIs étendus ────────────────────────────────────────────────────────────

export async function fetchKpisV2(workspaceId: string, period: number): Promise<DashboardKpisV2> {
  const supabase = await createClient()
  const now = new Date()
  const sinceCurrent = new Date(now.getTime() - period * 86400000).toISOString()
  const sincePrevious = new Date(now.getTime() - period * 2 * 86400000).toISOString()
  const sparklineSince = new Date(now.getTime() - 14 * 86400000).toISOString()

  // Cash collecté
  const [dealsCurrent, dealsPrevious, dealsSparkline] = await Promise.all([
    supabase
      .from('deals')
      .select('cash_collected, created_at')
      .eq('workspace_id', workspaceId)
      .gte('created_at', sinceCurrent),
    supabase
      .from('deals')
      .select('cash_collected')
      .eq('workspace_id', workspaceId)
      .gte('created_at', sincePrevious)
      .lt('created_at', sinceCurrent),
    supabase
      .from('deals')
      .select('cash_collected, created_at')
      .eq('workspace_id', workspaceId)
      .gte('created_at', sparklineSince),
  ])

  const cashCurrent = (dealsCurrent.data ?? []).reduce((s, d) => s + Number(d.cash_collected ?? 0), 0)
  const cashPrevious = (dealsPrevious.data ?? []).reduce((s, d) => s + Number(d.cash_collected ?? 0), 0)

  const cashByDay = new Map<string, number>()
  for (const d of dealsSparkline.data ?? []) {
    const k = dayKey(new Date(d.created_at))
    cashByDay.set(k, (cashByDay.get(k) ?? 0) + Number(d.cash_collected ?? 0))
  }
  const cashSparkline = buildSparkline(
    Array.from(cashByDay, ([date, value]) => ({ date, value }))
  )

  // Show rate (calls passés)
  const [pastCallsCurrent, pastCallsPrev] = await Promise.all([
    supabase
      .from('calls')
      .select('outcome, scheduled_at')
      .eq('workspace_id', workspaceId)
      .gte('scheduled_at', sinceCurrent)
      .lt('scheduled_at', now.toISOString()),
    supabase
      .from('calls')
      .select('outcome')
      .eq('workspace_id', workspaceId)
      .gte('scheduled_at', sincePrevious)
      .lt('scheduled_at', sinceCurrent),
  ])

  const showOutcomes = ['fait', 'closed', 'present']
  const showCurrent = pastCallsCurrent.data?.filter(c => showOutcomes.includes(c.outcome ?? '')).length ?? 0
  const totalCurrent = pastCallsCurrent.data?.filter(c => c.outcome).length ?? 0
  const showRateCurrent = totalCurrent > 0 ? Math.round((showCurrent / totalCurrent) * 100) : 0

  const showPrevious = pastCallsPrev.data?.filter(c => showOutcomes.includes(c.outcome ?? '')).length ?? 0
  const totalPrev = pastCallsPrev.data?.filter(c => c.outcome).length ?? 0
  const showRatePrevious = totalPrev > 0 ? Math.round((showPrevious / totalPrev) * 100) : 0

  // Close rate
  const closedRes = await supabase
    .from('deals')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('status', 'active')
    .gte('created_at', sinceCurrent)
  const dealsClosed = closedRes.count ?? 0

  const closeRateCurrent = showCurrent > 0
    ? Math.round((dealsClosed / showCurrent) * 100)
    : 0

  // Pipeline value
  const { data: openDeals } = await supabase
    .from('deals')
    .select('amount')
    .eq('workspace_id', workspaceId)
    .eq('status', 'active')

  const pipelineValue = (openDeals ?? []).reduce((s, d) => s + Number(d.amount ?? 0), 0)

  return {
    cash_collected: {
      current: cashCurrent,
      previous: cashPrevious,
      delta_pct: pctDelta(cashCurrent, cashPrevious),
      sparkline: cashSparkline,
      format: 'currency',
    },
    show_rate: {
      current: showRateCurrent,
      previous: showRatePrevious,
      delta_pct: pctDelta(showRateCurrent, showRatePrevious),
      sparkline: [],
      format: 'percent',
    },
    close_rate: {
      current: closeRateCurrent,
      previous: 0,
      delta_pct: null,
      sparkline: [],
      format: 'percent',
    },
    cost_per_booking: null,
    pipeline_value: {
      current: pipelineValue,
      previous: 0,
      delta_pct: null,
      sparkline: [],
      format: 'currency',
    },
  }
}

// ─── Hero : prochain RDV + day plan ──────────────────────────────────────────

export async function getNextBooking(workspaceId: string): Promise<NextBooking | null> {
  const supabase = await createClient()
  const now = new Date().toISOString()
  const in7d = new Date(Date.now() + 7 * 86400000).toISOString()

  const { data } = await supabase
    .from('bookings')
    .select('id, scheduled_at, meet_url, location_type, leads(id, first_name, last_name, source, email, phone)')
    .eq('workspace_id', workspaceId)
    .gte('scheduled_at', now)
    .lte('scheduled_at', in7d)
    .neq('status', 'cancelled')
    .order('scheduled_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!data) return null
  const lead = data.leads as unknown as {
    id: string; first_name: string; last_name: string; source: string | null; email: string | null; phone: string | null
  }

  return {
    id: data.id,
    lead_id: lead.id,
    lead_name: `${lead.first_name} ${lead.last_name}`,
    scheduled_at: data.scheduled_at,
    source: lead.source,
    email: lead.email,
    phone: lead.phone,
    meet_url: data.meet_url,
    location_type: data.location_type,
  }
}

export async function getDayPlan(workspaceId: string): Promise<DayPlanItem[]> {
  const supabase = await createClient()
  const now = new Date()
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString()

  const items: DayPlanItem[] = []

  const [bookings, fus, noShows] = await Promise.all([
    supabase
      .from('bookings')
      .select('scheduled_at, leads(id, first_name, last_name)')
      .eq('workspace_id', workspaceId)
      .gte('scheduled_at', now.toISOString())
      .lte('scheduled_at', todayEnd)
      .neq('status', 'cancelled'),
    supabase
      .from('follow_ups')
      .select('scheduled_at, leads(id, first_name, last_name)')
      .eq('workspace_id', workspaceId)
      .eq('status', 'en_attente')
      .lt('scheduled_at', now.toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(3),
    supabase
      .from('calls')
      .select('scheduled_at, leads(id, first_name, last_name)')
      .eq('workspace_id', workspaceId)
      .eq('outcome', 'no_show')
      .gte('scheduled_at', sevenDaysAgo)
      .limit(2),
  ])

  for (const b of bookings.data ?? []) {
    const l = b.leads as unknown as { id: string; first_name: string; last_name: string }
    if (!l) continue
    const time = new Date(b.scheduled_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    items.push({
      type: 'booking',
      lead_id: l.id,
      lead_name: `${l.first_name} ${l.last_name}`,
      context: `RDV ${time}`,
      scheduled_at: b.scheduled_at,
      priority: 1,
    })
  }

  for (const f of fus.data ?? []) {
    const l = f.leads as unknown as { id: string; first_name: string; last_name: string }
    if (!l) continue
    const days = Math.max(1, Math.floor((Date.now() - new Date(f.scheduled_at).getTime()) / 86400000))
    items.push({
      type: 'overdue_followup',
      lead_id: l.id,
      lead_name: `${l.first_name} ${l.last_name}`,
      context: `Relance en retard ${days}j`,
      priority: 2,
    })
  }

  for (const c of noShows.data ?? []) {
    const l = c.leads as unknown as { id: string; first_name: string; last_name: string }
    if (!l) continue
    items.push({
      type: 'no_show',
      lead_id: l.id,
      lead_name: `${l.first_name} ${l.last_name}`,
      context: 'No-show à reprogrammer',
      priority: 3,
    })
  }

  return items.sort((a, b) => a.priority - b.priority).slice(0, 7)
}

// ─── Listes prioritaires (algo pur) ──────────────────────────────────────────

export async function getRiskLeads(workspaceId: string): Promise<PriorityLead[]> {
  const supabase = await createClient()
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString()

  const { data } = await supabase
    .from('leads')
    .select('id, first_name, last_name, status, last_activity_at')
    .eq('workspace_id', workspaceId)
    .not('status', 'in', '(clos,dead)')
    .lt('last_activity_at', sevenDaysAgo)
    .order('last_activity_at', { ascending: true })
    .limit(5)

  return (data ?? []).map(l => {
    const days = l.last_activity_at
      ? Math.floor((Date.now() - new Date(l.last_activity_at).getTime()) / 86400000)
      : 999
    return {
      id: l.id,
      name: `${l.first_name} ${l.last_name}`,
      context: `Inactif ${days}j`,
      last_activity: l.last_activity_at,
      status: l.status,
    }
  })
}

export async function getHotLeads(workspaceId: string): Promise<PriorityLead[]> {
  const supabase = await createClient()
  const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString()

  const { data } = await supabase
    .from('leads')
    .select('id, first_name, last_name, status, last_activity_at, tags')
    .eq('workspace_id', workspaceId)
    .gte('last_activity_at', twoDaysAgo)
    .not('status', 'in', '(clos,dead)')
    .order('last_activity_at', { ascending: false })
    .limit(20)

  const filtered = (data ?? []).filter(l =>
    (l.tags && (l.tags.includes('chaud') || l.tags.includes('VIP'))) ||
    l.status === 'nouveau_lead'
  ).slice(0, 5)

  return filtered.map(l => {
    const hrs = l.last_activity_at
      ? Math.max(1, Math.floor((Date.now() - new Date(l.last_activity_at).getTime()) / 3600000))
      : 0
    return {
      id: l.id,
      name: `${l.first_name} ${l.last_name}`,
      context: `Actif il y a ${hrs}h`,
      last_activity: l.last_activity_at,
      status: l.status,
    }
  })
}

// ─── Funnel ──────────────────────────────────────────────────────────────────

export async function getFunnelData(workspaceId: string, period: number): Promise<FunnelData> {
  const supabase = await createClient()
  const since = new Date(Date.now() - period * 86400000).toISOString()

  // Cohort: leads créés dans la période
  const { data: leadsData } = await supabase
    .from('leads')
    .select('id')
    .eq('workspace_id', workspaceId)
    .gte('created_at', since)
    .limit(5000)

  const leadIds = (leadsData ?? []).map(l => l.id)
  const leadsCount = leadIds.length

  if (leadIds.length === 0) {
    return { leads: 0, bookings: 0, showed: 0, closed: 0 }
  }

  // Pour ces leads, compter ceux qui ont booké / show / clos (uniques)
  const [bookingsRows, callsRows, dealsRows] = await Promise.all([
    supabase.from('bookings').select('lead_id').in('lead_id', leadIds).neq('status', 'cancelled'),
    supabase.from('calls').select('lead_id').in('lead_id', leadIds).in('outcome', ['fait', 'closed', 'present']),
    supabase.from('deals').select('lead_id').in('lead_id', leadIds).eq('status', 'active'),
  ])

  const uniqBooked = new Set((bookingsRows.data ?? []).map(b => b.lead_id)).size
  const uniqShowed = new Set((callsRows.data ?? []).map(c => c.lead_id)).size
  const uniqClosed = new Set((dealsRows.data ?? []).map(d => d.lead_id)).size

  return {
    leads: leadsCount,
    bookings: uniqBooked,
    showed: uniqShowed,
    closed: uniqClosed,
  }
}

// ─── Activity ─────────────────────────────────────────────────────────────────

export async function getRecentActivityV2(workspaceId: string): Promise<ActivityEventV2[]> {
  const supabase = await createClient()
  const since = new Date(Date.now() - 7 * 86400000).toISOString()

  const [leads, bookings, calls, deals] = await Promise.all([
    supabase.from('leads').select('id, first_name, last_name, source, created_at').eq('workspace_id', workspaceId).gte('created_at', since).order('created_at', { ascending: false }).limit(8),
    supabase.from('bookings').select('id, created_at, leads(first_name, last_name)').eq('workspace_id', workspaceId).gte('created_at', since).order('created_at', { ascending: false }).limit(8),
    supabase.from('calls').select('id, type, outcome, created_at, leads(first_name, last_name)').eq('workspace_id', workspaceId).not('outcome', 'is', null).gte('created_at', since).order('created_at', { ascending: false }).limit(8),
    supabase.from('deals').select('id, amount, created_at, leads(first_name, last_name)').eq('workspace_id', workspaceId).eq('status', 'active').gte('created_at', since).order('created_at', { ascending: false }).limit(5),
  ])

  const events: ActivityEventV2[] = []

  for (const l of leads.data ?? []) {
    events.push({
      id: `l-${l.id}`,
      type: 'new_lead',
      description: `${l.first_name} ${l.last_name} ajouté(e) (${(l.source ?? 'manuel').replaceAll('_', ' ')})`,
      created_at: l.created_at,
    })
  }
  for (const b of bookings.data ?? []) {
    const lead = b.leads as unknown as { first_name: string; last_name: string }
    if (!lead) continue
    events.push({
      id: `b-${b.id}`,
      type: 'new_booking',
      description: `${lead.first_name} ${lead.last_name} a réservé un RDV`,
      created_at: b.created_at,
    })
  }
  for (const c of calls.data ?? []) {
    const lead = c.leads as unknown as { first_name: string; last_name: string }
    if (!lead) continue
    events.push({
      id: `c-${c.id}`,
      type: 'call_done',
      description: `Call ${c.type} avec ${lead.first_name} ${lead.last_name} — ${c.outcome}`,
      created_at: c.created_at,
    })
  }
  for (const d of deals.data ?? []) {
    const lead = d.leads as unknown as { first_name: string; last_name: string }
    if (!lead) continue
    events.push({
      id: `d-${d.id}`,
      type: 'deal_closed',
      description: `Deal closé avec ${lead.first_name} ${lead.last_name} — ${Number(d.amount).toLocaleString('fr-FR')}€`,
      created_at: d.created_at,
    })
  }

  return events.sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 15)
}

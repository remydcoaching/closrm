import { createClient } from '@/lib/supabase/server'

// ─── Types retournés par les queries ─────────────────────────────────────────

export interface DashboardKpis {
  newLeads: number
  plannedCalls: number
  closedDeals: number
  closingRate: number | null  // null si aucun appel planifié (évite division par zéro)
}

export interface UpcomingCall {
  id: string
  lead_id: string
  lead_name: string
  type: 'setting' | 'closing'
  scheduled_at: string
  category: 'overdue' | 'today' | 'upcoming'
}

export interface OverdueFollowUp {
  id: string
  lead_id: string
  lead_name: string
  channel: 'whatsapp' | 'email' | 'manuel'
  scheduled_at: string
  days_overdue: number
}

export interface ActivityEvent {
  id: string
  type: 'new_lead' | 'call_logged'
  description: string
  created_at: string
}

// ─── KPIs ────────────────────────────────────────────────────────────────────

export async function fetchKpis(workspaceId: string, period: number): Promise<DashboardKpis> {
  const supabase = await createClient()
  const since = new Date()
  since.setDate(since.getDate() - period)
  const sinceIso = since.toISOString()

  const [leadsRes, callsRes, closedRes] = await Promise.all([
    supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .gte('created_at', sinceIso),
    supabase
      .from('calls')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .gte('created_at', sinceIso),
    supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('status', 'clos')
      .gte('updated_at', sinceIso),
  ])

  const newLeads = leadsRes.count ?? 0
  const plannedCalls = callsRes.count ?? 0
  const closedDeals = closedRes.count ?? 0
  const closingRate = plannedCalls > 0 ? Math.round((closedDeals / plannedCalls) * 100) : null

  return { newLeads, plannedCalls, closedDeals, closingRate }
}

// ─── Prochains appels ────────────────────────────────────────────────────────

export async function fetchUpcomingCalls(workspaceId: string): Promise<UpcomingCall[]> {
  const supabase = await createClient()
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()

  // Récupère : appels en retard (outcome null + date passée) + appels dans les 7 prochains jours
  const { data } = await supabase
    .from('calls')
    .select('id, lead_id, type, scheduled_at, outcome, leads(first_name, last_name)')
    .eq('workspace_id', workspaceId)
    .or(
      `and(outcome.is.null,scheduled_at.lt.${todayStart}),` +
      `and(scheduled_at.gte.${todayStart},scheduled_at.lte.${in7Days})`
    )
    .order('scheduled_at', { ascending: true })
    .limit(6)

  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString()

  return (data ?? []).map((row) => {
    const lead = row.leads as unknown as { first_name: string; last_name: string }
    let category: 'overdue' | 'today' | 'upcoming' = 'upcoming'
    if (!row.outcome && row.scheduled_at < todayStart) {
      category = 'overdue'
    } else if (row.scheduled_at >= todayStart && row.scheduled_at <= todayEnd) {
      category = 'today'
    }
    return {
      id: row.id,
      lead_id: row.lead_id,
      lead_name: `${lead.first_name} ${lead.last_name}`,
      type: row.type as 'setting' | 'closing',
      scheduled_at: row.scheduled_at,
      category,
    }
  })
}

// ─── Follow-ups en retard ─────────────────────────────────────────────────────

export async function fetchOverdueFollowUps(workspaceId: string): Promise<OverdueFollowUp[]> {
  const supabase = await createClient()
  const now = new Date().toISOString()

  const { data } = await supabase
    .from('follow_ups')
    .select('id, lead_id, channel, scheduled_at, leads(first_name, last_name)')
    .eq('workspace_id', workspaceId)
    .eq('status', 'en_attente')
    .lt('scheduled_at', now)
    .order('scheduled_at', { ascending: true })
    .limit(6)

  return (data ?? []).map((row) => {
    const lead = row.leads as unknown as { first_name: string; last_name: string }
    const daysOverdue = Math.max(1, Math.floor(
      (Date.now() - new Date(row.scheduled_at).getTime()) / (1000 * 60 * 60 * 24)
    ))
    return {
      id: row.id,
      lead_id: row.lead_id,
      lead_name: `${lead.first_name} ${lead.last_name}`,
      channel: row.channel as 'whatsapp' | 'email' | 'manuel',
      scheduled_at: row.scheduled_at,
      days_overdue: daysOverdue,
    }
  })
}

// ─── Activité récente ─────────────────────────────────────────────────────────

export async function fetchRecentActivity(workspaceId: string): Promise<ActivityEvent[]> {
  const supabase = await createClient()

  const [leadsRes, callsRes] = await Promise.all([
    supabase
      .from('leads')
      .select('id, first_name, last_name, source, created_at')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('calls')
      .select('id, type, created_at, leads(first_name, last_name)')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  const events: ActivityEvent[] = []

  for (const lead of leadsRes.data ?? []) {
    events.push({
      id: `lead-${lead.id}`,
      type: 'new_lead',
      description: `${lead.first_name} ${lead.last_name} ajouté(e) (${lead.source.replace('_', ' ')})`,
      created_at: lead.created_at,
    })
  }

  for (const call of callsRes.data ?? []) {
    const lead = call.leads as unknown as { first_name: string; last_name: string }
    events.push({
      id: `call-${call.id}`,
      type: 'call_logged',
      description: `${lead.first_name} ${lead.last_name} — appel ${call.type} enregistré`,
      created_at: call.created_at,
    })
  }

  return events
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 10)
}

import type { SupabaseClient } from '@supabase/supabase-js'

export type PriorityCategory =
  | 'relance_du_jour'
  | 'relance_en_retard'
  | 'engagement_instagram'
  | 'jamais_recontacte'
  | 'premier_message'

export interface PriorityLead {
  lead_id: string
  category: PriorityCategory
}

const CATEGORY_ORDER: PriorityCategory[] = [
  'relance_du_jour',
  'relance_en_retard',
  'engagement_instagram',
  'jamais_recontacte',
  'premier_message',
]

/**
 * Le setter choisit quels types de leads travailler pendant la session (ex:
 * uniquement "premiers contacts", ou "relances" sans les nouveaux leads).
 * "relance_du_jour" reste toujours inclus côté UI (case cochée non
 * décochable) mais cette fonction reste pure : elle applique simplement le
 * filtre qu'on lui donne.
 */
export interface SessionCategoryFilter {
  relanceEnRetard: boolean
  premierContact: boolean // regroupe premier_message + engagement_instagram
  jamaisRecontacte: boolean
}

export async function buildPriorityQueue(
  supabase: SupabaseClient,
  workspaceId: string,
  staleThresholdDays: number,
  categoryFilter: SessionCategoryFilter
): Promise<PriorityLead[]> {
  const now = new Date()
  // Les relances n'ont jamais d'heure précise (seulement un jour, ex J+3) —
  // même logique que l'écran Relances existant (useFollowUps.ts) : "du jour"
  // = toute la journée en cours, "en retard" = strictement avant aujourd'hui.
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date(now)
  todayEnd.setHours(23, 59, 59, 999)
  const staleBefore = new Date(now.getTime() - staleThresholdDays * 86_400_000).toISOString()

  const byCategory = new Map<PriorityCategory, string[]>()

  // Un lead marqué "a répondu" (dm_conversation_active_at non-null) ne doit
  // jamais réapparaître dans une file de session — le setter continue la
  // conversation manuellement, ClosRM ne doit pas lui proposer une relance.
  const { data: activeConversationLeads } = await supabase
    .from('leads')
    .select('id')
    .eq('workspace_id', workspaceId)
    .not('dm_conversation_active_at', 'is', null)
  const activeConversationLeadIds = new Set((activeConversationLeads ?? []).map((r) => r.id as string))

  const { data: pendingFollowUps } = await supabase
    .from('follow_ups')
    .select('lead_id, scheduled_at')
    .eq('workspace_id', workspaceId)
    .eq('status', 'en_attente')
    .order('scheduled_at', { ascending: true })
  const pendingFollowUpLeadIds = new Set((pendingFollowUps ?? []).map((r) => r.lead_id as string))

  byCategory.set(
    'relance_du_jour',
    (pendingFollowUps ?? [])
      .filter((r) => typeof r.scheduled_at === 'string' && r.scheduled_at >= todayStart.toISOString() && r.scheduled_at <= todayEnd.toISOString())
      .map((r) => r.lead_id as string)
      .filter((leadId) => !activeConversationLeadIds.has(leadId))
  )

  byCategory.set(
    'relance_en_retard',
    (pendingFollowUps ?? [])
      .filter((r) => typeof r.scheduled_at === 'string' && r.scheduled_at < todayStart.toISOString())
      .map((r) => r.lead_id as string)
      .filter((leadId) => !activeConversationLeadIds.has(leadId))
  )

  // Leads with a pending follow-up (any date) must not also surface under
  // engagement_instagram / jamais_recontacte — they're already queued, either
  // waiting to become due or already captured by relance_du_jour/en_retard above.
  const { data: engagedLeads } = await supabase
    .from('instagram_interactions')
    .select('lead_id, last_seen_at')
    .eq('workspace_id', workspaceId)
    .order('last_seen_at', { ascending: true })
  byCategory.set(
    'engagement_instagram',
    (engagedLeads ?? [])
      .map((r) => r.lead_id as string)
      .filter((leadId) => !pendingFollowUpLeadIds.has(leadId))
      .filter((leadId) => !activeConversationLeadIds.has(leadId))
  )

  const { data: staleLeads } = await supabase
    .from('leads')
    .select('id, last_activity_at')
    .eq('workspace_id', workspaceId)
    .lt('last_activity_at', staleBefore)
    .order('last_activity_at', { ascending: true })
  byCategory.set(
    'jamais_recontacte',
    (staleLeads ?? [])
      .filter((r) => typeof r.last_activity_at === 'string' && r.last_activity_at < staleBefore)
      .map((r) => r.id as string)
      .filter((leadId) => !pendingFollowUpLeadIds.has(leadId))
      .filter((leadId) => !activeConversationLeadIds.has(leadId))
  )

  // "Never contacted" means no outbound contact has ever been logged for the
  // lead — there is no reliable NULL marker on leads.last_activity_at (it
  // defaults to now() and is only ever advanced forward), so the real signal
  // is the absence of any follow_ups or calls row for that lead.
  const [{ data: followUpLeadRows }, { data: callLeadRows }] = await Promise.all([
    supabase.from('follow_ups').select('lead_id').eq('workspace_id', workspaceId),
    supabase.from('calls').select('lead_id').eq('workspace_id', workspaceId),
  ])
  const contactedLeadIds = new Set([
    ...(followUpLeadRows ?? []).map((r) => r.lead_id as string),
    ...(callLeadRows ?? []).map((r) => r.lead_id as string),
  ])

  const { data: allLeads } = await supabase
    .from('leads')
    .select('id, created_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: true })
  byCategory.set(
    'premier_message',
    (allLeads ?? [])
      .map((r) => r.id as string)
      .filter((leadId) => !contactedLeadIds.has(leadId))
      .filter((leadId) => !activeConversationLeadIds.has(leadId))
  )

  const includedCategories = new Set<PriorityCategory>(['relance_du_jour'])
  if (categoryFilter.relanceEnRetard) includedCategories.add('relance_en_retard')
  if (categoryFilter.premierContact) {
    includedCategories.add('engagement_instagram')
    includedCategories.add('premier_message')
  }
  if (categoryFilter.jamaisRecontacte) includedCategories.add('jamais_recontacte')

  const seen = new Set<string>()
  const queue: PriorityLead[] = []
  for (const category of CATEGORY_ORDER) {
    if (!includedCategories.has(category)) continue
    for (const leadId of byCategory.get(category) ?? []) {
      if (seen.has(leadId)) continue
      seen.add(leadId)
      queue.push({ lead_id: leadId, category })
    }
  }
  return queue
}

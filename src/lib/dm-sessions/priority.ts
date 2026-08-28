import type { SupabaseClient } from '@supabase/supabase-js'

export type PriorityCategory =
  | 'relance_en_retard'
  | 'engagement_instagram'
  | 'jamais_recontacte'
  | 'premier_message'

export interface PriorityLead {
  lead_id: string
  category: PriorityCategory
}

const CATEGORY_ORDER: PriorityCategory[] = [
  'relance_en_retard',
  'engagement_instagram',
  'jamais_recontacte',
  'premier_message',
]

export async function buildPriorityQueue(
  supabase: SupabaseClient,
  workspaceId: string,
  staleThresholdDays: number
): Promise<PriorityLead[]> {
  const now = new Date()
  const staleBefore = new Date(now.getTime() - staleThresholdDays * 86_400_000).toISOString()

  const byCategory = new Map<PriorityCategory, string[]>()

  const { data: overdueFollowUps } = await supabase
    .from('follow_ups')
    .select('lead_id, scheduled_at')
    .eq('workspace_id', workspaceId)
    .eq('status', 'en_attente')
    .lt('scheduled_at', now.toISOString())
    .order('scheduled_at', { ascending: true })
  byCategory.set('relance_en_retard', (overdueFollowUps ?? []).map((r) => r.lead_id as string))

  const { data: engagedLeads } = await supabase
    .from('instagram_interactions')
    .select('lead_id, last_seen_at')
    .eq('workspace_id', workspaceId)
    .order('last_seen_at', { ascending: true })
  byCategory.set('engagement_instagram', (engagedLeads ?? []).map((r) => r.lead_id as string))

  const { data: staleLeads } = await supabase
    .from('leads')
    .select('id, last_activity_at')
    .eq('workspace_id', workspaceId)
    .lt('last_activity_at', staleBefore)
    .order('last_activity_at', { ascending: true })
  byCategory.set('jamais_recontacte', (staleLeads ?? []).map((r) => r.id as string))

  const { data: newLeads } = await supabase
    .from('leads')
    .select('id, last_activity_at')
    .eq('workspace_id', workspaceId)
    .is('last_activity_at', null)
    .order('created_at', { ascending: true })
  byCategory.set('premier_message', (newLeads ?? []).map((r) => r.id as string))

  const seen = new Set<string>()
  const queue: PriorityLead[] = []
  for (const category of CATEGORY_ORDER) {
    for (const leadId of byCategory.get(category) ?? []) {
      if (seen.has(leadId)) continue
      seen.add(leadId)
      queue.push({ lead_id: leadId, category })
    }
  }
  return queue
}

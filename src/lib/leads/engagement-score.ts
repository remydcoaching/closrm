// Shared engagement scoring — the SAME logic GET /api/leads/hot already
// uses (workspace-configurable weights via engagement_scoring_rules, no
// invented numbers), factored out so it can also answer "what is this one
// lead's score, and why" for the Lead Intelligence Profile, without a
// second scoring system. /api/leads/hot is not modified — it keeps its own
// query shape (all leads in a window) and can migrate to this helper later
// without behavior change.
import type { SupabaseClient } from '@supabase/supabase-js'

export const DEFAULT_SCORING = { like: 1, comment: 3, dm: 5, mention: 2 } as const

export interface EngagementSignal {
  key: string
  label: string
  detail: string
}

export interface EngagementScoreResult {
  score: number
  likesCount: number
  commentsCount: number
  dmCount: number
  mentionCount: number
  totalInteractions: number
  distinctContentCount: number
  firstInteractionAt: string | null
  lastInteractionAt: string | null
  /** Human-readable, data-backed reasons — never a fabricated "seems interested". */
  signals: EngagementSignal[]
}

async function loadScoringRules(supabase: SupabaseClient, workspaceId: string): Promise<Record<string, number>> {
  const { data: rules } = await supabase
    .from('engagement_scoring_rules')
    .select('interaction_type, points')
    .eq('workspace_id', workspaceId)

  const scoring: Record<string, number> = { ...DEFAULT_SCORING }
  for (const rule of rules ?? []) {
    scoring[rule.interaction_type as string] = rule.points as number
  }
  return scoring
}

/**
 * Computes the engagement score AND the reasons behind it for a single
 * lead, from instagram_interactions + follow_ups + leads.last_activity_at —
 * the exact same tables /api/leads/hot and buildPriorityQueue (DM Sessions)
 * already read. Returns null if the lead has no interaction at all (score 0
 * is still a valid, non-null result — null means "lead not found or not in
 * this workspace").
 */
export async function computeEngagementScore(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  workspaceId: string,
  leadId: string,
): Promise<EngagementScoreResult | null> {
  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .select('id, last_activity_at')
    .eq('id', leadId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (leadError || !lead) return null

  const scoring = await loadScoringRules(supabase, workspaceId)

  const { data: interactions } = await supabase
    .from('instagram_interactions')
    .select('interaction_type, source_post_id, first_seen_at, last_seen_at')
    .eq('workspace_id', workspaceId)
    .eq('lead_id', leadId)

  const rows = interactions ?? []
  let score = 0
  let likesCount = 0
  let commentsCount = 0
  let dmCount = 0
  let mentionCount = 0
  let firstInteractionAt: string | null = null
  let lastInteractionAt: string | null = null
  const contentIds = new Set<string>()

  for (const row of rows) {
    const type = row.interaction_type as string
    score += scoring[type] ?? 1
    if (type === 'like') likesCount += 1
    if (type === 'comment') commentsCount += 1
    if (type === 'dm') dmCount += 1
    if (type === 'mention') mentionCount += 1
    if (row.source_post_id) contentIds.add(row.source_post_id as string)
    const firstSeen = row.first_seen_at as string | null
    const lastSeen = row.last_seen_at as string | null
    if (firstSeen && (!firstInteractionAt || firstSeen < firstInteractionAt)) firstInteractionAt = firstSeen
    if (lastSeen && (!lastInteractionAt || lastSeen > lastInteractionAt)) lastInteractionAt = lastSeen
  }

  // Overdue follow-up and "never re-contacted" signals — same source data
  // buildPriorityQueue (DM Sessions) already uses, read here independently
  // so this function has no hard dependency on that module.
  const { data: pendingFollowUps } = await supabase
    .from('follow_ups')
    .select('scheduled_at')
    .eq('workspace_id', workspaceId)
    .eq('lead_id', leadId)
    .eq('status', 'en_attente')
    .order('scheduled_at', { ascending: true })
    .limit(1)

  const signals: EngagementSignal[] = []

  if (rows.length > 0) {
    signals.push({
      key: 'total_interactions',
      label: `${rows.length} interaction${rows.length > 1 ? 's' : ''} observée${rows.length > 1 ? 's' : ''}`,
      detail: `Sur ${contentIds.size} contenu${contentIds.size > 1 ? 's' : ''} différent${contentIds.size > 1 ? 's' : ''}.`,
    })
  }
  if (contentIds.size > 1) {
    signals.push({
      key: 'multi_content',
      label: 'Interactions sur plusieurs contenus',
      detail: `A interagi avec ${contentIds.size} contenus distincts, pas un seul post isolé.`,
    })
  }
  if (commentsCount > 0) {
    signals.push({
      key: 'has_commented',
      label: `${commentsCount} commentaire${commentsCount > 1 ? 's' : ''}`,
      detail: 'Un commentaire est un signal plus fort qu\'un like.',
    })
  }
  if (lastInteractionAt) {
    const daysSince = Math.floor((Date.now() - new Date(lastInteractionAt).getTime()) / 86_400_000)
    if (daysSince <= 3) {
      signals.push({
        key: 'recent_interaction',
        label: 'Interaction récente',
        detail: daysSince === 0 ? "Aujourd'hui." : `Il y a ${daysSince} jour${daysSince > 1 ? 's' : ''}.`,
      })
    }
  }
  const overdueFollowUp = pendingFollowUps?.[0]
  if (overdueFollowUp && new Date(overdueFollowUp.scheduled_at as string) < new Date()) {
    const daysLate = Math.floor((Date.now() - new Date(overdueFollowUp.scheduled_at as string).getTime()) / 86_400_000)
    signals.push({
      key: 'overdue_followup',
      label: `Relance en retard de ${daysLate} jour${daysLate > 1 ? 's' : ''}`,
      detail: 'Une relance planifiée n\'a pas encore été traitée.',
    })
  }
  if (lead.last_activity_at) {
    const daysSinceActivity = Math.floor((Date.now() - new Date(lead.last_activity_at as string).getTime()) / 86_400_000)
    if (daysSinceActivity >= 14) {
      signals.push({
        key: 'never_recontacted',
        label: `Jamais recontacté depuis ${daysSinceActivity} jours`,
        detail: 'Aucune activité commerciale récente enregistrée sur ce lead.',
      })
    }
  }

  return {
    score,
    likesCount,
    commentsCount,
    dmCount,
    mentionCount,
    totalInteractions: rows.length,
    distinctContentCount: contentIds.size,
    firstInteractionAt,
    lastInteractionAt,
    signals,
  }
}

// Everything the lead page needs, loaded in parallel on the server — one
// round-trip instead of four sequential ones (lead, journey, score, IG
// signal). Each piece is also exposed by its own route for the web.
import type { SupabaseClient } from '@supabase/supabase-js'
import { computeEngagementScore } from './engagement-score'
import { loadLeadJourney } from './lead-journey'

export async function loadLeadWithRelations(supabase: SupabaseClient, workspaceId: string, id: string) {
  const [{ data: lead, error }, { data: calls }, { data: followUps }] = await Promise.all([
    supabase.from('leads').select('*').eq('id', id).eq('workspace_id', workspaceId).single(),
    supabase.from('calls').select('*').eq('lead_id', id).eq('workspace_id', workspaceId).order('created_at', { ascending: false }),
    supabase.from('follow_ups').select('*').eq('lead_id', id).eq('workspace_id', workspaceId).order('scheduled_at', { ascending: true }),
  ])
  if (error || !lead) return null
  return { ...lead, calls: calls ?? [], follow_ups: followUps ?? [] }
}

/** Latest Ciblage observation of the lead's Instagram account (follows you?, counts). */
export async function loadInstagramSignal(
  supabase: SupabaseClient,
  workspaceId: string,
  lead: { instagram_user_id: string | null; instagram_handle: string | null },
) {
  let query = supabase
    .from('discovery_profiles')
    .select('follows_target, likes_count, comments_count, created_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(1)
  if (lead.instagram_user_id) query = query.eq('instagram_user_id', lead.instagram_user_id)
  else if (lead.instagram_handle) query = query.eq('instagram_username', lead.instagram_handle)
  else return null
  const { data } = await query.maybeSingle()
  return data ?? null
}

async function timed<T>(timings: Record<string, number>, key: string, p: Promise<T>): Promise<T> {
  const t0 = Date.now()
  try {
    return await p
  } finally {
    timings[key] = Date.now() - t0
  }
}

export async function loadLeadIntelligence(supabase: SupabaseClient, workspaceId: string, id: string) {
  const timings: Record<string, number> = {}
  const t0 = Date.now()
  const [lead, journey, score] = await Promise.all([
    timed(timings, 'lead', loadLeadWithRelations(supabase, workspaceId, id)),
    timed(timings, 'journey', loadLeadJourney(supabase, workspaceId, id)),
    timed(timings, 'score', computeEngagementScore(supabase, workspaceId, id)),
  ])
  if (!lead) return null
  const instagramSignal = await timed(timings, 'instagramSignal', loadInstagramSignal(supabase, workspaceId, lead))
  timings.total = Date.now() - t0
  return { data: { lead, journey, score, instagramSignal }, timings }
}

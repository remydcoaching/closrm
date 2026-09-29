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

export interface LeadStoryViews {
  count: number
  lastObservedAt: string | null
  highlights: string[]
  items: { storyPk: string; highlightTitle: string | null; takenAt: string | null; observedAt: string; thumbnailUrl: string | null }[]
}

/**
 * Stories (live and "à la une") this lead was seen viewing, from the
 * desktop's story-viewer collection. observedAt = when ClosRM saw them in
 * the viewer list (Instagram doesn't give the exact view time).
 */
export async function loadLeadStoryViews(supabase: SupabaseClient, workspaceId: string, leadId: string): Promise<LeadStoryViews> {
  const { data: seen } = await supabase
    .from('story_viewers')
    .select('story_pk, first_seen_at')
    .eq('workspace_id', workspaceId)
    .eq('matched_lead_id', leadId)
    .limit(1000)
  const rows = seen ?? []
  if (rows.length === 0) return { count: 0, lastObservedAt: null, highlights: [], items: [] }
  const pks = rows.map((r) => r.story_pk as string)
  let res = await supabase.from('story_view_stories').select('story_pk, taken_at, thumbnail_url, highlight_title').eq('workspace_id', workspaceId).in('story_pk', pks)
  if (res.error && /highlight_title/.test(res.error.message)) {
    res = (await supabase.from('story_view_stories').select('story_pk, taken_at, thumbnail_url').eq('workspace_id', workspaceId).in('story_pk', pks)) as typeof res
  }
  const stories = new Map(((res.data ?? []) as { story_pk: string; taken_at: string; thumbnail_url: string | null; highlight_title?: string | null }[]).map((st) => [st.story_pk, st]))
  const items = rows
    .map((r) => {
      const st = stories.get(r.story_pk as string)
      return {
        storyPk: r.story_pk as string,
        highlightTitle: st?.highlight_title ?? null,
        takenAt: st?.taken_at ?? null,
        observedAt: r.first_seen_at as string,
        thumbnailUrl: st?.thumbnail_url ?? null,
      }
    })
    .sort((a, b) => b.observedAt.localeCompare(a.observedAt))
  return {
    count: items.length,
    lastObservedAt: items[0]?.observedAt ?? null,
    highlights: [...new Set(items.map((i) => i.highlightTitle).filter((t): t is string => !!t))],
    items,
  }
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
  const [lead, journey, score, storyViews] = await Promise.all([
    timed(timings, 'lead', loadLeadWithRelations(supabase, workspaceId, id)),
    timed(timings, 'journey', loadLeadJourney(supabase, workspaceId, id)),
    timed(timings, 'score', computeEngagementScore(supabase, workspaceId, id)),
    timed(timings, 'storyViews', loadLeadStoryViews(supabase, workspaceId, id)),
  ])
  if (!lead) return null
  const instagramSignal = await timed(timings, 'instagramSignal', loadInstagramSignal(supabase, workspaceId, lead))
  timings.total = Date.now() - t0
  return { data: { lead, journey, score, instagramSignal, storyViews }, timings }
}

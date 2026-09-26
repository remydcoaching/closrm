// "Lurkers acheteurs sur vos N dernières stories" — aggregates story_viewers
// over the coach's last N collected stories: per viewer, how many of those
// stories they watched ("assiduité X sur N"), their last view, and whether
// anyone ever contacted them. A lurker = watches, never contacted
// (not a lead, or a lead nobody called/DMed — see audience-segments.ts).
import type { SupabaseClient } from '@supabase/supabase-js'
import { wasContacted } from './audience-segments'

export interface StoryRow {
  story_pk: string
  taken_at: string
  thumbnail_url: string | null
  viewer_count: number | null
  viewers_collected: number
}

export interface ViewerRow {
  story_pk: string
  instagram_user_id: string
  instagram_username: string
  full_name: string | null
  profile_pic_url: string | null
  is_verified: boolean | null
  matched_lead_id: string | null
}

export interface LeadContact {
  id: string
  status: string
  first_name: string
  last_name: string
  call_attempts: number
  dm_conversation_active_at: string | null
  dmSent: boolean
}

export interface StoryViewerSummary {
  userId: string
  username: string
  fullName: string | null
  profilePicUrl: string | null
  isVerified: boolean | null
  views: number
  lastViewedAt: string
  followsTarget: boolean | null
  lead: { id: string; status: string; name: string } | null
  contacted: boolean
}

export function summarizeViewers(
  stories: StoryRow[],
  viewers: ViewerRow[],
  leads: Map<string, LeadContact>,
  follows: Map<string, boolean>,
): { viewers: StoryViewerSummary[]; lurkers: number } {
  const takenAt = new Map(stories.map((s) => [s.story_pk, s.taken_at]))
  const byUser = new Map<string, StoryViewerSummary>()
  for (const v of viewers) {
    const at = takenAt.get(v.story_pk)
    if (!at) continue
    const lead = v.matched_lead_id ? leads.get(v.matched_lead_id) : undefined
    const s =
      byUser.get(v.instagram_user_id) ??
      ({
        userId: v.instagram_user_id,
        username: v.instagram_username,
        fullName: v.full_name,
        profilePicUrl: v.profile_pic_url,
        isVerified: v.is_verified,
        views: 0,
        lastViewedAt: at,
        followsTarget: follows.get(v.instagram_user_id) ?? null,
        lead: null,
        contacted: false,
      } satisfies StoryViewerSummary)
    s.views += 1
    if (at > s.lastViewedAt) s.lastViewedAt = at
    if (lead && !s.lead) {
      s.lead = { id: lead.id, status: lead.status, name: `${lead.first_name} ${lead.last_name}`.trim() }
      s.contacted = wasContacted({ callAttempts: lead.call_attempts, dmConversationActiveAt: lead.dm_conversation_active_at, dmSent: lead.dmSent })
    }
    byUser.set(v.instagram_user_id, s)
  }
  const list = [...byUser.values()].sort((a, b) => b.views - a.views || b.lastViewedAt.localeCompare(a.lastViewedAt))
  return { viewers: list, lurkers: list.filter((v) => !v.contacted).length }
}

const PAGE = 1000
const CHUNK = 200

const LURKERS_TTL_MS = 30_000
const lurkersCache = new Map<string, { at: number; value: Awaited<ReturnType<typeof loadStoryLurkersUncached>> }>()

/** Cached 30 s per (workspace, N): Leads cards, Audience and the collector all ask for it. */
export async function loadStoryLurkers(supabase: SupabaseClient, workspaceId: string, lastN: number) {
  const key = `${workspaceId}|${lastN}`
  const hit = lurkersCache.get(key)
  if (hit && Date.now() - hit.at < LURKERS_TTL_MS) return hit.value
  const value = await loadStoryLurkersUncached(supabase, workspaceId, lastN)
  lurkersCache.set(key, { at: Date.now(), value })
  return value
}

/** New viewers were just saved: drop cached aggregates for this workspace. */
export function invalidateStoryLurkers(workspaceId: string) {
  for (const k of lurkersCache.keys()) if (k.startsWith(`${workspaceId}|`)) lurkersCache.delete(k)
}

async function loadStoryLurkersUncached(supabase: SupabaseClient, workspaceId: string, lastN: number) {
  const { data: stories, error } = await supabase
    .from('story_view_stories')
    .select('story_pk, taken_at, thumbnail_url, viewer_count, viewers_collected')
    .eq('workspace_id', workspaceId)
    .order('taken_at', { ascending: false })
    .limit(lastN)
  if (error) throw new Error(error.message)
  const storyRows = (stories ?? []) as StoryRow[]
  const pks = storyRows.map((s) => s.story_pk)

  const viewers: ViewerRow[] = []
  if (pks.length > 0) {
    for (let from = 0; ; from += PAGE) {
      const { data, error: vErr } = await supabase
        .from('story_viewers')
        .select('story_pk, instagram_user_id, instagram_username, full_name, profile_pic_url, is_verified, matched_lead_id')
        .eq('workspace_id', workspaceId)
        .in('story_pk', pks)
        .range(from, from + PAGE - 1)
      if (vErr) throw new Error(vErr.message)
      viewers.push(...((data ?? []) as ViewerRow[]))
      if (!data || data.length < PAGE) break
    }
  }

  const leadIds = [...new Set(viewers.map((v) => v.matched_lead_id).filter((id): id is string => !!id))]
  const userIds = [...new Set(viewers.map((v) => v.instagram_user_id))]
  const chunks = <T,>(arr: T[]) => Array.from({ length: Math.ceil(arr.length / CHUNK) }, (_, i) => arr.slice(i * CHUNK, (i + 1) * CHUNK))

  // All lead / DM / follow lookups at once instead of chunk after chunk.
  const [leadChunks, followChunks] = await Promise.all([
    Promise.all(
      chunks(leadIds).map((ids) =>
        Promise.all([
          supabase.from('leads').select('id, status, first_name, last_name, call_attempts, dm_conversation_active_at').eq('workspace_id', workspaceId).in('id', ids),
          supabase.from('dm_session_items').select('lead_id').in('lead_id', ids).in('outcome', ['relaunched', 'replied']),
        ]),
      ),
    ),
    Promise.all(
      chunks(userIds).map((ids) =>
        supabase
          .from('discovery_profiles')
          .select('instagram_user_id, follows_target, created_at')
          .eq('workspace_id', workspaceId)
          .in('instagram_user_id', ids)
          .order('created_at', { ascending: false }),
      ),
    ),
  ])

  const leads = new Map<string, LeadContact>()
  for (const [{ data: l }, { data: dm }] of leadChunks) {
    const sent = new Set((dm ?? []).map((d) => d.lead_id as string))
    for (const row of l ?? []) {
      leads.set(row.id, { ...row, call_attempts: row.call_attempts ?? 0, dm_conversation_active_at: row.dm_conversation_active_at ?? null, dmSent: sent.has(row.id) } as LeadContact)
    }
  }
  const follows = new Map<string, boolean>()
  for (const { data } of followChunks) {
    for (const p of data ?? []) if (p.instagram_user_id && !follows.has(p.instagram_user_id)) follows.set(p.instagram_user_id, p.follows_target)
  }

  const summary = summarizeViewers(storyRows, viewers, leads, follows)
  return { stories: storyRows, totalStories: storyRows.length, ...summary }
}

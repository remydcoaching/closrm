// One story of the coach's account: its collected numbers and every
// identified viewer, with the matching lead, its 0-100 engagement score and
// interaction count when the viewer is already a lead ("Ils connaissaient
// déjà le compte").
import type { SupabaseClient } from '@supabase/supabase-js'
import { scoreLeads } from '@/lib/leads/engagement-score'
import type { ConfidenceLevel } from '@/lib/leads/confidence'
import { loadPeople } from './people'

export interface StoryDetailViewer {
  userId: string
  username: string
  fullName: string | null
  profilePicUrl: string | null
  isVerified: boolean | null
  hasLiked: boolean | null
  seenAt: string
  /** Score and level from the Leads Instagram index — every viewer, lead or not. */
  person: { score: number; confidence: ConfidenceLevel; interactions: number; firstAt: string | null; lastAt: string | null } | null
  /** This story is the first gesture ClosRM saw from them. */
  isNew: boolean
  lead: {
    id: string
    name: string
    status: string
    createdAt: string
    score: number
    totalInteractions: number
    distinctContentCount: number
    lastInteractionAt: string | null
  } | null
}

export async function loadStoryDetail(supabase: SupabaseClient, workspaceId: string, storyPk: string) {
  const storyQuery = (cols: string) => supabase.from('story_view_stories').select(cols).eq('workspace_id', workspaceId).eq('story_pk', storyPk).maybeSingle()
  const base = 'story_pk, taken_at, media_type, thumbnail_url, viewer_count, viewers_collected, last_collected_at'
  let storyRes = await storyQuery(`${base}, image_url, video_url, like_count, highlight_title`)
  if (storyRes.error) storyRes = await storyQuery(base)
  const story = storyRes.data as Record<string, unknown> | null

  const cols = 'instagram_user_id, instagram_username, full_name, profile_pic_url, is_verified, matched_lead_id, first_seen_at'
  let res = await supabase.from('story_viewers').select(`${cols}, has_liked`).eq('workspace_id', workspaceId).eq('story_pk', storyPk).limit(10000)
  // Migration 113 not applied yet: read without has_liked.
  if (res.error && /has_liked/.test(res.error.message)) {
    res = (await supabase.from('story_viewers').select(cols).eq('workspace_id', workspaceId).eq('story_pk', storyPk).limit(10000)) as typeof res
  }
  if (res.error) throw new Error(res.error.message)
  const rows = (res.data ?? []) as unknown as {
    instagram_user_id: string
    instagram_username: string
    full_name: string | null
    profile_pic_url: string | null
    is_verified: boolean | null
    matched_lead_id: string | null
    first_seen_at: string
    has_liked?: boolean | null
  }[]

  const leadIds = [...new Set(rows.map((r) => r.matched_lead_id).filter((id): id is string => !!id))]
  const leads = new Map<string, { first_name: string; last_name: string; status: string; created_at: string }>()
  for (let i = 0; i < leadIds.length; i += 200) {
    const { data } = await supabase.from('leads').select('id, first_name, last_name, status, created_at').eq('workspace_id', workspaceId).in('id', leadIds.slice(i, i + 200))
    for (const l of data ?? []) leads.set(l.id, l)
  }
  const [scores, people] = await Promise.all([scoreLeads(supabase, workspaceId, leadIds), loadPeople(supabase, workspaceId)])
  const personOf = new Map(people.rows.map((r) => [r.username, r]))
  const takenAt = (story?.taken_at as string | undefined) ?? null

  const viewers: StoryDetailViewer[] = rows.map((r) => {
    const l = r.matched_lead_id ? leads.get(r.matched_lead_id) : undefined
    const sc = r.matched_lead_id ? scores.get(r.matched_lead_id) : undefined
    return {
      userId: r.instagram_user_id,
      username: r.instagram_username,
      fullName: r.full_name,
      profilePicUrl: r.profile_pic_url,
      isVerified: r.is_verified,
      hasLiked: r.has_liked ?? null,
      seenAt: r.first_seen_at,
      person: (() => {
        const pr = personOf.get(r.instagram_username.toLowerCase())
        return pr ? { score: pr.score, confidence: pr.confidence, interactions: pr.interactions, firstAt: pr.firstAt, lastAt: pr.lastAt } : null
      })(),
      isNew: (() => {
        const first = personOf.get(r.instagram_username.toLowerCase())?.firstAt
        return !first || !takenAt || first >= takenAt
      })(),
      lead:
        l && r.matched_lead_id
          ? {
              id: r.matched_lead_id,
              name: `${l.first_name} ${l.last_name}`.trim(),
              status: l.status,
              createdAt: l.created_at,
              score: sc?.score ?? 0,
              totalInteractions: sc?.totalInteractions ?? 0,
              distinctContentCount: sc?.distinctContentCount ?? 0,
              lastInteractionAt: sc?.lastInteractionAt ?? null,
            }
          : null,
    }
  })
  // Leads first (best score first), then everyone else.
  viewers.sort((a, b) => (b.person?.score ?? b.lead?.score ?? -1) - (a.person?.score ?? a.lead?.score ?? -1) || a.username.localeCompare(b.username))

  return {
    story,
    viewers,
    counts: {
      viewers: viewers.length,
      reactions: viewers.filter((v) => v.hasLiked).length,
      leads: viewers.filter((v) => v.lead).length,
      newPeople: viewers.filter((v) => v.isNew).length,
      newVeryHigh: viewers.filter((v) => v.isNew && v.person?.confidence === 'tres_eleve').length,
    },
  }
}

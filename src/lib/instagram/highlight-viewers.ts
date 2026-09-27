// Stories "à la une" (highlights) and the people ClosRM saw viewing them.
// Instagram only lists a story's viewers during its first 48 h, so the
// viewers of a highlight are the ones collected while each of its stories
// was still in that window (story_viewers). This module:
//  - tags stored stories with the highlight they now belong to (the tray is
//    read by the desktop from the coach's session),
//  - aggregates, for a set of highlight stories, who viewed how many of them.
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'

export const VIEWER_WINDOW_MS = 48 * 3_600_000

export const highlightTagsSchema = z.object({
  items: z
    .array(
      z.object({
        pk: z.string().regex(/^\d{1,30}$/),
        highlightId: z.string().min(1).max(80),
        highlightTitle: z.string().max(200).nullish(),
      }),
    )
    .max(2000),
})

export type HighlightTags = z.infer<typeof highlightTagsSchema>

/** Pure: story pks grouped by highlight (a story in two collections keeps the first). */
export function groupTagsByHighlight(tags: HighlightTags): { highlightId: string; highlightTitle: string | null; pks: string[] }[] {
  const seen = new Set<string>()
  const groups = new Map<string, { highlightId: string; highlightTitle: string | null; pks: string[] }>()
  for (const t of tags.items) {
    if (seen.has(t.pk)) continue
    seen.add(t.pk)
    const g = groups.get(t.highlightId) ?? { highlightId: t.highlightId, highlightTitle: t.highlightTitle ?? null, pks: [] }
    g.pks.push(t.pk)
    groups.set(t.highlightId, g)
  }
  return [...groups.values()]
}

/** Writes highlight_id/title on stories ClosRM already stores (unknown pks are ignored). */
export async function tagHighlightStories(supabase: SupabaseClient, workspaceId: string, tags: HighlightTags) {
  let tagged = 0
  const errors: string[] = []
  for (const g of groupTagsByHighlight(tags)) {
    for (let i = 0; i < g.pks.length; i += 200) {
      const { data, error } = await supabase
        .from('story_view_stories')
        .update({ highlight_id: g.highlightId, highlight_title: g.highlightTitle })
        .eq('workspace_id', workspaceId)
        .in('story_pk', g.pks.slice(i, i + 200))
        .select('story_pk')
      if (error) errors.push(error.message)
      else tagged += data?.length ?? 0
    }
  }
  return { tagged, errors }
}

export type StoryViewerState =
  /** Viewer list read (possibly 0 people). */
  | 'collected'
  /** ClosRM first saw the story after its 48 h window: Instagram no longer lists viewers. */
  | 'out_of_window'
  /** Last read failed: unknown, never shown as 0. */
  | 'error'
  /** Not stored by ClosRM at all. */
  | 'unknown'

export interface StoredStory {
  story_pk: string
  taken_at: string
  created_at: string
  viewers_collected: number
  fetch_status?: 'ok' | 'error' | null
}

/** Pure: what ClosRM can say about a highlight story's viewers. */
export function storyViewerState(story: StoredStory | undefined): StoryViewerState {
  if (!story) return 'unknown'
  if (story.fetch_status === 'error') return 'error'
  const firstSeenLate = new Date(story.created_at).getTime() > new Date(story.taken_at).getTime() + VIEWER_WINDOW_MS
  if (story.viewers_collected === 0 && firstSeenLate) return 'out_of_window'
  return 'collected'
}

export interface ViewerRow {
  story_pk: string
  instagram_user_id: string
  instagram_username: string
  full_name: string | null
  profile_pic_url: string | null
  matched_lead_id: string | null
  first_seen_at: string
  has_liked?: boolean | null
}

export interface HighlightViewer {
  instagramUserId: string
  username: string
  fullName: string | null
  profilePicUrl: string | null
  leadId: string | null
  storiesSeen: number
  storyPks: string[]
  liked: number
  lastObservedAt: string
}

/**
 * Pure: one entry per person (keyed by Instagram id, not username — a
 * username can change; the most recent one is shown), with the number of
 * distinct stories they were seen on.
 */
export function aggregateViewers(rows: ViewerRow[]): HighlightViewer[] {
  const byUser = new Map<string, HighlightViewer & { _latest: string }>()
  for (const r of rows) {
    const cur = byUser.get(r.instagram_user_id)
    if (!cur) {
      byUser.set(r.instagram_user_id, {
        instagramUserId: r.instagram_user_id,
        username: r.instagram_username,
        fullName: r.full_name,
        profilePicUrl: r.profile_pic_url,
        leadId: r.matched_lead_id,
        storiesSeen: 1,
        storyPks: [r.story_pk],
        liked: r.has_liked ? 1 : 0,
        lastObservedAt: r.first_seen_at,
        _latest: r.first_seen_at,
      })
      continue
    }
    if (!cur.storyPks.includes(r.story_pk)) {
      cur.storyPks.push(r.story_pk)
      cur.storiesSeen += 1
      if (r.has_liked) cur.liked += 1
    }
    cur.leadId = cur.leadId ?? r.matched_lead_id
    if (r.first_seen_at > cur._latest) {
      cur._latest = r.first_seen_at
      cur.lastObservedAt = r.first_seen_at
      cur.username = r.instagram_username
      cur.fullName = r.full_name ?? cur.fullName
      cur.profilePicUrl = r.profile_pic_url ?? cur.profilePicUrl
    }
  }
  return [...byUser.values()]
    .map(({ _latest: _l, ...v }) => v)
    .sort((a, b) => b.storiesSeen - a.storiesSeen || b.lastObservedAt.localeCompare(a.lastObservedAt))
}

export interface HighlightViewersReport {
  stories: { pk: string; state: StoryViewerState; viewersCollected: number | null }[]
  viewers: (HighlightViewer & { leadName: string | null })[]
}

/** Viewers of the given highlight stories, aggregated per person, with lead names. */
export async function loadHighlightViewers(supabase: SupabaseClient, workspaceId: string, pks: string[]): Promise<HighlightViewersReport> {
  let storiesRes = await supabase
    .from('story_view_stories')
    .select('story_pk, taken_at, created_at, viewers_collected, fetch_status')
    .eq('workspace_id', workspaceId)
    .in('story_pk', pks)
  if (storiesRes.error && /fetch_status/.test(storiesRes.error.message)) {
    storiesRes = (await supabase
      .from('story_view_stories')
      .select('story_pk, taken_at, created_at, viewers_collected')
      .eq('workspace_id', workspaceId)
      .in('story_pk', pks)) as typeof storiesRes
  }
  if (storiesRes.error) throw new Error(storiesRes.error.message)
  const stored = new Map(((storiesRes.data ?? []) as StoredStory[]).map((s) => [s.story_pk, s]))

  const rows: ViewerRow[] = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('story_viewers')
      .select('story_pk, instagram_user_id, instagram_username, full_name, profile_pic_url, matched_lead_id, first_seen_at, has_liked')
      .eq('workspace_id', workspaceId)
      .in('story_pk', pks)
      .order('first_seen_at', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    rows.push(...((data ?? []) as ViewerRow[]))
    if (!data || data.length < PAGE || rows.length >= 50_000) break
  }

  const viewers = aggregateViewers(rows)
  const leadIds = [...new Set(viewers.map((v) => v.leadId).filter((id): id is string => !!id))]
  const names = new Map<string, string>()
  for (let i = 0; i < leadIds.length; i += 200) {
    const { data } = await supabase
      .from('leads')
      .select('id, first_name, last_name')
      .eq('workspace_id', workspaceId)
      .in('id', leadIds.slice(i, i + 200))
    for (const l of data ?? []) names.set(l.id, [l.first_name, l.last_name].filter(Boolean).join(' ') || '')
  }

  return {
    stories: pks.map((pk) => {
      const s = stored.get(pk)
      return { pk, state: storyViewerState(s), viewersCollected: s ? s.viewers_collected : null }
    }),
    viewers: viewers.map((v) => ({ ...v, leadName: v.leadId ? names.get(v.leadId) || null : null })),
  }
}

// "Qui a réagi" side panel of a publication (Content page, like Insyder):
// everyone identified on it, split between people for whom it is the first
// gesture ClosRM ever saw (no reaction to an older publication) and people
// who had already reacted before. Built on the content detail (scans,
// monitor / likes history, Meta comments, leads).
import type { SupabaseClient } from '@supabase/supabase-js'
import { loadContentDetail, type ContentProfile } from './content-data'
import type { ContentMetrics } from './content-metrics'

export interface ReactionPerson {
  username: string
  fullName: string | null
  profilePicUrl: string | null
  liked: boolean
  commentsCount: number
  commentText: string | null
  /** Known only from a scan of the account's followers (Ciblage); null = unknown. */
  follows: boolean | null
  lead: ContentProfile['lead']
}

export interface ReelReactions {
  metrics: ContentMetrics
  people: number
  firstTime: ReactionPerson[]
  returning: ReactionPerson[]
}

const toPerson = (p: ContentProfile): ReactionPerson => ({
  username: p.username,
  fullName: p.fullName,
  profilePicUrl: p.profilePicUrl,
  liked: p.liked,
  commentsCount: p.commentsCount,
  commentText: p.commentText,
  follows: p.followsTarget,
  lead: p.lead,
})

/** Commenters first (most comments), then leads, then likers. */
const byWeight = (a: ReactionPerson, b: ReactionPerson) =>
  b.commentsCount - a.commentsCount || Number(!!b.lead) - Number(!!a.lead) || Number(b.liked) - Number(a.liked) || a.username.localeCompare(b.username)

/** Pure: splits the people of a publication by whether they had reacted to an older one. */
export function splitReactions(profiles: ContentProfile[], reactedBefore: Set<string>): { firstTime: ReactionPerson[]; returning: ReactionPerson[] } {
  const firstTime: ReactionPerson[] = []
  const returning: ReactionPerson[] = []
  for (const p of profiles) (reactedBefore.has(p.username.toLowerCase()) ? returning : firstTime).push(toPerson(p))
  return { firstTime: firstTime.sort(byWeight), returning: returning.sort(byWeight) }
}

const CHUNK = 200

/** Usernames (lowercased) with a gesture on a publication published before `publishedAt`, or a lead interaction dated before it. */
async function reactedBefore(supabase: SupabaseClient, workspaceId: string, contentId: string, publishedAt: string, usernames: string[]): Promise<Set<string>> {
  const out = new Set<string>()
  if (usernames.length === 0) return out
  const [contents, reels] = await Promise.all([
    supabase.from('instagram_monitored_contents').select('content_id, published_at').eq('workspace_id', workspaceId).lt('published_at', publishedAt).limit(2000),
    supabase.from('ig_reels').select('ig_media_id, published_at').eq('workspace_id', workspaceId).lt('published_at', publishedAt).limit(2000),
  ])
  const olderContents = (contents.data ?? []).map((c) => c.content_id as string).filter((id) => id !== contentId)
  const olderMedia = (reels.data ?? []).map((r) => r.ig_media_id as string)
  const queries: PromiseLike<{ data: { u: string }[] | null }>[] = []
  for (let i = 0; i < usernames.length; i += CHUNK) {
    const names = usernames.slice(i, i + CHUNK)
    if (olderContents.length > 0) {
      queries.push(
        supabase.from('instagram_engagement_observations').select('u:instagram_username').eq('workspace_id', workspaceId).in('instagram_username', names).in('content_id', olderContents).limit(5000) as unknown as PromiseLike<{ data: { u: string }[] | null }>,
      )
    }
    if (olderMedia.length > 0) {
      queries.push(supabase.from('ig_comments').select('u:username').eq('workspace_id', workspaceId).in('username', names).in('ig_media_id', olderMedia).limit(5000) as unknown as PromiseLike<{ data: { u: string }[] | null }>)
    }
    // Leads' journey: story views, comments, likes dated before this publication.
    queries.push(
      supabase.from('instagram_interactions').select('u:instagram_username').eq('workspace_id', workspaceId).in('instagram_username', names).lt('first_seen_at', publishedAt).limit(5000) as unknown as PromiseLike<{ data: { u: string }[] | null }>,
    )
  }
  for (const { data } of await Promise.all(queries)) for (const r of data ?? []) if (r.u) out.add(r.u.toLowerCase())
  return out
}

export async function loadReelReactions(supabase: SupabaseClient, workspaceId: string, contentId: string): Promise<ReelReactions | null> {
  const detail = await loadContentDetail(supabase, workspaceId, contentId)
  if (!detail) return null
  const publishedAt = detail.metrics.publishedAt
  const before = publishedAt ? await reactedBefore(supabase, workspaceId, contentId, publishedAt, detail.profiles.map((p) => p.username)) : new Set<string>()
  const { firstTime, returning } = splitReactions(detail.profiles, before)
  return { metrics: detail.metrics, people: detail.profiles.length, firstTime, returning }
}

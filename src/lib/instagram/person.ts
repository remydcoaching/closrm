// An Instagram account that reacted to the coach, whether a CRM lead or not
// (Insyder's « lead » page): who it is, and every gesture ClosRM saw — reels
// liked (publication monitor / likes history), comments (Meta API, Hiker),
// stories watched or liked (desktop collection) — oldest first.
import type { SupabaseClient } from '@supabase/supabase-js'
import { mediaIdToShortcode, shortcodeToMediaId } from './shortcode'

export type GestureKind = 'like' | 'comment' | 'story_view' | 'story_like'

export interface PersonGesture {
  kind: GestureKind
  /** Comment time when Instagram gives it; else the publication / story date (a like is never dated). */
  at: string | null
  contentId: string | null
  storyPk: string | null
  title: string | null
  thumbnailUrl: string | null
  url: string | null
  text: string | null
}

export interface InstagramPerson {
  username: string
  fullName: string | null
  instagramUserId: string | null
  profilePicUrl: string | null
  isVerified: boolean | null
  /** Known only from a follower scan (Ciblage); null = unknown. */
  follows: boolean | null
  lead: { id: string; firstName: string; lastName: string; status: string } | null
  counts: { likes: number; comments: number; storyViews: number; storyLikes: number }
  firstGesture: PersonGesture | null
  gestures: PersonGesture[]
}

/** Pure: newest first for display, with counts and the first gesture (oldest dated one). */
export function summarizeGestures(gestures: PersonGesture[]): Pick<InstagramPerson, 'counts' | 'firstGesture' | 'gestures'> {
  const sorted = [...gestures].sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''))
  const dated = sorted.filter((g) => g.at)
  return {
    gestures: sorted,
    firstGesture: dated[dated.length - 1] ?? null,
    counts: {
      likes: gestures.filter((g) => g.kind === 'like').length,
      comments: gestures.filter((g) => g.kind === 'comment').length,
      storyViews: gestures.filter((g) => g.kind === 'story_view' || g.kind === 'story_like').length,
      storyLikes: gestures.filter((g) => g.kind === 'story_like').length,
    },
  }
}

export async function loadInstagramPerson(supabase: SupabaseClient, workspaceId: string, rawUsername: string): Promise<InstagramPerson | null> {
  const username = rawUsername.trim().replace(/^@/, '').toLowerCase()
  if (!/^[a-z0-9._]{1,30}$/.test(username)) return null

  const [obs, comments, views, scans] = await Promise.all([
    supabase
      .from('instagram_engagement_observations')
      .select('content_id, interaction_type, instagram_user_id, instagram_username, full_name, profile_pic_url, comment_text, commented_at, first_observed_at, matched_lead_id')
      .eq('workspace_id', workspaceId)
      .eq('instagram_username', username)
      .limit(2000),
    supabase.from('ig_comments').select('ig_media_id, text, timestamp, username').eq('workspace_id', workspaceId).eq('username', username).limit(2000),
    supabase
      .from('story_viewers')
      .select('story_pk, instagram_user_id, instagram_username, full_name, profile_pic_url, is_verified, matched_lead_id, has_liked, first_seen_at')
      .eq('workspace_id', workspaceId)
      .eq('instagram_username', username)
      .limit(2000),
    supabase
      .from('discovery_profiles')
      .select('instagram_user_id, full_name, profile_pic_url, is_verified, follows_target, matched_lead_id, created_at')
      .eq('workspace_id', workspaceId)
      .eq('instagram_username', username)
      .order('created_at', { ascending: false })
      .limit(1),
  ])
  const o = obs.data ?? []
  const c = comments.data ?? []
  const v = views.data ?? []
  const scan = scans.data?.[0]
  if (o.length + c.length + v.length === 0 && !scan) return null

  // Publications behind the gestures.
  const contentIds = [...new Set(o.map((r) => r.content_id as string))]
  const mediaIds = [...new Set(c.map((r) => r.ig_media_id as string))]
  const storyPks = [...new Set(v.map((r) => r.story_pk as string))]
  const [contents, reels, stories] = await Promise.all([
    contentIds.length ? supabase.from('instagram_monitored_contents').select('content_id, caption, thumbnail_url, content_url, published_at').eq('workspace_id', workspaceId).in('content_id', contentIds) : Promise.resolve({ data: [] }),
    mediaIds.length ? supabase.from('ig_reels').select('ig_media_id, shortcode, caption, thumbnail_url, permalink, published_at').eq('workspace_id', workspaceId).in('ig_media_id', mediaIds) : Promise.resolve({ data: [] }),
    storyPks.length ? supabase.from('story_view_stories').select('story_pk, taken_at, thumbnail_url').eq('workspace_id', workspaceId).in('story_pk', storyPks) : Promise.resolve({ data: [] }),
  ])
  const contentOf = new Map((contents.data ?? []).map((r) => [r.content_id as string, r]))
  const reelOf = new Map((reels.data ?? []).map((r) => [r.ig_media_id as string, r]))
  const storyOf = new Map((stories.data ?? []).map((r) => [r.story_pk as string, r]))

  const gestures: PersonGesture[] = []
  for (const r of o) {
    const ct = contentOf.get(r.content_id as string)
    gestures.push({
      kind: r.interaction_type === 'comment' ? 'comment' : 'like',
      at: r.interaction_type === 'comment' ? (r.commented_at ?? ct?.published_at ?? null) : (ct?.published_at ?? null),
      contentId: r.content_id,
      storyPk: null,
      title: ct?.caption ?? null,
      thumbnailUrl: ct?.thumbnail_url ?? null,
      url: ct?.content_url ?? `https://www.instagram.com/reel/${mediaIdToShortcode(r.content_id)}/`,
      text: r.comment_text ?? null,
    })
  }
  for (const r of c) {
    const reel = reelOf.get(r.ig_media_id as string)
    gestures.push({
      kind: 'comment',
      at: r.timestamp ?? reel?.published_at ?? null,
      contentId: reel?.shortcode ? shortcodeToMediaId(reel.shortcode) || null : null,
      storyPk: null,
      title: reel?.caption ?? null,
      thumbnailUrl: reel?.thumbnail_url ?? null,
      url: reel?.permalink ?? null,
      text: r.text ?? null,
    })
  }
  for (const r of v) {
    const st = storyOf.get(r.story_pk as string)
    gestures.push({
      kind: r.has_liked ? 'story_like' : 'story_view',
      at: st?.taken_at ?? r.first_seen_at ?? null,
      contentId: null,
      storyPk: r.story_pk,
      title: null,
      thumbnailUrl: st?.thumbnail_url ?? null,
      url: null,
      text: null,
    })
  }

  // Identity: the most recent source wins.
  const id = o.find((r) => r.instagram_user_id)?.instagram_user_id ?? v.find((r) => r.instagram_user_id)?.instagram_user_id ?? scan?.instagram_user_id ?? null
  const fullName = o.find((r) => r.full_name)?.full_name ?? v.find((r) => r.full_name)?.full_name ?? scan?.full_name ?? null
  const pic = o.find((r) => r.profile_pic_url)?.profile_pic_url ?? v.find((r) => r.profile_pic_url)?.profile_pic_url ?? scan?.profile_pic_url ?? null

  // CRM lead: matched on a gesture, else by Instagram id or handle.
  const handleLike = username.replace(/_/g, '\\_')
  const matched = o.find((r) => r.matched_lead_id)?.matched_lead_id ?? v.find((r) => r.matched_lead_id)?.matched_lead_id ?? scan?.matched_lead_id ?? null
  let leadQuery = supabase.from('leads').select('id, first_name, last_name, status, instagram_profile_pic_url').eq('workspace_id', workspaceId)
  leadQuery = matched ? leadQuery.eq('id', matched) : id ? leadQuery.or(`instagram_user_id.eq.${id},instagram_handle.ilike.${handleLike}`) : leadQuery.ilike('instagram_handle', handleLike)
  const { data: leads } = await leadQuery.limit(1)
  const l = leads?.[0]

  return {
    username,
    fullName,
    instagramUserId: id,
    profilePicUrl: pic ?? l?.instagram_profile_pic_url ?? null,
    isVerified: v.find((r) => r.is_verified !== null)?.is_verified ?? scan?.is_verified ?? null,
    follows: scan ? !!scan.follows_target : null,
    lead: l ? { id: l.id, firstName: l.first_name, lastName: l.last_name, status: l.status } : null,
    ...summarizeGestures(gestures),
  }
}

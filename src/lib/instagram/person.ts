// An Instagram account that reacted to the coach, whether a CRM lead or not
// (Insyder's « lead » page): who it is, and every gesture ClosRM saw — reels
// liked (publication monitor / likes history), comments (Meta API, Hiker),
// stories watched or liked (desktop collection) — oldest first.
import type { SupabaseClient } from '@supabase/supabase-js'
import { mediaIdToShortcode, shortcodeToMediaId } from './shortcode'
import { loadPeople } from './people'
import type { ConfidenceLevel } from '@/lib/leads/confidence'

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
  /** Same score / confidence as the Leads Instagram list (CRM engagement rules). */
  score: number
  confidence: ConfidenceLevel
  /** Share of the publications and stories published since the first gesture that this person touched. */
  engagementRate: number | null
  lastAt: string | null
  potential: 'tres_fort' | 'fort' | 'moyen' | 'faible'
  /** « Pourquoi ce score » — each factor 0..1, from the gestures (none invented). */
  factors: { key: string; label: string; value: number }[]
  /** Comment quality: strong = a question or a real sentence, medium = a few words, weak = emoji only / empty. */
  commentLevels: { fort: number; moyen: number; faible: number }
}

/** Pure: quality of a comment, like Insyder's « niveau d'engagement de ses commentaires ». */
export function commentLevel(text: string | null): 'fort' | 'moyen' | 'faible' {
  const t = (text ?? '').trim()
  const words = t.replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, ' ').split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w))
  if (words.length === 0) return 'faible'
  if (t.includes('?') || words.length >= 6) return 'fort'
  return 'moyen'
}

/** Pure: the reasons behind the score (ratios of what the person did vs what they could have done). */
export function scoreFactors(
  gestures: PersonGesture[],
  ctx: { follows: boolean | null; publicationsSinceFirst: number; storiesSinceFirst: number; now?: Date },
): { key: string; label: string; value: number }[] {
  const now = ctx.now ?? new Date()
  const days = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString()
  const recent = days(30)
  const week = days(7)
  const kinds = (k: GestureKind[], since?: string) => gestures.filter((g) => k.includes(g.kind) && (!since || (g.at ?? '') >= since))
  const contents = new Set(gestures.filter((g) => g.contentId).map((g) => g.contentId))
  const stories = new Set(gestures.filter((g) => g.storyPk).map((g) => g.storyPk))
  const months = new Set(gestures.filter((g) => g.at).map((g) => (g.at as string).slice(0, 7)))
  const dated = gestures.filter((g) => g.at).map((g) => g.at as string).sort()
  const spanMonths = dated.length ? Math.max(1, Math.round((now.getTime() - new Date(dated[0]).getTime()) / (30 * 86_400_000))) : 1
  const clamp = (x: number) => Math.max(0, Math.min(1, x))
  return [
    { key: 'comments_recent', label: 'A commenté vos publications récentes', value: clamp(kinds(['comment'], recent).length / 3) },
    { key: 'story_likes', label: 'A réagi à vos stories', value: clamp(kinds(['story_like']).length / 3) },
    { key: 'likes_recent', label: 'A liké vos publications récentes', value: clamp(kinds(['like'], recent).length / 5) },
    { key: 'stories_seen', label: 'A regardé vos stories', value: ctx.storiesSinceFirst > 0 ? clamp(stories.size / ctx.storiesSinceFirst) : 0 },
    { key: 'monthly', label: 'Revient mois après mois', value: clamp(months.size / spanMonths) },
    { key: 'comments_week', label: 'A commenté vos publications cette semaine', value: clamp(kinds(['comment'], week).length / 2) },
    { key: 'likes_week', label: 'A liké vos publications cette semaine', value: clamp(kinds(['like'], week).length / 3) },
    { key: 'follows', label: 'Est abonné à votre compte', value: ctx.follows === true ? 1 : 0 },
    { key: 'share', label: "Part de vos publications touchée depuis qu'on le connaît", value: ctx.publicationsSinceFirst > 0 ? clamp(contents.size / ctx.publicationsSinceFirst) : 0 },
  ]
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

  const summary = summarizeGestures(gestures)
  const follows = scan ? !!scan.follows_target : null
  // Score and level from the Leads Instagram index (same rules, cached).
  const people = await loadPeople(supabase, workspaceId)
  const row = people.rows.find((r) => r.username === username)
  const firstAt = summary.firstGesture?.at ?? null
  const [pubs, storiesSince] = firstAt
    ? await Promise.all([
        supabase.from('instagram_monitored_contents').select('content_id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).gte('published_at', firstAt),
        supabase.from('story_view_stories').select('story_pk', { count: 'exact', head: true }).eq('workspace_id', workspaceId).gte('taken_at', firstAt).gt('viewers_collected', 0),
      ])
    : [{ count: 0 }, { count: 0 }]
  const publicationsSinceFirst = pubs.count ?? 0
  const storiesSinceFirst = storiesSince.count ?? 0
  const touched = new Set(gestures.map((g) => g.contentId ?? g.storyPk).filter(Boolean)).size
  const available = publicationsSinceFirst + storiesSinceFirst
  const confidence = row?.confidence ?? 'insuffisant'
  const levels = { fort: 0, moyen: 0, faible: 0 }
  for (const g of gestures) if (g.kind === 'comment') levels[commentLevel(g.text)] += 1

  return {
    username,
    fullName,
    instagramUserId: id,
    profilePicUrl: pic ?? l?.instagram_profile_pic_url ?? null,
    isVerified: v.find((r) => r.is_verified !== null)?.is_verified ?? scan?.is_verified ?? null,
    follows,
    lead: l ? { id: l.id, firstName: l.first_name, lastName: l.last_name, status: l.status } : null,
    ...summary,
    score: row?.score ?? 0,
    confidence,
    engagementRate: available > 0 ? Math.min(1, touched / available) : null,
    lastAt: summary.gestures.find((g) => g.at)?.at ?? null,
    potential: confidence === 'tres_eleve' ? 'tres_fort' : confidence === 'eleve' ? 'fort' : confidence === 'moyen' ? 'moyen' : 'faible',
    factors: scoreFactors(gestures, { follows, publicationsSinceFirst, storiesSinceFirst }),
    commentLevels: levels,
  }
}

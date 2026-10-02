// « Leads Instagram » (Insyder's Leads page): every Instagram account that
// reacted to the coach — story viewers, reel likers, commenters — whether or
// not it is a CRM lead, scored with the same engagement rules as CRM leads.
// One pass over persisted rows (no live Instagram call), cached a minute per
// workspace; the API filters / pages / sorts the result.
import type { SupabaseClient } from '@supabase/supabase-js'
import { aggregateScores, loadScoringRules, type BatchInteractionRow } from '@/lib/leads/engagement-score'
import { confidenceLevel, type ConfidenceLevel } from '@/lib/leads/confidence'

export type GestureSource = 'story' | 'reel' | 'post' | 'comment'

/** One gesture of one person, as read from the tables. */
export interface PersonGestureRow {
  username: string
  kind: 'story_view' | 'story_like' | 'like' | 'comment'
  /** Publication / story the gesture is on. */
  sourceId: string
  source: GestureSource
  /** Comment time, else the publication / story date (likes and views aren't dated by Instagram). */
  at: string | null
}

export interface PersonIdentity {
  username: string
  fullName: string | null
  profilePicUrl: string | null
  instagramUserId: string | null
  isVerified: boolean | null
  follows: boolean | null
}

export interface PersonRow extends PersonIdentity {
  score: number
  confidence: ConfidenceLevel
  interactions: number
  storyViews: number
  storyLikes: number
  likes: number
  comments: number
  firstAt: string | null
  firstSource: GestureSource | null
  firstSourceId: string | null
  lastAt: string | null
  /** Stories seen among the last N stories collected (lurker « assiduité »). */
  recentStoriesSeen: number
  contacted: boolean
  lead: { id: string; status: string } | null
}

export interface PeopleIndex {
  rows: PersonRow[]
  recentStoriesCount: number
}

const WEIGHT_KIND: Record<PersonGestureRow['kind'], string> = { story_view: 'story_view', story_like: 'like', like: 'like', comment: 'comment' }

/** Pure: one row per person, scored like CRM leads (same weights, same confidence rules). */
export function buildPeople(
  gestures: PersonGestureRow[],
  identities: Map<string, PersonIdentity>,
  scoring: Record<string, number>,
  opts: { recentStoryIds: Set<string>; contacted: Set<string>; leads: Map<string, { id: string; status: string }>; now?: Date },
): PersonRow[] {
  const byUser = new Map<string, PersonGestureRow[]>()
  for (const g of gestures) {
    const list = byUser.get(g.username) ?? []
    list.push(g)
    byUser.set(g.username, list)
  }
  const scoreRows: BatchInteractionRow[] = gestures.map((g) => ({ lead_id: g.username, interaction_type: WEIGHT_KIND[g.kind], source_post_id: g.sourceId, first_seen_at: g.at, last_seen_at: g.at }))
  const scores = aggregateScores(scoreRows, scoring)
  const out: PersonRow[] = []
  for (const [username, list] of byUser) {
    const s = scores.get(username)
    if (!s) continue
    const id = identities.get(username) ?? { username, fullName: null, profilePicUrl: null, instagramUserId: null, isVerified: null, follows: null }
    const dated = list.filter((g) => g.at).sort((a, b) => (a.at as string).localeCompare(b.at as string))
    const first = dated[0] ?? null
    out.push({
      ...id,
      score: s.score,
      confidence: confidenceLevel(s, opts.now),
      interactions: list.length,
      storyViews: list.filter((g) => g.kind === 'story_view' || g.kind === 'story_like').length,
      storyLikes: list.filter((g) => g.kind === 'story_like').length,
      likes: list.filter((g) => g.kind === 'like').length,
      comments: list.filter((g) => g.kind === 'comment').length,
      firstAt: first?.at ?? null,
      firstSource: first?.source ?? null,
      firstSourceId: first?.sourceId ?? null,
      lastAt: dated[dated.length - 1]?.at ?? null,
      recentStoriesSeen: new Set(list.filter((g) => g.source === 'story' && opts.recentStoryIds.has(g.sourceId)).map((g) => g.sourceId)).size,
      contacted: opts.contacted.has(username),
      lead: opts.leads.get(username) ?? null,
    })
  }
  return out
}

export interface PeopleKpis {
  active: number
  activePrevious: number
  veryHighNeverContacted: number
  buyerLurkers: number
  becameVeryHigh: number
}

/** Pure: the four Insyder cards for a period. */
export function peopleKpis(rows: PersonRow[], gestures: PersonGestureRow[], periodDays: number, recentStoriesCount: number, scoring: Record<string, number>, now: Date = new Date()): PeopleKpis {
  const since = new Date(now.getTime() - periodDays * 86_400_000).toISOString()
  const before = new Date(now.getTime() - 2 * periodDays * 86_400_000).toISOString()
  const activeIn = (from: string, to: string) => new Set(gestures.filter((g) => g.at && g.at >= from && g.at < to).map((g) => g.username)).size
  // Level at the start of the period: same score, gestures before it only.
  const startRows: BatchInteractionRow[] = gestures.filter((g) => g.at && g.at < since).map((g) => ({ lead_id: g.username, interaction_type: WEIGHT_KIND[g.kind], source_post_id: g.sourceId, first_seen_at: g.at, last_seen_at: g.at }))
  const startScores = aggregateScores(startRows, scoring)
  const startDate = new Date(since)
  return {
    active: activeIn(since, '￿'),
    activePrevious: activeIn(before, since),
    veryHighNeverContacted: rows.filter((r) => r.confidence === 'tres_eleve' && !r.contacted && (r.lastAt ?? '') >= since).length,
    buyerLurkers: rows.filter((r) => isBuyerLurker(r, recentStoriesCount)).length,
    becameVeryHigh: rows.filter((r) => {
      if (r.confidence !== 'tres_eleve') return false
      const s = startScores.get(r.username)
      return !s || confidenceLevel(s, startDate) !== 'tres_eleve'
    }).length,
  }
}

/** Watched at least half of the recent stories, never liked or commented, never contacted. */
export function isBuyerLurker(r: Pick<PersonRow, 'recentStoriesSeen' | 'likes' | 'comments' | 'storyLikes' | 'contacted'>, recentStoriesCount: number): boolean {
  return recentStoriesCount > 0 && r.recentStoriesSeen * 2 >= recentStoriesCount && r.likes + r.comments + r.storyLikes === 0 && !r.contacted
}

const PAGE = 1000
type Page<T> = { data: T[] | null; error: { message: string } | null; count?: number | null }
/** Every row: the first page tells the total, the other pages are read in parallel. */
async function all<T>(run: (from: number, to: number) => PromiseLike<Page<T>>): Promise<T[]> {
  const first = await run(0, PAGE - 1)
  if (first.error) return [] // a table missing (migration not applied) only removes its source
  const out = [...(first.data ?? [])]
  if (out.length < PAGE) return out
  const total = first.count ?? 0
  const pages = total > PAGE ? Math.ceil(total / PAGE) - 1 : 0
  if (pages === 0) {
    // No count: read on sequentially.
    for (let from = PAGE; ; from += PAGE) {
      const { data } = await run(from, from + PAGE - 1)
      out.push(...(data ?? []))
      if (!data || data.length < PAGE) break
    }
    return out
  }
  const rest = await Promise.all(Array.from({ length: pages }, (_, i) => run((i + 1) * PAGE, (i + 2) * PAGE - 1)))
  for (const r of rest) out.push(...(r.data ?? []))
  return out
}

export const RECENT_STORIES = 10

export interface LoadedPeople {
  rows: PersonRow[]
  gestures: PersonGestureRow[]
  scoring: Record<string, number>
  recentStoriesCount: number
}

async function loadPeopleUncached(supabase: SupabaseClient, workspaceId: string): Promise<LoadedPeople> {
  // Light columns only: names and pictures are fetched for the displayed rows (attachIdentities).
  type Viewer = { story_pk: string; instagram_username: string; instagram_user_id: string; is_verified: boolean | null; has_liked: boolean | null; first_seen_at: string; matched_lead_id: string | null }
  type Obs = { content_id: string; interaction_type: string; instagram_username: string; instagram_user_id: string; commented_at: string | null; matched_lead_id: string | null }
  type Comment = { ig_media_id: string; username: string | null; timestamp: string | null }
  const [viewers, observations, comments, stories, contents, reels, profiles, convs, leads, scoring] = await Promise.all([
    all<Viewer>((f, t) => supabase.from('story_viewers').select('story_pk, instagram_username, instagram_user_id, is_verified, has_liked, first_seen_at, matched_lead_id', { count: 'exact' }).eq('workspace_id', workspaceId).range(f, t)),
    all<Obs>((f, t) => supabase.from('instagram_engagement_observations').select('content_id, interaction_type, instagram_username, instagram_user_id, commented_at, matched_lead_id', { count: 'exact' }).eq('workspace_id', workspaceId).range(f, t)),
    all<Comment>((f, t) => supabase.from('ig_comments').select('ig_media_id, username, timestamp').eq('workspace_id', workspaceId).range(f, t)),
    all<{ story_pk: string; taken_at: string; viewers_collected: number | null }>((f, t) => supabase.from('story_view_stories').select('story_pk, taken_at, viewers_collected').eq('workspace_id', workspaceId).order('taken_at', { ascending: false }).range(f, t)),
    all<{ content_id: string; content_type: string; published_at: string | null }>((f, t) => supabase.from('instagram_monitored_contents').select('content_id, content_type, published_at').eq('workspace_id', workspaceId).range(f, t)),
    all<{ ig_media_id: string; shortcode: string | null; published_at: string | null }>((f, t) => supabase.from('ig_reels').select('ig_media_id, shortcode, published_at').eq('workspace_id', workspaceId).range(f, t)),
    all<{ instagram_username: string; is_verified: boolean | null; follows_target: boolean | null; created_at: string }>((f, t) =>
      supabase.from('discovery_profiles').select('instagram_username, is_verified, follows_target, created_at').eq('workspace_id', workspaceId).order('created_at', { ascending: true }).range(f, t),
    ),
    all<{ participant_username: string | null }>((f, t) => supabase.from('ig_conversations').select('participant_username').eq('workspace_id', workspaceId).range(f, t)),
    all<{ id: string; status: string; instagram_handle: string | null; instagram_user_id: string | null; call_attempts: number | null }>((f, t) =>
      supabase.from('leads').select('id, status, instagram_handle, instagram_user_id, call_attempts', { count: 'exact' }).eq('workspace_id', workspaceId).not('instagram_handle', 'is', null).range(f, t),
    ),
    loadScoringRules(supabase, workspaceId),
  ])

  const storyAt = new Map(stories.map((s) => [s.story_pk, s.taken_at]))
  // Lurker « assiduité » only over stories whose viewers were actually collected.
  const recentStoryIds = new Set(stories.filter((s) => (s.viewers_collected ?? 0) > 0).slice(0, RECENT_STORIES).map((s) => s.story_pk))
  const contentOf = new Map(contents.map((c) => [c.content_id, c]))
  const reelAt = new Map(reels.map((r) => [r.ig_media_id, r]))

  const identities = new Map<string, PersonIdentity>()
  const remember = (username: string, p: Partial<PersonIdentity>) => {
    const prev = identities.get(username) ?? { username, fullName: null, profilePicUrl: null, instagramUserId: null, isVerified: null, follows: null }
    identities.set(username, {
      username,
      fullName: prev.fullName ?? p.fullName ?? null,
      profilePicUrl: prev.profilePicUrl ?? p.profilePicUrl ?? null,
      instagramUserId: prev.instagramUserId ?? p.instagramUserId ?? null,
      isVerified: p.isVerified ?? prev.isVerified,
      follows: p.follows ?? prev.follows,
    })
  }

  const gestures: PersonGestureRow[] = []
  const matchedLead = new Map<string, string>()
  for (const v of viewers) {
    const u = v.instagram_username.toLowerCase()
    remember(u, { instagramUserId: v.instagram_user_id, isVerified: v.is_verified })
    gestures.push({ username: u, kind: v.has_liked ? 'story_like' : 'story_view', sourceId: v.story_pk, source: 'story', at: storyAt.get(v.story_pk) ?? v.first_seen_at })
    if (v.matched_lead_id) matchedLead.set(u, v.matched_lead_id)
  }
  for (const o of observations) {
    const u = o.instagram_username.toLowerCase()
    remember(u, { instagramUserId: o.instagram_user_id })
    const c = contentOf.get(o.content_id)
    const isComment = o.interaction_type === 'comment'
    gestures.push({ username: u, kind: isComment ? 'comment' : 'like', sourceId: o.content_id, source: c?.content_type === 'media' ? 'post' : 'reel', at: (isComment ? o.commented_at : null) ?? c?.published_at ?? null })
    if (o.matched_lead_id) matchedLead.set(u, o.matched_lead_id)
  }
  for (const c of comments) {
    if (!c.username) continue
    const u = c.username.toLowerCase()
    remember(u, {})
    gestures.push({ username: u, kind: 'comment', sourceId: c.ig_media_id, source: 'reel', at: c.timestamp ?? reelAt.get(c.ig_media_id)?.published_at ?? null })
  }
  // Ciblage scans: verified / follows (latest scan wins — rows are oldest first).
  for (const p of profiles) {
    const u = p.instagram_username.toLowerCase()
    if (!identities.has(u)) continue
    remember(u, { isVerified: p.is_verified, follows: p.follows_target })
  }

  const leadById = new Map(leads.map((l) => [l.id, l]))
  const leadByHandle = new Map(leads.filter((l) => l.instagram_handle).map((l) => [String(l.instagram_handle).replace(/^@/, '').toLowerCase(), l]))
  const leadByUid = new Map(leads.filter((l) => l.instagram_user_id).map((l) => [String(l.instagram_user_id), l]))
  const leadOf = new Map<string, { id: string; status: string }>()
  const contacted = new Set(convs.map((c) => c.participant_username?.toLowerCase()).filter((u): u is string => !!u))
  for (const [u, id] of identities) {
    const l = (matchedLead.get(u) && leadById.get(matchedLead.get(u) as string)) || (id.instagramUserId && leadByUid.get(id.instagramUserId)) || leadByHandle.get(u)
    if (!l) continue
    leadOf.set(u, { id: l.id, status: l.status })
    // Called, or moved past « nouveau » in the pipeline: someone already reached out.
    if ((l.call_attempts ?? 0) > 0 || (l.status !== 'nouveau' && l.status !== 'scripte')) contacted.add(u)
  }

  const rows = buildPeople(gestures, identities, scoring, { recentStoryIds, contacted, leads: leadOf })
  return { rows, gestures, scoring, recentStoriesCount: recentStoryIds.size }
}

/** Names and pictures of the rows about to be shown (most recent source first). */
export async function attachIdentities(supabase: SupabaseClient, workspaceId: string, rows: PersonRow[]): Promise<PersonRow[]> {
  const names = [...new Set(rows.map((r) => r.username))]
  if (names.length === 0) return rows
  const found = new Map<string, { fullName: string | null; pic: string | null }>()
  const take = (u: string, fullName: string | null, pic: string | null) => {
    const prev = found.get(u)
    found.set(u, { fullName: prev?.fullName ?? fullName, pic: prev?.pic ?? pic })
  }
  for (let i = 0; i < names.length; i += 200) {
    const chunk = names.slice(i, i + 200)
    const [obs, viewers] = await Promise.all([
      supabase.from('instagram_engagement_observations').select('instagram_username, full_name, profile_pic_url, first_observed_at').eq('workspace_id', workspaceId).in('instagram_username', chunk).order('first_observed_at', { ascending: false }).limit(chunk.length * 3),
      supabase.from('story_viewers').select('instagram_username, full_name, profile_pic_url, first_seen_at').eq('workspace_id', workspaceId).in('instagram_username', chunk).order('first_seen_at', { ascending: false }).limit(chunk.length * 3),
    ])
    for (const r of obs.data ?? []) take(String(r.instagram_username).toLowerCase(), r.full_name, r.profile_pic_url)
    for (const r of viewers.data ?? []) take(String(r.instagram_username).toLowerCase(), r.full_name, r.profile_pic_url)
  }
  return rows.map((r) => {
    const f = found.get(r.username)
    return f ? { ...r, fullName: r.fullName ?? f.fullName, profilePicUrl: r.profilePicUrl ?? f.pic } : r
  })
}

const CACHE_TTL_MS = 60_000
const cache = new Map<string, { at: number; value: LoadedPeople }>()

export async function loadPeople(supabase: SupabaseClient, workspaceId: string): Promise<LoadedPeople> {
  const hit = cache.get(workspaceId)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value
  const value = await loadPeopleUncached(supabase, workspaceId)
  cache.set(workspaceId, { at: Date.now(), value })
  return value
}

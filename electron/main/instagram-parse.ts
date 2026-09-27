// Pure parsing of the Instagram web API responses used for story viewers
// (feed/reels_media and media/:pk/list_reel_media_viewer). Kept free of
// Electron imports so it can be unit-tested. Shapes are Instagram's own and
// may change without notice: every field is read defensively and anything
// unexpected is dropped rather than guessed.

export interface StoryViewer {
  pk: string
  username: string
  fullName: string | null
  profilePicUrl: string | null
  isVerified: boolean | null
  /** Sent a heart on the story (owner-only info in the viewer list). */
  hasLiked: boolean | null
  isPrivate: boolean | null
  /** Text reply sent to the story, if any. */
  replyText: string | null
}

export interface OwnStory {
  pk: string
  takenAt: string
  expiringAt: string | null
  mediaType: 'image' | 'video' | null
  thumbnailUrl: string | null
  videoUrl: string | null
  /** Hearts: viewers with has_liked (computed after reading the viewer list). */
  likeCount: number | null
  viewerCount: number | null
  viewers: StoryViewer[]
}

/** A story of the coach's archive, with fresh (short-lived) media URLs for display. */
export interface ArchivedStory {
  pk: string
  takenAt: string
  mediaType: 'image' | 'video' | null
  imageUrl: string | null
  videoUrl: string | null
  viewerCount: number | null
  /** Hearts received, when Instagram reports it to the owner. */
  likeCount: number | null
}

type Json = Record<string, unknown>

const asObj = (v: unknown): Json | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : null)
const asStr = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : typeof v === 'number' ? String(v) : null)
const asNum = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const unixToIso = (v: unknown): string | null => {
  const n = asNum(v)
  return n === null ? null : new Date(n * 1000).toISOString()
}
const httpsUrl = (v: unknown): string | null => {
  const s = asStr(v)
  return s && s.startsWith('https://') ? s : null
}

/** Username of the reel owner (the coach) in a feed/reels_media response. */
export function reelOwnerUsername(body: unknown, userId: string): string | null {
  const root = asObj(body)
  const reel = asObj(root?.reel) ?? asObj(asObj(root?.reels)?.[userId]) ?? asObj(Array.isArray(root?.reels_media) ? root.reels_media[0] : null)
  return asStr(asObj(reel?.user)?.username)
}

/** Items of the coach's own live reel from GET /api/v1/feed/reels_media/?reel_ids=<id>. */
export function parseOwnReel(body: unknown, userId: string): Omit<OwnStory, 'viewers'>[] {
  const root = asObj(body)
  if (!root) return []
  const reel = asObj(root.reel) ?? asObj(asObj(root.reels)?.[userId]) ?? asObj(Array.isArray(root.reels_media) ? root.reels_media[0] : null)
  const items = Array.isArray(reel?.items) ? reel.items : []
  const out: Omit<OwnStory, 'viewers'>[] = []
  for (const raw of items) {
    const it = asObj(raw)
    if (!it) continue
    const pk = asStr(it.pk) ?? asStr(asStr(it.id)?.split('_')[0])
    const takenAt = unixToIso(it.taken_at)
    if (!pk || !takenAt) continue
    const candidates = asObj(it.image_versions2)?.candidates
    // candidates[0] is the full-resolution image (the last one is a tiny thumbnail).
    const thumb = Array.isArray(candidates) ? httpsUrl(asObj(candidates[0])?.url) : null
    out.push({
      pk,
      takenAt,
      expiringAt: unixToIso(it.expiring_at),
      mediaType: it.media_type === 2 ? 'video' : it.media_type === 1 ? 'image' : null,
      thumbnailUrl: thumb,
      videoUrl: Array.isArray(it.video_versions) && it.video_versions.length > 0 ? httpsUrl(asObj(it.video_versions[0])?.url) : null,
      likeCount: null,
      viewerCount: asNum(it.total_viewer_count) ?? asNum(it.viewer_count),
    })
  }
  return out
}

function largestCandidate(it: Json): string | null {
  const candidates = asObj(it.image_versions2)?.candidates
  if (!Array.isArray(candidates) || candidates.length === 0) return null
  return httpsUrl(asObj(candidates[0])?.url)
}

/** Archive day ids ("archiveDay:…") from GET /api/v1/archive/reel/day_shells/. */
export function parseArchiveDayShells(body: unknown): { ids: string[]; maxId: string | null } {
  const root = asObj(body)
  const items = Array.isArray(root?.items) ? root.items : []
  const ids = items.map((i) => asStr(asObj(i)?.id)).filter((id): id is string => !!id && id.startsWith('archiveDay:'))
  return { ids, maxId: root?.more_available ? asStr(root.max_id) : null }
}

/** Every item of every reel in a GET /api/v1/feed/reels_media/ response. */
export function parseReelsMediaItems(body: unknown): ArchivedStory[] {
  const root = asObj(body)
  const reels = asObj(root?.reels)
  const reelList = reels ? Object.values(reels) : Array.isArray(root?.reels_media) ? root.reels_media : root?.reel ? [root.reel] : []
  const out: ArchivedStory[] = []
  for (const reel of reelList) {
    const items = asObj(reel)?.items
    if (!Array.isArray(items)) continue
    for (const raw of items) {
      const it = asObj(raw)
      if (!it) continue
      const pk = asStr(it.pk) ?? asStr(asStr(it.id)?.split('_')[0])
      const takenAt = unixToIso(it.taken_at)
      if (!pk || !takenAt) continue
      const videos = it.video_versions
      out.push({
        pk,
        takenAt,
        mediaType: it.media_type === 2 ? 'video' : it.media_type === 1 ? 'image' : null,
        imageUrl: largestCandidate(it),
        videoUrl: Array.isArray(videos) && videos.length > 0 ? httpsUrl(asObj(videos[0])?.url) : null,
        viewerCount: asNum(it.total_viewer_count) ?? asNum(it.viewer_count),
        likeCount: asNum(it.like_count) ?? asNum(asObj(it.story_like_info)?.like_count) ?? asNum(it.story_likes_count),
      })
    }
  }
  return out.sort((a, b) => b.takenAt.localeCompare(a.takenAt))
}

/**
 * One page of GET /api/v1/media/:pk/list_reel_media_viewer/. `users[]` carries
 * the profiles; `viewers[]` carries per-viewer facts ({ user, has_liked,
 * reply_text }) — the heart and the reply only exist there.
 */
export function parseViewersPage(body: unknown): { viewers: StoryViewer[]; nextMaxId: string | null } {
  const root = asObj(body)
  const facts = new Map<string, { hasLiked: boolean | null; replyText: string | null }>()
  const fromViewers: Json[] = []
  for (const raw of Array.isArray(root?.viewers) ? root.viewers : []) {
    const v = asObj(raw)
    const u = asObj(v?.user)
    const pk = asStr(u?.pk) ?? asStr(u?.pk_id) ?? asStr(u?.id)
    if (!v || !u || !pk) continue
    facts.set(pk, { hasLiked: typeof v.has_liked === 'boolean' ? v.has_liked : null, replyText: asStr(v.reply_text) })
    fromViewers.push(u)
  }
  const users = Array.isArray(root?.users) && root.users.length > 0 ? root.users : fromViewers
  const viewers: StoryViewer[] = []
  for (const raw of users) {
    const u = asObj(raw)
    const pk = asStr(u?.pk) ?? asStr(u?.pk_id) ?? asStr(u?.id)
    const username = asStr(u?.username)
    if (!u || !pk || !username) continue
    const f = facts.get(pk)
    viewers.push({
      pk,
      username,
      fullName: asStr(u.full_name),
      profilePicUrl: httpsUrl(u.profile_pic_url),
      isVerified: typeof u.is_verified === 'boolean' ? u.is_verified : null,
      hasLiked: f?.hasLiked ?? (typeof u.has_liked === 'boolean' ? u.has_liked : null),
      isPrivate: typeof u.is_private === 'boolean' ? u.is_private : null,
      replyText: f?.replyText ?? null,
    })
  }
  return { viewers, nextMaxId: asStr(root?.next_max_id) }
}

/** Highlights from the profile GraphQL query (web). Reel ids are "highlight:<id>". */
export function parseGraphqlHighlights(body: unknown): HighlightCollection[] {
  const edges = asObj(asObj(asObj(asObj(body)?.data)?.user)?.edge_highlight_reels)?.edges
  if (!Array.isArray(edges)) return []
  const out: HighlightCollection[] = []
  for (const e of edges) {
    const n = asObj(asObj(e)?.node)
    const id = asStr(n?.id)
    if (!n || !id) continue
    out.push({
      id: id.startsWith('highlight:') ? id : `highlight:${id}`,
      title: asStr(n.title) ?? '',
      coverUrl: httpsUrl(asObj(n.cover_media_cropped_thumbnail)?.url) ?? httpsUrl(asObj(n.cover_media)?.thumbnail_src),
      mediaCount: null,
    })
  }
  return out
}

export type InstagramFailure = 'not_connected' | 'checkpoint' | 'rate_limited' | 'error'

/** Maps an Instagram web API failure to an actionable category. */
export function classifyFailure(status: number, body: unknown): InstagramFailure {
  const msg = String(asObj(body)?.message ?? '')
  if (status === 429 || /wait a few minutes|please wait|rate limit/i.test(msg)) return 'rate_limited'
  if (/checkpoint|challenge/i.test(msg)) return 'checkpoint'
  if (status === 401 || status === 403 || /login_required/i.test(msg)) return 'not_connected'
  return 'error'
}


export interface HighlightCollection {
  id: string // "highlight:…"
  title: string
  coverUrl: string | null
  mediaCount: number | null
}

/** GET /api/v1/highlights/:userId/highlights_tray/ → the coach's collections, in profile order. */
export function parseHighlightsTray(body: unknown): HighlightCollection[] {
  const tray = asObj(body)?.tray
  if (!Array.isArray(tray)) return []
  const out: HighlightCollection[] = []
  for (const raw of tray) {
    const h = asObj(raw)
    const id = asStr(h?.id)
    if (!h || !id || !id.startsWith('highlight:')) continue
    const cover = asObj(h.cover_media)
    out.push({
      id,
      title: asStr(h.title) ?? '',
      coverUrl: httpsUrl(asObj(cover?.cropped_image_version)?.url) ?? httpsUrl(asObj(cover?.full_image_version)?.url),
      mediaCount: asNum(h.media_count),
    })
  }
  return out
}

/** Items of each highlight in a reels_media response, keyed by highlight id. */
export function parseHighlightItems(body: unknown): Map<string, ArchivedStory[]> {
  const reels = asObj(asObj(body)?.reels)
  const out = new Map<string, ArchivedStory[]>()
  if (!reels) return out
  for (const [id, reel] of Object.entries(reels)) {
    out.set(id, parseReelsMediaItems({ reels: { [id]: reel } }))
  }
  return out
}

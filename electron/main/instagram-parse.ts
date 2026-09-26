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
}

export interface OwnStory {
  pk: string
  takenAt: string
  expiringAt: string | null
  mediaType: 'image' | 'video' | null
  thumbnailUrl: string | null
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
  const reel = asObj(asObj(root?.reels)?.[userId]) ?? asObj(Array.isArray(root?.reels_media) ? root.reels_media[0] : null)
  return asStr(asObj(reel?.user)?.username)
}

/** Items of the coach's own live reel from GET /api/v1/feed/reels_media/?reel_ids=<id>. */
export function parseOwnReel(body: unknown, userId: string): Omit<OwnStory, 'viewers'>[] {
  const root = asObj(body)
  if (!root) return []
  const reel = asObj(asObj(root.reels)?.[userId]) ?? asObj(Array.isArray(root.reels_media) ? root.reels_media[0] : null)
  const items = Array.isArray(reel?.items) ? reel.items : []
  const out: Omit<OwnStory, 'viewers'>[] = []
  for (const raw of items) {
    const it = asObj(raw)
    if (!it) continue
    const pk = asStr(it.pk) ?? asStr(asStr(it.id)?.split('_')[0])
    const takenAt = unixToIso(it.taken_at)
    if (!pk || !takenAt) continue
    const candidates = asObj(it.image_versions2)?.candidates
    const thumb = Array.isArray(candidates) ? httpsUrl(asObj(candidates[candidates.length > 1 ? candidates.length - 1 : 0])?.url) : null
    out.push({
      pk,
      takenAt,
      expiringAt: unixToIso(it.expiring_at),
      mediaType: it.media_type === 2 ? 'video' : it.media_type === 1 ? 'image' : null,
      thumbnailUrl: thumb,
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
  const reelList = reels ? Object.values(reels) : Array.isArray(root?.reels_media) ? root.reels_media : []
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
      })
    }
  }
  return out.sort((a, b) => b.takenAt.localeCompare(a.takenAt))
}

/** One page of GET /api/v1/media/:pk/list_reel_media_viewer/. */
export function parseViewersPage(body: unknown): { viewers: StoryViewer[]; nextMaxId: string | null } {
  const root = asObj(body)
  const users = Array.isArray(root?.users) ? root.users : []
  const viewers: StoryViewer[] = []
  for (const raw of users) {
    const u = asObj(raw)
    const pk = asStr(u?.pk) ?? asStr(u?.pk_id) ?? asStr(u?.id)
    const username = asStr(u?.username)
    if (!u || !pk || !username) continue
    viewers.push({
      pk,
      username,
      fullName: asStr(u.full_name),
      profilePicUrl: httpsUrl(u.profile_pic_url),
      isVerified: typeof u.is_verified === 'boolean' ? u.is_verified : null,
      hasLiked: typeof u.has_liked === 'boolean' ? u.has_liked : typeof u.has_liked_reel === 'boolean' ? u.has_liked_reel : null,
    })
  }
  return { viewers, nextMaxId: asStr(root?.next_max_id) }
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

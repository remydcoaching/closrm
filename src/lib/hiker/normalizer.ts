// Pure normalization functions — no I/O, no DB. Converts raw Hiker response
// shapes into ClosRM-agnostic intermediate types the discovery engine and
// deduplicator work with.
import type { HikerUserShort, HikerMediaItem } from './types'

export interface NormalizedUser {
  instagramUserId: string | null
  username: string
  fullName: string | null
  profilePicUrl: string | null
  isVerified: boolean | null
  isPrivate: boolean | null
}

export function normalizeUser(u: HikerUserShort): NormalizedUser {
  const id = u.pk ?? u.id
  return {
    instagramUserId: id != null ? String(id) : null,
    username: u.username,
    fullName: u.full_name ?? null,
    profilePicUrl: u.profile_pic_url ?? u.profile_pic_url_hd ?? null,
    isVerified: u.is_verified ?? null,
    isPrivate: u.is_private ?? null,
  }
}

export type NormalizedContentType = 'media' | 'clip'

export interface NormalizedContent {
  id: string
  shortcode: string | null
  type: NormalizedContentType
  ownerUserId: string | null
  ownerUsername: string | null
  url: string | null
  timestamp: string | null
  // Prudence flag: the POC found /v1/user/medias/chunk's like_count field to
  // be unreliable (observed as a fixed low value while /v3/media/likers
  // returned far more profiles for the same media on the test account). This
  // count must never be presented as authoritative — see
  // scripts/hiker-poc/HIKER_POC_REPORT.md §6/§9.
  likeCount: number | null
  likeCountReliable: false
  commentCount: number | null
  viewCount: number | null
  rawMetadata: HikerMediaItem
}

export function normalizeContent(
  item: HikerMediaItem,
  type: NormalizedContentType,
  ownerUsername: string,
): NormalizedContent | null {
  const id = item.pk ?? item.id
  if (id == null) return null
  return {
    id: String(id),
    shortcode: item.code ?? null,
    type,
    ownerUserId: item.user?.pk != null ? String(item.user.pk) : item.user?.id != null ? String(item.user.id) : null,
    ownerUsername: item.user?.username ?? ownerUsername,
    url: item.code ? `https://www.instagram.com/${type === 'clip' ? 'reel' : 'p'}/${item.code}/` : null,
    // Same defensive validation as discovery.ts's comment timestamp handling
    // — item.taken_at is typed as a number but a truthy check alone doesn't
    // guarantee new Date(...) parses to a valid time, and an unvalidated
    // .toISOString() call here would throw and abort the whole discovery run.
    timestamp: (() => {
      if (typeof item.taken_at !== 'number') return null
      const d = new Date(item.taken_at * 1000)
      return Number.isNaN(d.getTime()) ? null : d.toISOString()
    })(),
    likeCount: item.like_count ?? null,
    likeCountReliable: false,
    commentCount: item.comment_count ?? null,
    viewCount: item.view_count ?? item.play_count ?? null,
    rawMetadata: item,
  }
}

// Deduplicates media + clips by content id, priority: media id, then
// shortcode as a fallback key if id is ever absent for one of the two but
// present for the other (kept for robustness — id is expected to always be
// present per HikerMediaItem probing, but shortcode collision is the safer
// fallback ordering per the mission's explicit priority: id, then shortcode).
export function dedupeContents(contents: NormalizedContent[]): NormalizedContent[] {
  const seenIds = new Set<string>()
  const seenShortcodes = new Set<string>()
  const result: NormalizedContent[] = []
  for (const c of contents) {
    if (seenIds.has(c.id)) continue
    if (c.shortcode && seenShortcodes.has(c.shortcode)) continue
    seenIds.add(c.id)
    if (c.shortcode) seenShortcodes.add(c.shortcode)
    result.push(c)
  }
  return result
}

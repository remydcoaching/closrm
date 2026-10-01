// Pure scan policy of the publication monitor (no I/O, unit-tested).
// Same idea as Insyder's scans, at a daily pace (Insyder: hourly — ~24× the
// HikerAPI cost): publications up to 60 days old are re-read every daily
// pass, older ones weekly, and a publication whose comment counter didn't
// move doesn't get its comments re-read.

const H = 3_600_000
const D = 24 * H

/** How long to wait before re-reading a publication, by age. */
export function scanIntervalMs(publishedAt: string | null, now: number): number {
  // Slightly under a day / a week so the next daily pass always picks it up.
  if (!publishedAt) return D - H
  const age = now - new Date(publishedAt).getTime()
  if (age < 60 * D) return D - H
  return 7 * D - H
}

export interface MonitoredContent {
  content_id: string
  published_at: string | null
  next_scan_at: string
  /** Meta's exact like count when synced from the Meta API (Hiker's is unreliable). */
  reported_like_count?: number | null
  /** reported_like_count when likers were last read (migration 122). */
  likes_read_at_count?: number | null
  reported_comment_count: number | null
  comments_read_at_count: number | null
  last_scanned_at: string | null
  last_status: 'ok' | 'error' | 'not_found' | null
}

/**
 * Comments are re-read only when their counter moved (or were never read /
 * last read failed) — and never when the Meta API already syncs them
 * (commentsFromMeta: free, exact dates), leaving Hiker for likers only.
 */
export function needsCommentsRead(c: MonitoredContent, commentsFromMeta = false): boolean {
  if (commentsFromMeta) return false
  if (c.last_status === 'error' || c.comments_read_at_count === null) return true
  if (c.reported_comment_count === null) return true
  return c.reported_comment_count !== c.comments_read_at_count
}

/** Billed requests a publication will cost this pass (likers = 1, comments ≈ 1 per 20 new). */
export function estimatedCost(c: MonitoredContent, commentsFromMeta = false): number {
  if (!needsCommentsRead(c, commentsFromMeta)) return 1
  const fresh = Math.max(0, (c.reported_comment_count ?? 20) - (c.comments_read_at_count ?? 0))
  return 1 + Math.min(MAX_COMMENT_PAGES, Math.max(1, Math.ceil(fresh / 20)))
}

export const MAX_COMMENT_PAGES = 5

/**
 * Publications due for a re-read, most urgent first (overdue the longest,
 * then most recent), while the estimated cost fits in `budget` requests.
 * Deleted publications are never re-read.
 */
export function pickDueContents(contents: MonitoredContent[], now: number, budget: number, commentsFromMeta = false): MonitoredContent[] {
  const due = contents
    .filter((c) => c.last_status !== 'not_found' && new Date(c.next_scan_at).getTime() <= now)
    .sort((a, b) => {
      const d = new Date(a.next_scan_at).getTime() - new Date(b.next_scan_at).getTime()
      if (d !== 0) return d
      return (b.published_at ?? '').localeCompare(a.published_at ?? '')
    })
  const out: MonitoredContent[] = []
  let spent = 0
  for (const c of due) {
    const cost = estimatedCost(c, commentsFromMeta)
    if (spent + cost > budget) continue
    out.push(c)
    spent += cost
  }
  return out
}

export interface ObservedGesture {
  contentId: string
  type: 'like' | 'comment'
  instagramUserId: string
  username: string
  fullName: string | null
  profilePicUrl: string | null
  /** '' for a like, the comment id for a comment. */
  dedupKey: string
  commentText: string | null
  commentedAt: string | null
}

export const observationKey = (g: { contentId: string; type: string; instagramUserId: string; dedupKey: string }) =>
  `${g.contentId}|${g.type}|${g.instagramUserId}|${g.dedupKey}`

/** Gestures not seen before (deduplicated within the pass too). */
export function newGestures(observed: ObservedGesture[], known: Set<string>): ObservedGesture[] {
  const seen = new Set(known)
  const out: ObservedGesture[] = []
  for (const g of observed) {
    const k = observationKey(g)
    if (seen.has(k)) continue
    seen.add(k)
    out.push(g)
  }
  return out
}

/** Requests left today under the daily cap. */
export function remainingBudget(maxPerDay: number, usedToday: number): number {
  return Math.max(0, maxPerDay - usedToday)
}

/**
 * With Meta's exact like counter: a publication is worth one paid likers read
 * only if it was never read, or if its like count went up since the last
 * read. Never-read ones first (newest first, the history backfill), then the
 * biggest like increases. One request each.
 */
export function pickDueByLikes(contents: MonitoredContent[], budget: number): MonitoredContent[] {
  const gain = (c: MonitoredContent) => (c.reported_like_count ?? 0) - (c.likes_read_at_count ?? 0)
  const due = contents.filter((c) => c.last_status !== 'not_found' && (c.last_scanned_at === null || c.last_status === 'error' || gain(c) > 0))
  due.sort((a, b) => {
    const neverA = a.last_scanned_at === null ? 1 : 0
    const neverB = b.last_scanned_at === null ? 1 : 0
    if (neverA !== neverB) return neverB - neverA
    if (neverA) return (b.published_at ?? '').localeCompare(a.published_at ?? '')
    return gain(b) - gain(a)
  })
  return due.slice(0, Math.max(0, budget))
}

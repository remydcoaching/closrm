// Pure scan policy of the publication monitor (no I/O, unit-tested).
// Same idea as Insyder's hourly scans: recent publications are re-read
// often (that's when people react), older ones less, and a publication
// whose comment counter didn't move doesn't get its comments re-read.

const H = 3_600_000
const D = 24 * H

/** How long to wait before re-reading a publication, by age. */
export function scanIntervalMs(publishedAt: string | null, now: number): number {
  if (!publishedAt) return D
  const age = now - new Date(publishedAt).getTime()
  if (age < 3 * D) return H
  if (age < 14 * D) return 6 * H
  if (age < 60 * D) return D
  return 7 * D
}

export interface MonitoredContent {
  content_id: string
  published_at: string | null
  next_scan_at: string
  reported_comment_count: number | null
  comments_read_at_count: number | null
  last_scanned_at: string | null
  last_status: 'ok' | 'error' | 'not_found' | null
}

/** Comments are re-read only when their counter moved (or were never read / last read failed). */
export function needsCommentsRead(c: MonitoredContent): boolean {
  if (c.last_status === 'error' || c.comments_read_at_count === null) return true
  if (c.reported_comment_count === null) return true
  return c.reported_comment_count !== c.comments_read_at_count
}

/** Billed requests a publication will cost this pass (likers = 1, comments ≈ 1 per 20 new). */
export function estimatedCost(c: MonitoredContent): number {
  if (!needsCommentsRead(c)) return 1
  const fresh = Math.max(0, (c.reported_comment_count ?? 20) - (c.comments_read_at_count ?? 0))
  return 1 + Math.min(MAX_COMMENT_PAGES, Math.max(1, Math.ceil(fresh / 20)))
}

export const MAX_COMMENT_PAGES = 5

/**
 * Publications due for a re-read, most urgent first (overdue the longest,
 * then most recent), while the estimated cost fits in `budget` requests.
 * Deleted publications are never re-read.
 */
export function pickDueContents(contents: MonitoredContent[], now: number, budget: number): MonitoredContent[] {
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
    const cost = estimatedCost(c)
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

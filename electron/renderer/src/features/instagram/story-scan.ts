// Incremental highlight scans: which stories don't need their viewer list
// read again. Instagram only lists a story's viewers during its first 48 h,
// so a list read successfully after that window is final.
export interface KnownStory {
  story_pk: string
  taken_at: string
  last_collected_at: string
  viewers_collected: number
  fetch_status?: 'ok' | 'error' | null
}

export const VIEWER_WINDOW_MS = 48 * 3_600_000

export function finalStoryPks(known: KnownStory[]): string[] {
  return known
    .filter((k) => (k.fetch_status ?? 'ok') === 'ok')
    .filter((k) => new Date(k.last_collected_at).getTime() >= new Date(k.taken_at).getTime() + VIEWER_WINDOW_MS)
    .map((k) => k.story_pk)
}

const RECHECK_EVERY_MS = 2 * 3_600_000
const FINAL_READ_AFTER_MS = 44 * 3_600_000

/**
 * Stories to re-read in the background collection: no longer live (> 24 h)
 * but still inside the 48 h window, where Instagram keeps adding viewers.
 * Re-read every 2 h, plus one last read after 44 h so the stored list is as
 * complete as Instagram allows. The main process drops the ones still live.
 */
export function storiesToRecheck(known: KnownStory[], now = Date.now()): { pk: string; takenAt: string }[] {
  return known
    .filter((k) => {
      const taken = new Date(k.taken_at).getTime()
      const last = new Date(k.last_collected_at).getTime()
      if (!(now - taken < VIEWER_WINDOW_MS)) return false
      const lastReadBeforeFinal = last < taken + FINAL_READ_AFTER_MS && now >= taken + FINAL_READ_AFTER_MS
      return now - last >= RECHECK_EVERY_MS || lastReadBeforeFinal || k.fetch_status === 'error'
    })
    .sort((a, b) => a.taken_at.localeCompare(b.taken_at))
    .slice(0, 50)
    .map((k) => ({ pk: k.story_pk, takenAt: k.taken_at }))
}

// ─── Highlights: what ClosRM knows about each story's viewers ─────────────
export type StoryViewerState = 'collected' | 'out_of_window' | 'error' | 'unknown'

export interface HighlightViewer {
  instagramUserId: string
  username: string
  fullName: string | null
  profilePicUrl: string | null
  leadId: string | null
  leadName: string | null
  storiesSeen: number
  storyPks: string[]
  liked: number
  lastObservedAt: string
}

export interface HighlightViewersReport {
  stories: { pk: string; state: StoryViewerState; viewersCollected: number | null }[]
  viewers: HighlightViewer[]
}

/**
 * The state to show for a highlight story. A story ClosRM never stored but
 * published more than 48 h ago is out of Instagram's window too.
 */
export function effectiveState(state: StoryViewerState | undefined, takenAt: string, now = Date.now()): StoryViewerState {
  if (state && state !== 'unknown') return state
  return now - new Date(takenAt).getTime() > VIEWER_WINDOW_MS ? 'out_of_window' : 'unknown'
}

export function storyViewerNote(state: StoryViewerState, collected: number | null): string {
  switch (state) {
    case 'collected':
      return `${collected ?? 0} spectateur${(collected ?? 0) > 1 ? 's' : ''} identifié${(collected ?? 0) > 1 ? 's' : ''}`
    case 'out_of_window':
      return 'Spectateurs non fournis par Instagram (> 48 h)'
    case 'error':
      return 'Lecture échouée — réessayée au prochain scan'
    default:
      return 'Pas encore collectée'
  }
}

/** Viewers restricted to one collection's stories, re-counted and re-sorted. */
export function viewersOfStories(viewers: HighlightViewer[], pks: string[]): HighlightViewer[] {
  const set = new Set(pks)
  return viewers
    .map((v) => {
      const storyPks = v.storyPks.filter((pk) => set.has(pk))
      return { ...v, storyPks, storiesSeen: storyPks.length }
    })
    .filter((v) => v.storiesSeen > 0)
    .sort((a, b) => b.storiesSeen - a.storiesSeen || b.lastObservedAt.localeCompare(a.lastObservedAt))
}

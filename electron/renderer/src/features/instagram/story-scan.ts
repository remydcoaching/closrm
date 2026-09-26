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

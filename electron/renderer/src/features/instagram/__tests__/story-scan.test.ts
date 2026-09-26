import { describe, expect, it } from 'vitest'
import { finalStoryPks } from '../story-scan'

describe('finalStoryPks', () => {
  it('skips only stories read successfully after their 48 h window', () => {
    expect(
      finalStoryPks([
        { story_pk: 'final', taken_at: '2026-09-01T00:00:00Z', last_collected_at: '2026-09-05T00:00:00Z', viewers_collected: 3, fetch_status: 'ok' },
        { story_pk: 'still-open', taken_at: '2026-09-01T00:00:00Z', last_collected_at: '2026-09-01T12:00:00Z', viewers_collected: 3, fetch_status: 'ok' },
        { story_pk: 'failed', taken_at: '2026-09-01T00:00:00Z', last_collected_at: '2026-09-05T00:00:00Z', viewers_collected: 0, fetch_status: 'error' },
        { story_pk: 'legacy', taken_at: '2026-09-01T00:00:00Z', last_collected_at: '2026-09-05T00:00:00Z', viewers_collected: 0 },
      ]),
    ).toEqual(['final', 'legacy'])
  })
})

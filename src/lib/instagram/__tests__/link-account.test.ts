import { describe, expect, it } from 'vitest'
import { baselineFor } from '../link-account'

describe('baselineFor (starting figures of the progress charts)', () => {
  const existing = { starting_followers: 366, starting_date: '2026-04-23', starting_monthly_views: 1200, starting_engagement: 3, starting_best_reel: 9000 }
  it('a re-link (Meta reconnection) keeps the stored baseline', () => {
    expect(baselineFor(existing, {}, 604, '2026-09-29')).toEqual(existing)
  })
  it('values sent by the setup form win', () => {
    expect(baselineFor(existing, { starting_followers: 500 }, 604, '2026-09-29').starting_followers).toBe(500)
  })
  it('a first link starts from today', () => {
    expect(baselineFor(null, {}, 604, '2026-09-29')).toEqual({ starting_followers: 604, starting_date: '2026-09-29', starting_monthly_views: 0, starting_engagement: 0, starting_best_reel: 0 })
  })
})

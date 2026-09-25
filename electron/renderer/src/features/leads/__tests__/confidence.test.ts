import { describe, expect, it } from 'vitest'
import { confidenceLevel, weeklyFrequency } from '../confidence'
import type { EngagementScore } from '../types'

const NOW = new Date('2026-09-25T00:00:00Z')

function score(overrides: Partial<EngagementScore> = {}): EngagementScore {
  return {
    score: 85,
    likesCount: 10,
    commentsCount: 2,
    dmCount: 0,
    mentionCount: 0,
    totalInteractions: 12,
    distinctContentCount: 6,
    firstInteractionAt: '2026-08-28T00:00:00Z',
    lastInteractionAt: '2026-09-20T00:00:00Z',
    signals: [],
    ...overrides,
  }
}

describe('confidenceLevel', () => {
  it('maps the score to a level when data is sufficient and recent', () => {
    expect(confidenceLevel(score(), NOW)).toBe('tres_eleve')
    expect(confidenceLevel(score({ score: 65 }), NOW)).toBe('eleve')
    expect(confidenceLevel(score({ score: 45 }), NOW)).toBe('moyen')
    expect(confidenceLevel(score({ score: 10 }), NOW)).toBe('faible')
  })
  it('is insufficient without any interaction', () => {
    expect(confidenceLevel(score({ totalInteractions: 0 }), NOW)).toBe('insuffisant')
  })
  it('caps at moyen with too few data points', () => {
    expect(confidenceLevel(score({ totalInteractions: 2 }), NOW)).toBe('moyen')
    expect(confidenceLevel(score({ distinctContentCount: 1 }), NOW)).toBe('moyen')
  })
  it('drops one level when the last interaction is older than 60 days', () => {
    expect(confidenceLevel(score({ lastInteractionAt: '2026-06-01T00:00:00Z' }), NOW)).toBe('eleve')
  })
})

describe('weeklyFrequency', () => {
  it('returns interactions per week since the first one', () => {
    expect(weeklyFrequency(score(), NOW)).toBeCloseTo(12 / 28 * 7)
  })
  it('is null without history', () => {
    expect(weeklyFrequency(score({ firstInteractionAt: null }), NOW)).toBeNull()
  })
})

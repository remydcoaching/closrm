import { describe, expect, it } from 'vitest'
import { segmentAudience, wasContacted, type EngagedLead } from '../audience-segments'

const NOW = new Date('2026-09-25T12:00:00Z')

function lead(overrides: Partial<EngagedLead>): EngagedLead {
  return {
    id: 'l',
    lastSeenAt: '2026-09-24T12:00:00Z',
    callAttempts: 0,
    dmConversationActiveAt: null,
    dmSent: false,
    followsTarget: null,
    ...overrides,
  }
}

describe('wasContacted', () => {
  it('is false when no call, no DM conversation and no DM sent', () => {
    expect(wasContacted(lead({}))).toBe(false)
  })
  it('is true for any call attempt, active DM conversation or DM sent', () => {
    expect(wasContacted(lead({ callAttempts: 1 }))).toBe(true)
    expect(wasContacted(lead({ dmConversationActiveAt: '2026-09-01T00:00:00Z' }))).toBe(true)
    expect(wasContacted(lead({ dmSent: true }))).toBe(true)
  })
})

describe('segmentAudience', () => {
  it('returns zeros for no engaged lead', () => {
    expect(segmentAudience([], 7, NOW)).toEqual({
      totalEngaged: 0,
      actifs: 0,
      actifsJamaisContactes: 0,
      neVousSuiventPas: 0,
      lurkers: 0,
    })
  })

  it('splits active / never-contacted / not-following / lurkers', () => {
    const leads = [
      lead({ id: 'a' }), // active, never contacted
      lead({ id: 'b', dmSent: true }), // active, contacted
      lead({ id: 'c', lastSeenAt: '2026-08-01T00:00:00Z', followsTarget: false }), // old, never contacted, not following
      lead({ id: 'd', lastSeenAt: '2026-08-01T00:00:00Z', callAttempts: 2, followsTarget: true }), // old, contacted
    ]
    expect(segmentAudience(leads, 7, NOW)).toEqual({
      totalEngaged: 4,
      actifs: 2,
      actifsJamaisContactes: 1,
      neVousSuiventPas: 1,
      lurkers: 2,
    })
  })

  it('widens "actifs" with the period', () => {
    const leads = [lead({ lastSeenAt: '2026-09-01T00:00:00Z' })]
    expect(segmentAudience(leads, 7, NOW).actifs).toBe(0)
    expect(segmentAudience(leads, 30, NOW).actifs).toBe(1)
  })
})

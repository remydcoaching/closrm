import { describe, expect, it } from 'vitest'
import { bestSlots, publishTiming, slotOf } from '../publish-timing'

// Local-time constructor so the test does not depend on the machine's TZ.
const at = (y: number, m: number, d: number, h: number) => new Date(y, m - 1, d, h).toISOString()

describe('slotOf', () => {
  it('buckets hours into 4 slots', () => {
    expect(slotOf(7)).toBe(0)
    expect(slotOf(13)).toBe(1)
    expect(slotOf(20)).toBe(2)
    expect(slotOf(2)).toBe(3)
    expect(slotOf(23)).toBe(3)
  })
})

describe('publishTiming', () => {
  it('averages the rate per weekday × slot and ignores contents without rate', () => {
    // 2026-09-21 is a Monday
    const cells = publishTiming([
      { publishedAt: at(2026, 9, 21, 19), engagementRate: 0.04 },
      { publishedAt: at(2026, 9, 28, 20), engagementRate: 0.02 },
      { publishedAt: at(2026, 9, 22, 8), engagementRate: null },
    ])
    expect(cells).toHaveLength(28)
    const mondayEvening = cells.find((c) => c.weekday === 0 && c.slot === 2)!
    expect(mondayEvening.count).toBe(2)
    expect(mondayEvening.avgRate).toBeCloseTo(0.03)
    expect(cells.find((c) => c.weekday === 1 && c.slot === 0)!.count).toBe(0)
  })
})

describe('bestSlots', () => {
  it('ranks only cells with enough samples', () => {
    const cells = publishTiming([
      { publishedAt: at(2026, 9, 21, 19), engagementRate: 0.04 },
      { publishedAt: at(2026, 9, 28, 20), engagementRate: 0.02 },
      { publishedAt: at(2026, 9, 22, 8), engagementRate: 0.5 }, // single sample, not significant
    ])
    const best = bestSlots(cells)
    expect(best).toHaveLength(1)
    expect(best[0]).toMatchObject({ weekday: 0, slot: 2 })
  })
})

import { describe, expect, it } from 'vitest'
import { nextWakeUpMs } from '../story-collector'

describe('nextWakeUpMs (Insyder-style randomized wake-ups)', () => {
  it('stays between 15 and 60 minutes', () => {
    expect(nextWakeUpMs(0)).toBe(15 * 60_000)
    expect(nextWakeUpMs(1)).toBe(60 * 60_000)
    for (let i = 0; i < 100; i++) {
      const ms = nextWakeUpMs()
      expect(ms).toBeGreaterThanOrEqual(15 * 60_000)
      expect(ms).toBeLessThanOrEqual(60 * 60_000)
    }
  })
})

import { describe, expect, it } from 'vitest'
import { bestHour, bestWeekday, median } from '../best-time'

const at = (y: number, mo: number, d: number, h: number) => new Date(y, mo - 1, d, h, 30).toISOString()

describe('Quand publier', () => {
  it('median', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([1, 2, 3, 4])).toBe(2.5)
    expect(median([])).toBeNull()
  })
  it('best hour = highest median among hours with enough contents', () => {
    const r = bestHour([
      { at: at(2026, 9, 1, 16), value: 100 },
      { at: at(2026, 9, 2, 16), value: 300 },
      { at: at(2026, 9, 3, 9), value: 150 },
      { at: at(2026, 9, 4, 9), value: 170 },
      { at: at(2026, 9, 5, 21), value: 5000 }, // alone: not compared
    ])
    expect(r.best).toBe(16)
    expect(r.bestMedian).toBe(200)
    expect(r.compared).toBe(2)
    expect(r.medians[21]).toBeNull()
  })
  it('best weekday (0 = lundi)', () => {
    // 2026-09-07 is a Monday, 2026-09-09 a Wednesday
    const r = bestWeekday([
      { at: at(2026, 9, 7, 10), value: 10 },
      { at: at(2026, 9, 14, 10), value: 12 },
      { at: at(2026, 9, 9, 10), value: 50 },
      { at: at(2026, 9, 16, 10), value: 70 },
    ])
    expect(r.best).toBe(2)
    expect(r.bestMedian).toBe(60)
  })
})

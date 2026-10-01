import { describe, expect, it } from 'vitest'
import { rateTicks } from '../ScatterChart'

describe('rateTicks', () => {
  it('2 % steps up to 8–10 % like Insyder', () => {
    expect(rateTicks(0.088)).toEqual([0, 0.02, 0.04, 0.06, 0.08, 0.1])
  })
  it('finer steps for low rates', () => {
    expect(rateTicks(0.021)).toEqual([0, 0.005, 0.01, 0.015, 0.02, 0.025])
  })
})

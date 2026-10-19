import { describe, expect, it } from 'vitest'
import { createSwipeDetector } from './swipe'

/** A swipe: rising then decaying deltas (fingers, then inertia), one event every 16 ms. */
function gesture(sign: 1 | -1, deltas = [4, 10, 20, 30, 30, 22, 16, 12, 9, 6, 4, 3, 2, 1]) {
  return deltas.map((d) => sign * d)
}

function run(d: ReturnType<typeof createSwipeDetector>, events: number[], t0: number) {
  return events.map((dx, i) => d.feed(dx, 0, t0 + i * 16)).filter((r) => r !== 0)
}

describe('createSwipeDetector', () => {
  it('un swipe vers la gauche = période suivante, une seule fois malgré l’inertie', () => {
    expect(run(createSwipeDetector(), gesture(1), 0)).toEqual([1])
  })
  it('un swipe vers la droite = période précédente', () => {
    expect(run(createSwipeDetector(), gesture(-1), 0)).toEqual([-1])
  })
  it('swipe droite juste après un swipe gauche, pendant l’inertie', () => {
    const d = createSwipeDetector()
    const left = gesture(1, [4, 10, 20, 30, 30, 22, 16]) // still in inertia when the next one starts
    expect(run(d, left, 0)).toEqual([1])
    expect(run(d, gesture(-1), left.length * 16)).toEqual([-1])
  })
  it('deux swipes gauche enchaînés', () => {
    const d = createSwipeDetector()
    const first = gesture(1, [4, 10, 20, 30, 30, 22, 16, 12, 9])
    expect(run(d, first, 0)).toEqual([1])
    expect(run(d, gesture(1), first.length * 16)).toEqual([1])
  })
  it('vrai swipe droite du trackpad de Pierre (accélère encore après le déclenchement) = un seul cran', () => {
    const real = [-1, -5, -15, -41, -73, -77, -123, -130, -128, -125, -118, -112, -107, -101, -90, -70, -50, -30, -15, -8, -4, -2, -1]
    expect(run(createSwipeDetector(), real, 0)).toEqual([-1])
  })
  it('vrai swipe gauche du trackpad de Pierre = un seul cran', () => {
    const real = [1, 2, 11, 25, 46, 57, 52, 66, 74, 75, 74, 71, 68, 70, 66, 62, 58, 53, 51, 47, 43, 39, 37, 34, 31, 28]
    expect(run(createSwipeDetector(), real, 0)).toEqual([1])
  })
  it('ignore le défilement vertical', () => {
    const d = createSwipeDetector()
    expect([10, 30, 50].map((dy, i) => d.feed(5, dy, i * 16))).toEqual([0, 0, 0])
  })
})

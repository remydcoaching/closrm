// Horizontal trackpad swipe detection from wheel events. One swipe = one
// slide. A macOS swipe sends rising deltas (fingers accelerating), then
// decaying ones (inertia after the fingers lift): none of those may trigger a
// second slide. A new swipe is either the opposite direction, or the same
// direction picking up again after the deltas had died down.

export interface SwipeDetector {
  /** Feeds one wheel event; returns the slide to apply (+1 next, -1 previous) or 0. */
  feed(deltaX: number, deltaY: number, now: number): 1 | -1 | 0
}

const TRIGGER = 60 // accumulated px before a swipe counts
const GESTURE_GAP_MS = 250 // a pause this long ends the gesture

export function createSwipeDetector(): SwipeDetector {
  let acc = 0
  let locked = false
  let lockedDir: 1 | -1 = 1
  let peak = 0 // biggest delta of the locked gesture
  let valley = Infinity // smallest delta since the peak
  let lastAt = -Infinity

  return {
    feed(deltaX, deltaY, now) {
      if (Math.abs(deltaX) <= Math.abs(deltaY) || deltaX === 0) return 0
      const dir: 1 | -1 = deltaX > 0 ? 1 : -1
      const abs = Math.abs(deltaX)
      const gap = now - lastAt
      lastAt = now

      if (locked) {
        const ended = gap > GESTURE_GAP_MS
        const reversed = dir !== lockedDir
        const pickedUp = valley <= peak * 0.5 && abs >= valley * 2 && abs > 8
        if (!ended && !reversed && !pickedUp) {
          if (abs > peak) {
            peak = abs
            valley = Infinity
          } else {
            valley = Math.min(valley, abs)
          }
          return 0
        }
        locked = false
        acc = 0
      }

      if (gap > GESTURE_GAP_MS || Math.sign(acc) !== dir) acc = 0
      acc += deltaX
      if (Math.abs(acc) < TRIGGER) return 0
      locked = true
      lockedDir = dir
      peak = abs
      valley = Infinity
      acc = 0
      return dir
    },
  }
}

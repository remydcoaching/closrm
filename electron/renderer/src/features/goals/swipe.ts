// Horizontal trackpad swipe detection from wheel events. macOS keeps sending
// wheel events after the fingers lift (inertia, same direction, shrinking):
// those must not trigger a second slide, but a new swipe — opposite direction,
// or the same direction speeding up again — must.

export interface SwipeDetector {
  /** Feeds one wheel event; returns the slide to apply (+1 next, -1 previous) or 0. */
  feed(deltaX: number, deltaY: number, now: number): 1 | -1 | 0
}

const TRIGGER = 60 // accumulated px before a swipe counts
const INERTIA_GAP_MS = 250 // a pause this long ends the gesture

export function createSwipeDetector(): SwipeDetector {
  let acc = 0
  let locked = false
  let lockedDir: 1 | -1 = 1
  let lastAt = -Infinity
  let lastAbs = 0

  return {
    feed(deltaX, deltaY, now) {
      if (Math.abs(deltaX) <= Math.abs(deltaY) || deltaX === 0) return 0
      const dir: 1 | -1 = deltaX > 0 ? 1 : -1
      const abs = Math.abs(deltaX)
      if (locked) {
        const gestureOver = now - lastAt > INERTIA_GAP_MS
        const newGesture = dir !== lockedDir || (abs > lastAbs * 1.5 && abs > 8)
        if (!gestureOver && !newGesture) {
          lastAt = now
          lastAbs = abs
          return 0
        }
        locked = false
        acc = 0
      }
      if (now - lastAt > INERTIA_GAP_MS || Math.sign(acc) !== dir) acc = 0
      lastAt = now
      lastAbs = abs
      acc += deltaX
      if (Math.abs(acc) < TRIGGER) return 0
      locked = true
      lockedDir = dir
      acc = 0
      return dir
    },
  }
}

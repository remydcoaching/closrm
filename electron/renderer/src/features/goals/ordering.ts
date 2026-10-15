// Ordering inside a column. `position` is a float: inserting between two goals
// takes the midpoint, so a move only PATCHes the moved goal. When two neighbours
// get too close (after ~50 inserts at the same spot), the column is renumbered.

export const POSITION_STEP = 1024
const MIN_GAP = 1e-6

export interface Positioned {
  id: string
  position: number
}

export function sortByPosition<T extends Positioned & { created_at?: string }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => a.position - b.position || (a.created_at ?? '').localeCompare(b.created_at ?? '') || a.id.localeCompare(b.id),
  )
}

/** Position for an item placed between `before` and `after` (either can be absent). */
export function positionBetween(before?: number | null, after?: number | null): number {
  const hasB = before !== undefined && before !== null
  const hasA = after !== undefined && after !== null
  if (!hasB && !hasA) return POSITION_STEP
  if (!hasB) return (after as number) - POSITION_STEP
  if (!hasA) return (before as number) + POSITION_STEP
  return ((before as number) + (after as number)) / 2
}

/** Position for a new goal appended at the bottom of a column ("Ajouter…"). */
export function positionAtEnd(items: Positioned[]): number {
  if (items.length === 0) return POSITION_STEP
  return Math.max(...items.map((i) => i.position)) + POSITION_STEP
}

export interface MoveResult {
  /** Position of the moved goal. */
  position: number
  /** Non-empty only when the column had to be renumbered: id -> new position. */
  rebalanced: Record<string, number>
}

/**
 * Computes the position of `movedId` dropped at `targetIndex` in `column`
 * (column = goals of the destination period, the moved one may or may not be in it).
 */
export function computeMove(column: Positioned[], movedId: string, targetIndex: number): MoveResult {
  const others = sortByPosition(column.filter((g) => g.id !== movedId))
  const idx = Math.max(0, Math.min(targetIndex, others.length))
  const before = others[idx - 1]?.position
  const after = others[idx]?.position
  const position = positionBetween(before, after)

  const tooClose =
    (before !== undefined && Math.abs(position - before) < MIN_GAP) ||
    (after !== undefined && Math.abs(after - position) < MIN_GAP)
  if (!tooClose) return { position, rebalanced: {} }

  const ids = others.map((g) => g.id)
  ids.splice(idx, 0, movedId)
  const rebalanced: Record<string, number> = {}
  ids.forEach((id, i) => { rebalanced[id] = (i + 1) * POSITION_STEP })
  return { position: rebalanced[movedId], rebalanced }
}

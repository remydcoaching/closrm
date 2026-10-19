import { describe, expect, it } from 'vitest'
import { computeMove, POSITION_STEP, positionAtEnd, positionBetween, sortByPosition } from './ordering'

const col = (...positions: number[]) => positions.map((position, i) => ({ id: `g${i}`, position }))

describe('positionBetween', () => {
  it('colonne vide', () => expect(positionBetween()).toBe(POSITION_STEP))
  it('en tête', () => expect(positionBetween(undefined, 1024)).toBe(0))
  it('en fin', () => expect(positionBetween(2048, undefined)).toBe(3072))
  it('au milieu', () => expect(positionBetween(1024, 2048)).toBe(1536))
})

describe('positionAtEnd', () => {
  it('ajoute après le max', () => expect(positionAtEnd(col(1024, 5000, 2048))).toBe(5000 + POSITION_STEP))
  it('colonne vide', () => expect(positionAtEnd([])).toBe(POSITION_STEP))
})

describe('sortByPosition', () => {
  it('trie par position puis created_at puis id', () => {
    const items = [
      { id: 'b', position: 2, created_at: '2026-01-01' },
      { id: 'a', position: 1, created_at: '2026-01-02' },
      { id: 'c', position: 2, created_at: '2025-12-31' },
    ]
    expect(sortByPosition(items).map((i) => i.id)).toEqual(['a', 'c', 'b'])
  })
})

describe('computeMove', () => {
  it('déplace dans la même colonne (ignore l’élément déplacé)', () => {
    const c = col(1024, 2048, 3072) // g0 g1 g2
    // move g0 between g1 and g2 → index 1 among [g1, g2]
    expect(computeMove(c, 'g0', 1)).toEqual({ position: 2560, rebalanced: {} })
  })
  it('dépose depuis une autre colonne, en tête', () => {
    expect(computeMove(col(1024, 2048), 'x', 0).position).toBe(0)
  })
  it('borne l’index', () => {
    expect(computeMove(col(1024), 'x', 99).position).toBe(2048)
    expect(computeMove(col(1024), 'x', -3).position).toBe(0)
  })
  it('renumérote quand l’écart devient trop petit', () => {
    const c = [{ id: 'a', position: 1 }, { id: 'b', position: 1 + 1e-7 }]
    const r = computeMove(c, 'x', 1)
    expect(r.rebalanced).toEqual({ a: 1024, x: 2048, b: 3072 })
    expect(r.position).toBe(2048)
  })
  it('des insertions répétées au même endroit restent ordonnées', () => {
    let items = col(1024, 2048)
    for (let i = 0; i < 80; i++) {
      const id = `n${i}`
      const { position, rebalanced } = computeMove(items, id, 1)
      items = items.map((g) => (rebalanced[g.id] !== undefined ? { ...g, position: rebalanced[g.id] } : g))
      items.push({ id, position })
    }
    const ids = sortByPosition(items).map((g) => g.id)
    expect(ids[0]).toBe('g0')
    expect(ids[1]).toBe('n79')
    expect(ids[ids.length - 1]).toBe('g1')
  })
})

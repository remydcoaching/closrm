import { describe, expect, it } from 'vitest'
import { dropCreatesSubGoal, propagateDone } from './goal-tree'

const g = (id: string, parent_id: string | null, done = false) => ({ id, parent_id, done_at: done ? '2026-10-16T10:00:00Z' : null })
const doneIds = (goals: { id: string; done_at: string | null }[]) => goals.filter((x) => x.done_at).map((x) => x.id)

describe('dropCreatesSubGoal', () => {
  it('mois → semaine, année → mois, vie → année : sous-objectif', () => {
    expect(dropCreatesSubGoal('month', 'week')).toBe(true)
    expect(dropCreatesSubGoal('year', 'month')).toBe(true)
    expect(dropCreatesSubGoal('life', 'year')).toBe(true)
    expect(dropCreatesSubGoal('month', 'day')).toBe(true)
  })
  it('même horizon, horizon plus long, Inbox : déplacement', () => {
    expect(dropCreatesSubGoal('week', 'week')).toBe(false)
    expect(dropCreatesSubGoal('week', 'month')).toBe(false)
    expect(dropCreatesSubGoal('inbox', 'week')).toBe(false)
    expect(dropCreatesSubGoal('month', 'inbox')).toBe(false)
  })
})

describe('propagateDone', () => {
  it('« 100 reels » glissé dans une seule semaine : cocher la semaine coche le mois', () => {
    const goals = [g('month', null), g('week', 'month', true)]
    expect(doneIds(propagateDone(goals, 'week'))).toEqual(['month', 'week'])
  })
  it('glissé dans 2 semaines : le mois attend les deux', () => {
    const goals = [g('month', null), g('w1', 'month', true), g('w2', 'month')]
    expect(doneIds(propagateDone(goals, 'w1'))).toEqual(['w1'])
    const both = propagateDone([g('month', null), g('w1', 'month', true), g('w2', 'month', true)], 'w2')
    expect(doneIds(both)).toEqual(['month', 'w1', 'w2'])
  })
  it('décocher une semaine décoche le mois, et l’année au-dessus', () => {
    const goals = [g('year', null, true), g('month', 'year', true), g('w1', 'month', false)]
    expect(doneIds(propagateDone(goals, 'w1'))).toEqual([])
  })
  it('remonte plusieurs niveaux', () => {
    const goals = [g('year', null), g('month', 'year'), g('week', 'month', true)]
    expect(doneIds(propagateDone(goals, 'week'))).toEqual(['year', 'month', 'week'])
  })
  it('garde la date de validation d’un parent déjà fait', () => {
    const goals = [{ id: 'm', parent_id: null, done_at: '2026-10-01T00:00:00Z' }, g('w', 'm', true)]
    expect(propagateDone(goals, 'w', '2026-10-16T12:00:00Z')[0].done_at).toBe('2026-10-01T00:00:00Z')
  })
})

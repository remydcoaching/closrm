import { describe, expect, it } from 'vitest'
import { dropCreatesSubGoal, horizonsDown, moveSubtree, propagateDone } from './goal-tree'

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

describe('horizonsDown', () => {
  it('passe par chaque niveau, sans en sauter', () => {
    expect(horizonsDown('year', 'week')).toEqual(['quarter', 'month', 'week'])
    expect(horizonsDown('year', 'month')).toEqual(['quarter', 'month'])
    expect(horizonsDown('month', 'week')).toEqual(['week'])
    expect(horizonsDown('life', 'quarter')).toEqual(['year', 'quarter'])
    expect(horizonsDown('week', 'month')).toEqual([])
  })
})

describe('moveSubtree', () => {
  const G = (id: string, parent_id: string | null, horizon: string, period_start: string | null) =>
    ({ id, parent_id, horizon, period_start }) as { id: string; parent_id: string | null; horizon: import('./periods').Horizon; period_start: string | null }
  const place = (gs: ReturnType<typeof G>[]) => Object.fromEntries(gs.map((g) => [g.id, `${g.horizon} ${g.period_start}`]))

  it('S42 → S43 : les jours suivent (mardi → mardi)', () => {
    const goals = [G('w', null, 'week', '2026-10-12'), G('d1', 'w', 'day', '2026-10-13'), G('d2', 'w', 'day', '2026-10-18')]
    expect(place(moveSubtree(goals, 'w', { horizon: 'week', period_start: '2026-10-19' }))).toEqual({
      w: 'week 2026-10-19', d1: 'day 2026-10-20', d2: 'day 2026-10-25',
    })
  })
  it('permis : T4 → année, les mois deviennent des trimestres, les semaines des mois', () => {
    const goals = [
      G('p', null, 'quarter', '2026-10-01'), G('m', 'p', 'month', '2026-10-01'),
      G('w', 'm', 'week', '2026-10-12'), G('d', 'w', 'day', '2026-10-15'),
    ]
    expect(place(moveSubtree(goals, 'p', { horizon: 'year', period_start: '2026-01-01' }))).toEqual({
      p: 'year 2026-01-01', m: 'quarter 2026-10-01', w: 'month 2026-10-01', d: 'week 2026-10-12',
    })
  })
  it('mois → mois suivant : les semaines restent dans le nouveau mois', () => {
    const goals = [G('m', null, 'month', '2026-10-01'), G('w', 'm', 'week', '2026-10-26')]
    // 26 oct. + 31 j = 26 nov. → semaine du 23 nov.
    expect(place(moveSubtree(goals, 'm', { horizon: 'month', period_start: '2026-11-01' }))).toEqual({ m: 'month 2026-11-01', w: 'week 2026-11-23' })
  })
  it('vers l’Inbox : toute la descendance part dans l’Inbox', () => {
    const goals = [G('w', null, 'week', '2026-10-12'), G('d', 'w', 'day', '2026-10-13')]
    expect(place(moveSubtree(goals, 'w', { horizon: 'inbox', period_start: null }))).toEqual({ w: 'inbox null', d: 'inbox null' })
  })
  it('un sous-objectif glissé seul : son parent ne bouge pas', () => {
    const goals = [G('m', null, 'month', '2026-10-01'), G('w', 'm', 'week', '2026-10-12'), G('d', 'w', 'day', '2026-10-13')]
    expect(place(moveSubtree(goals, 'w', { horizon: 'week', period_start: '2026-10-19' }))).toEqual({
      m: 'month 2026-10-01', w: 'week 2026-10-19', d: 'day 2026-10-20',
    })
  })
})

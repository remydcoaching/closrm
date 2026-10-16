import { describe, expect, it } from 'vitest'
import { createGoalSchema, goalsQuerySchema, updateGoalSchema } from '../goals'

const uuid = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'

describe('createGoalSchema', () => {
  it('accepte un objectif de semaine', () => {
    const r = createGoalSchema.safeParse({ title: '  Ecriture + tournage ', horizon: 'week', period_start: '2026-10-12' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.title).toBe('Ecriture + tournage')
  })
  it('accepte un objectif Inbox sans date', () => {
    expect(createGoalSchema.safeParse({ title: 'Idée', horizon: 'inbox' }).success).toBe(true)
  })
  it('accepte un objectif Vie sans date, refuse un objectif Vie daté', () => {
    expect(createGoalSchema.safeParse({ title: 'Vivre à Bali', horizon: 'life' }).success).toBe(true)
    expect(createGoalSchema.safeParse({ title: 'x', horizon: 'life', period_start: '2026-01-01' }).success).toBe(false)
  })
  it('refuse un objectif Inbox daté', () => {
    expect(createGoalSchema.safeParse({ title: 'x', horizon: 'inbox', period_start: '2026-10-12' }).success).toBe(false)
  })
  it('refuse un objectif daté sans période', () => {
    expect(createGoalSchema.safeParse({ title: 'x', horizon: 'month' }).success).toBe(false)
  })
  it('refuse titre vide, horizon inconnu, date invalide, parent non uuid', () => {
    expect(createGoalSchema.safeParse({ title: '   ', horizon: 'inbox' }).success).toBe(false)
    expect(createGoalSchema.safeParse({ title: 'x', horizon: 'decade', period_start: '2026-01-01' }).success).toBe(false)
    expect(createGoalSchema.safeParse({ title: 'x', horizon: 'day', period_start: '2026-02-30' }).success).toBe(false)
    expect(createGoalSchema.safeParse({ title: 'x', horizon: 'day', period_start: '15/10/2026' }).success).toBe(false)
    expect(createGoalSchema.safeParse({ title: 'x', horizon: 'inbox', parent_id: 'abc' }).success).toBe(false)
  })
  it('accepte un sous-objectif', () => {
    expect(createGoalSchema.safeParse({ title: 'Ecriture reels', horizon: 'day', period_start: '2026-10-15', parent_id: uuid }).success).toBe(true)
  })
})

describe('updateGoalSchema', () => {
  it('cocher / décocher', () => {
    expect(updateGoalSchema.safeParse({ done: true }).success).toBe(true)
    expect(updateGoalSchema.safeParse({ done: false }).success).toBe(true)
  })
  it('déplacer vers un autre horizon exige la période', () => {
    expect(updateGoalSchema.safeParse({ horizon: 'month' }).success).toBe(false)
    expect(updateGoalSchema.safeParse({ horizon: 'month', period_start: '2026-10-01', position: 1536 }).success).toBe(true)
  })
  it('déplacer vers l’Inbox', () => {
    expect(updateGoalSchema.safeParse({ horizon: 'inbox', period_start: null }).success).toBe(true)
    expect(updateGoalSchema.safeParse({ horizon: 'inbox', period_start: '2026-10-01' }).success).toBe(false)
  })
  it('détacher du parent', () => expect(updateGoalSchema.safeParse({ parent_id: null }).success).toBe(true))
  it('refuse un corps vide ou un champ inconnu', () => {
    expect(updateGoalSchema.safeParse({}).success).toBe(false)
    expect(updateGoalSchema.safeParse({ workspace_id: uuid }).success).toBe(false)
  })
})

describe('goalsQuerySchema', () => {
  it('accepte horizon + bornes', () => {
    expect(goalsQuerySchema.safeParse({ horizon: 'week', from: '2026-09-01', to: '2026-12-31' }).success).toBe(true)
  })
  it('refuse from > to', () => {
    expect(goalsQuerySchema.safeParse({ from: '2026-12-31', to: '2026-01-01' }).success).toBe(false)
  })
})

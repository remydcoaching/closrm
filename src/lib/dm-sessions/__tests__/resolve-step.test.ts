import { describe, it, expect } from 'vitest'
import { resolveSessionStep } from '../resolve-step'

interface Step {
  id: string
  title: string
  step_type: 'message' | 'relance'
  content: string
  delay_days: number | null
  next_step_id?: string | null
  applies_to_category?: 'premier_contact' | 'relance_en_retard' | 'jamais_recontacte' | 'any' | null
}

interface Transition {
  step_id: string
  outcome_label: string
  target_step_id: string
}

function makeSupabaseStub(opts: {
  activeProcess?: { id: string } | null
  steps?: Step[]
  transitions?: Transition[]
}) {
  return {
    from(table: string) {
      const builder: Record<string, unknown> = {}
      const chain = () => builder
      builder.select = chain
      builder.order = chain
      builder.limit = chain
      let stepIdFilter: string | null = null
      builder.eq = (column: string, value: string) => {
        if (table === 'setting_process_step_transitions' && column === 'step_id') {
          stepIdFilter = value
        }
        return builder
      }
      if (table === 'setting_processes') {
        builder.maybeSingle = () => Promise.resolve({ data: opts.activeProcess ?? null, error: null })
      }
      builder.then = (resolve: (v: { data: unknown[]; error: null }) => void) => {
        if (table === 'setting_process_steps') {
          return resolve({ data: opts.steps ?? [], error: null })
        }
        if (table === 'setting_process_step_transitions') {
          const rows = (opts.transitions ?? [])
            .filter((t) => t.step_id === stepIdFilter)
            .map(({ outcome_label, target_step_id }) => ({ outcome_label, target_step_id }))
          return resolve({ data: rows, error: null })
        }
        return resolve({ data: [], error: null })
      }
      return builder
    },
  }
}

describe('resolveSessionStep', () => {
  it('falls back to pickTemplate when no active process exists', async () => {
    const supabase = makeSupabaseStub({ activeProcess: null })

    const result = await resolveSessionStep(supabase as never, 'ws-1', 'premier_message', {
      firstName: 'Marie',
      daysSinceLastContact: null,
    })

    expect(result.process_id).toBeNull()
    expect(result.step_id).toBeNull()
    expect(result.label).toBe('Premier message')
    expect(result.text).toContain('Marie')
    expect(result.transitions).toEqual([])
  })

  it('uses the active process message step for a first-contact category, substituting {{prenom}}', async () => {
    const supabase = makeSupabaseStub({
      activeProcess: { id: 'process-1' },
      steps: [
        { id: 'step-1', title: 'Ice breaker', step_type: 'message', content: 'Salut {{prenom}}, ça va ?', delay_days: null, next_step_id: 'step-2' },
        { id: 'step-2', title: 'Relance J+2', step_type: 'relance', content: 'On se recontacte {{prenom}} ?', delay_days: 2, next_step_id: null },
      ],
    })

    const result = await resolveSessionStep(supabase as never, 'ws-1', 'premier_message', {
      firstName: 'Karim',
      daysSinceLastContact: null,
    })

    expect(result.process_id).toBe('process-1')
    expect(result.step_id).toBe('step-1')
    expect(result.label).toBe('Ice breaker')
    expect(result.text).toBe('Salut Karim, ça va ?')
    expect(result.next_step_id).toBe('step-2')
  })

  it('uses the active process relance step for a follow-up category', async () => {
    const supabase = makeSupabaseStub({
      activeProcess: { id: 'process-1' },
      steps: [
        { id: 'step-1', title: 'Ice breaker', step_type: 'message', content: 'Salut {{prenom}}', delay_days: null },
        { id: 'step-2', title: 'Relance J+2', step_type: 'relance', content: 'On se recontacte {{prenom}} ?', delay_days: 2 },
      ],
    })

    const result = await resolveSessionStep(supabase as never, 'ws-1', 'relance_en_retard', {
      firstName: 'Karim',
      daysSinceLastContact: 8,
    })

    expect(result.step_id).toBe('step-2')
    expect(result.label).toBe('Relance J+2')
  })

  it('distinguishes the last relance step (reprise) from the first when the process has two', async () => {
    const supabase = makeSupabaseStub({
      activeProcess: { id: 'process-1' },
      steps: [
        { id: 'step-1', title: 'Ice breaker', step_type: 'message', content: 'Salut {{prenom}}', delay_days: null },
        { id: 'step-2', title: 'Relance J+3', step_type: 'relance', content: 'Relance normale {{prenom}}', delay_days: 3 },
        { id: 'step-3', title: 'Reprise longue absence', step_type: 'relance', content: 'Ça fait longtemps {{prenom}}', delay_days: 30 },
      ],
    })

    const overdue = await resolveSessionStep(supabase as never, 'ws-1', 'relance_en_retard', {
      firstName: 'Karim',
      daysSinceLastContact: 5,
    })
    expect(overdue.step_id).toBe('step-2')
    expect(overdue.label).toBe('Relance J+3')

    const stale = await resolveSessionStep(supabase as never, 'ws-1', 'jamais_recontacte', {
      firstName: 'Karim',
      daysSinceLastContact: 61,
    })
    expect(stale.step_id).toBe('step-3')
    expect(stale.label).toBe('Reprise longue absence')
  })

  it('honors an explicit applies_to_category even when step order would suggest otherwise (survives reordering)', async () => {
    // An admin dragged "Reprise" to be BEFORE "Relance J+3" — the position-based
    // heuristic would now pick the wrong one for each category. The explicit
    // applies_to_category must win regardless of position.
    const supabase = makeSupabaseStub({
      activeProcess: { id: 'process-1' },
      steps: [
        { id: 'step-1', title: 'Ice breaker', step_type: 'message', content: 'Salut {{prenom}}', delay_days: null, applies_to_category: 'premier_contact' },
        { id: 'step-2', title: 'Reprise longue absence', step_type: 'relance', content: 'Ça fait longtemps {{prenom}}', delay_days: 30, applies_to_category: 'jamais_recontacte' },
        { id: 'step-3', title: 'Relance J+3', step_type: 'relance', content: 'Relance normale {{prenom}}', delay_days: 3, applies_to_category: 'relance_en_retard' },
      ],
    })

    const overdue = await resolveSessionStep(supabase as never, 'ws-1', 'relance_en_retard', {
      firstName: 'Karim',
      daysSinceLastContact: 5,
    })
    expect(overdue.step_id).toBe('step-3')

    const stale = await resolveSessionStep(supabase as never, 'ws-1', 'jamais_recontacte', {
      firstName: 'Karim',
      daysSinceLastContact: 61,
    })
    expect(stale.step_id).toBe('step-2')
  })

  it('returns the named transitions available for the resolved step', async () => {
    const supabase = makeSupabaseStub({
      activeProcess: { id: 'process-1' },
      steps: [
        { id: 'step-1', title: 'Ice breaker', step_type: 'message', content: 'Salut {{prenom}}', delay_days: null, next_step_id: 'step-2' },
        { id: 'step-2', title: 'Relance J+2', step_type: 'relance', content: 'Relance {{prenom}}', delay_days: 2 },
        { id: 'step-3', title: 'A répondu', step_type: 'message', content: 'Super {{prenom}} !', delay_days: null },
      ],
      transitions: [
        { step_id: 'step-1', outcome_label: 'repondu', target_step_id: 'step-3' },
      ],
    })

    const result = await resolveSessionStep(supabase as never, 'ws-1', 'premier_message', {
      firstName: 'Karim',
      daysSinceLastContact: null,
    })

    expect(result.step_id).toBe('step-1')
    expect(result.transitions).toEqual([{ outcome_label: 'repondu', target_step_id: 'step-3' }])
  })

  it('exposes a preview of the next step (title + delay) via next_step_id', async () => {
    const supabase = makeSupabaseStub({
      activeProcess: { id: 'process-1' },
      steps: [
        { id: 'step-1', title: 'Ice breaker', step_type: 'message', content: 'Salut {{prenom}}', delay_days: null, next_step_id: 'step-2' },
        { id: 'step-2', title: 'Relance', step_type: 'relance', content: 'On se recontacte {{prenom}} ?', delay_days: 3, next_step_id: 'step-3' },
        { id: 'step-3', title: 'Reprise longue absence', step_type: 'relance', content: 'Ça fait longtemps {{prenom}}', delay_days: 30, next_step_id: null },
      ],
    })

    const first = await resolveSessionStep(supabase as never, 'ws-1', 'premier_message', {
      firstName: 'Karim',
      daysSinceLastContact: null,
    })
    expect(first.next_step).toEqual({ title: 'Relance', delay_days: 3 })

    const last = await resolveSessionStep(supabase as never, 'ws-1', 'jamais_recontacte', {
      firstName: 'Karim',
      daysSinceLastContact: 61,
    })
    expect(last.next_step).toBeNull()
  })

  it('lists every relance step of the process as a manual override option', async () => {
    const supabase = makeSupabaseStub({
      activeProcess: { id: 'process-1' },
      steps: [
        { id: 'step-1', title: 'Ice breaker', step_type: 'message', content: 'Salut {{prenom}}', delay_days: null, next_step_id: 'step-2' },
        { id: 'step-2', title: 'Relance', step_type: 'relance', content: 'On se recontacte {{prenom}} ?', delay_days: 3, next_step_id: 'step-3' },
        { id: 'step-3', title: 'Reprise longue absence', step_type: 'relance', content: 'Ça fait longtemps {{prenom}}', delay_days: 30, next_step_id: null },
      ],
    })

    const result = await resolveSessionStep(supabase as never, 'ws-1', 'premier_message', {
      firstName: 'Karim',
      daysSinceLastContact: null,
    })

    expect(result.relance_step_options).toEqual([
      { step_id: 'step-2', title: 'Relance', delay_days: 3 },
      { step_id: 'step-3', title: 'Reprise longue absence', delay_days: 30 },
    ])
  })
})

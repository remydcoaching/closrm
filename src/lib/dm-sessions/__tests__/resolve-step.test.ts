import { describe, it, expect, vi } from 'vitest'
import { resolveSessionStep } from '../resolve-step'

function makeSupabaseStub(opts: {
  activeProcess?: { id: string } | null
  steps?: { id: string; title: string; step_type: 'message' | 'relance'; content: string; delay_days: number | null }[]
}) {
  return {
    from(table: string) {
      const builder: Record<string, unknown> = {}
      const chain = () => builder
      builder.select = chain
      builder.eq = chain
      builder.order = chain
      builder.limit = chain
      if (table === 'setting_processes') {
        builder.maybeSingle = () => Promise.resolve({ data: opts.activeProcess ?? null, error: null })
      }
      builder.then = (resolve: (v: { data: unknown[]; error: null }) => void) =>
        resolve({ data: table === 'setting_process_steps' ? (opts.steps ?? []) : [], error: null })
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
  })

  it('uses the active process message step for a first-contact category, substituting {{prenom}}', async () => {
    const supabase = makeSupabaseStub({
      activeProcess: { id: 'process-1' },
      steps: [
        { id: 'step-1', title: 'Ice breaker', step_type: 'message', content: 'Salut {{prenom}}, ça va ?', delay_days: null },
        { id: 'step-2', title: 'Relance J+2', step_type: 'relance', content: 'On se recontacte {{prenom}} ?', delay_days: 2 },
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
})

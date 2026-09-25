import { describe, it, expect, vi } from 'vitest'
import { persistDiscoveryInteractions, INTERACTIONS_CHUNK } from '../persist-interactions'
import type { DiscoveredInteraction, DiscoveryResult } from '../discovery'

function interaction(overrides: Partial<DiscoveredInteraction> = {}): DiscoveredInteraction {
  return {
    instagramUserId: 'u1',
    username: 'jean',
    fullName: 'Jean',
    profileUrl: 'https://instagram.com/jean',
    interactionType: 'like',
    sourceContentId: 'c1',
    sourceContentUrl: null,
    observedAt: '2026-09-20T00:00:00Z',
    ...overrides,
  }
}

function result(interactions: DiscoveredInteraction[]): DiscoveryResult {
  return { interactions } as unknown as DiscoveryResult
}

function supabaseMock(error: { message: string } | null = null) {
  const upsert = vi.fn().mockResolvedValue({ error })
  return { supabase: { from: vi.fn(() => ({ upsert })) }, upsert }
}

describe('persistDiscoveryInteractions', () => {
  it('writes one row per (content, profile, type) scoped to the run and workspace', async () => {
    const { supabase, upsert } = supabaseMock()
    const out = await persistDiscoveryInteractions(supabase, 'ws', 'run', result([interaction(), interaction({ interactionType: 'comment' })]))
    expect(out).toEqual({ interactionsPersisted: 2, errors: [] })
    const rows = upsert.mock.calls[0][0]
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ workspace_id: 'ws', discovery_run_id: 'run', content_id: 'c1', instagram_username: 'jean', interaction_type: 'like' })
  })

  it('drops duplicates before sending', async () => {
    const { supabase, upsert } = supabaseMock()
    await persistDiscoveryInteractions(supabase, 'ws', 'run', result([interaction(), interaction()]))
    expect(upsert.mock.calls[0][0]).toHaveLength(1)
  })

  it('sends in chunks', async () => {
    const { supabase, upsert } = supabaseMock()
    const many = Array.from({ length: INTERACTIONS_CHUNK + 1 }, (_, i) => interaction({ username: `u${i}` }))
    const out = await persistDiscoveryInteractions(supabase, 'ws', 'run', result(many))
    expect(upsert).toHaveBeenCalledTimes(2)
    expect(out.interactionsPersisted).toBe(INTERACTIONS_CHUNK + 1)
  })

  it('reports a failing chunk without throwing', async () => {
    const { supabase } = supabaseMock({ message: 'boom' })
    const out = await persistDiscoveryInteractions(supabase, 'ws', 'run', result([interaction()]))
    expect(out.interactionsPersisted).toBe(0)
    expect(out.errors[0]).toContain('boom')
  })
})

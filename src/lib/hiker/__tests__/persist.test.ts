import { describe, it, expect, vi } from 'vitest'
import { persistDiscoveryResult } from '../persist'
import type { DiscoveryResult } from '../discovery'

function makeInteraction(overrides: Partial<DiscoveryResult['interactions'][number]> = {}): DiscoveryResult['interactions'][number] {
  return {
    instagramUserId: 'ig_1',
    username: 'jean_dupont',
    fullName: 'Jean Dupont',
    profileUrl: 'https://www.instagram.com/jean_dupont/',
    interactionType: 'like',
    sourceContentId: 'content_1',
    sourceContentUrl: 'https://www.instagram.com/p/abc/',
    observedAt: '2026-09-18T10:00:00.000Z',
    ...overrides,
  }
}

function makeResult(interactions: DiscoveryResult['interactions']): DiscoveryResult {
  return {
    account: { instagramUserId: 'target_1', username: 'target_account', profile: {} as never },
    contents: [],
    users: [],
    interactions,
    followers: [],
    stories: [],
    stats: {
      mediaFetched: 0,
      clipsFetched: 0,
      uniqueContentsFetched: 0,
      contentsAnalyzedForInteractions: 0,
      uniqueUsers: 0,
      totalInteractions: interactions.length,
      followersFetched: 0,
      httpCalls: 0,
      estimatedBilledRequests: 0,
      startedAt: '2026-09-18T10:00:00.000Z',
      completedAt: '2026-09-18T10:01:00.000Z',
      durationMs: 60000,
    },
    errors: [],
    warnings: [],
    status: 'SUCCESS',
    stoppedReason: 'completed',
  }
}

function makeSupabaseMock({
  existingLeadId,
  existingInteractionId = null,
}: {
  existingLeadId: string | null
  existingInteractionId?: string | null
}) {
  const interactionInsertMock = vi.fn().mockResolvedValue({ error: null })
  const interactionUpdateEqMock = vi.fn().mockResolvedValue({ error: null })
  const interactionUpdateMock = vi.fn().mockReturnValue({ eq: interactionUpdateEqMock })
  const interactionMaybeSingleMock = vi.fn().mockResolvedValue({
    data: existingInteractionId ? { id: existingInteractionId } : null,
    error: null,
  })

  const leadInsertMock = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: { id: 'new-lead-id' }, error: null }),
    }),
  })
  const leadMaybeSingleMock = vi.fn().mockResolvedValue({
    data: existingLeadId ? { id: existingLeadId } : null,
    error: null,
  })

  const supabase = {
    from: vi.fn((table: string) => {
      if (table === 'leads') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({ maybeSingle: leadMaybeSingleMock }),
            }),
          }),
          insert: leadInsertMock,
        }
      }
      if (table === 'instagram_interactions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    or: vi.fn().mockReturnValue({ maybeSingle: interactionMaybeSingleMock }),
                  }),
                }),
              }),
            }),
          }),
          insert: interactionInsertMock,
          update: interactionUpdateMock,
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    }),
  }

  return { supabase, leadInsertMock, interactionInsertMock, interactionUpdateMock, interactionUpdateEqMock }
}

describe('persistDiscoveryResult', () => {
  it('creates a new lead and interaction when nothing matches yet', async () => {
    const { supabase, leadInsertMock, interactionInsertMock } = makeSupabaseMock({ existingLeadId: null })

    const result = await persistDiscoveryResult(supabase, 'workspace-1', makeResult([makeInteraction()]))

    expect(leadInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ workspace_id: 'workspace-1', instagram_user_id: 'ig_1', source: 'instagram_engagement' }),
    )
    expect(interactionInsertMock).toHaveBeenCalledWith(expect.objectContaining({ source_provider: 'hiker' }))
    expect(result).toEqual({ leadsCreated: 1, leadsMatched: 0, interactionsUpserted: 1, errors: [] })
  })

  it('matches an existing lead by instagram_user_id instead of creating a duplicate', async () => {
    const { supabase, leadInsertMock } = makeSupabaseMock({ existingLeadId: 'existing-lead-id' })

    const result = await persistDiscoveryResult(supabase, 'workspace-1', makeResult([makeInteraction()]))

    expect(leadInsertMock).not.toHaveBeenCalled()
    expect(result.leadsMatched).toBe(1)
    expect(result.leadsCreated).toBe(0)
  })

  it('updates last_seen_at instead of inserting a duplicate interaction row', async () => {
    const { supabase, interactionInsertMock, interactionUpdateMock, interactionUpdateEqMock } = makeSupabaseMock({
      existingLeadId: 'existing-lead-id',
      existingInteractionId: 'existing-interaction-id',
    })

    await persistDiscoveryResult(supabase, 'workspace-1', makeResult([makeInteraction()]))

    expect(interactionInsertMock).not.toHaveBeenCalled()
    expect(interactionUpdateMock).toHaveBeenCalledWith(expect.objectContaining({ last_seen_at: '2026-09-18T10:00:00.000Z' }))
    expect(interactionUpdateEqMock).toHaveBeenCalledWith('id', 'existing-interaction-id')
  })

  it('groups multiple interactions from the same person under a single lead lookup/creation', async () => {
    const { supabase, leadInsertMock, interactionInsertMock } = makeSupabaseMock({ existingLeadId: null })

    const result = await persistDiscoveryResult(
      supabase,
      'workspace-1',
      makeResult([makeInteraction({ interactionType: 'like', sourceContentId: 'c1' }), makeInteraction({ interactionType: 'comment', sourceContentId: 'c2' })]),
    )

    expect(leadInsertMock).toHaveBeenCalledTimes(1) // one person, one lead insert
    expect(interactionInsertMock).toHaveBeenCalledTimes(2) // two distinct interactions
    expect(result.interactionsUpserted).toBe(2)
  })

  it('running the same discovery result twice is idempotent: second run only matches, never re-creates', async () => {
    const interaction = makeInteraction()

    const firstRunMock = makeSupabaseMock({ existingLeadId: null })
    const firstResult = await persistDiscoveryResult(firstRunMock.supabase, 'workspace-1', makeResult([interaction]))
    expect(firstResult.leadsCreated).toBe(1)

    // Simulate the lead + interaction now existing for the second run.
    const secondRunMock = makeSupabaseMock({ existingLeadId: 'new-lead-id', existingInteractionId: 'interaction-id-1' })
    const secondResult = await persistDiscoveryResult(secondRunMock.supabase, 'workspace-1', makeResult([interaction]))

    expect(secondResult.leadsCreated).toBe(0)
    expect(secondResult.leadsMatched).toBe(1)
    expect(secondRunMock.interactionInsertMock).not.toHaveBeenCalled()
  })
})

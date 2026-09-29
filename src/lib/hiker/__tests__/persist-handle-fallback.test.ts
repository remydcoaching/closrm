// Regression test for a real production bug found via SQL audit: 17 leads
// with a duplicated instagram_handle in the live database. Root cause:
// persistDiscoveryResult only matched existing leads by instagram_user_id,
// so a lead created before any Hiker/Apify run (instagram_handle set,
// instagram_user_id NULL) was never found — every later discovery run that
// observed the same person created a brand new duplicate lead instead of
// reusing the existing one.
import { describe, it, expect, vi } from 'vitest'
import { persistDiscoveryResult } from '../persist'
import type { DiscoveryResult } from '../discovery'

function makeResult(): DiscoveryResult {
  return {
    account: { instagramUserId: 'target_1', username: 'target_account', profile: {} as never },
    contents: [],
    users: [],
    interactions: [
      {
        instagramUserId: 'ig_42',
        username: 'jean_dupont',
        fullName: 'Jean Dupont',
        profileUrl: 'https://www.instagram.com/jean_dupont/',
        interactionType: 'like',
        sourceContentId: 'content_1',
        sourceContentUrl: 'https://www.instagram.com/p/abc/',
        observedAt: '2026-09-18T10:00:00.000Z',
      },
    ],
    followers: [],
    stories: [],
    stats: {
      mediaFetched: 0,
      clipsFetched: 0,
      uniqueContentsFetched: 0,
      contentsAnalyzedForInteractions: 0,
      uniqueUsers: 1,
      totalInteractions: 1,
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

/**
 * A finer-grained mock than persist.test.ts's — tracks which column each
 * `.eq()` filters on, so the lookup-by-instagram_user_id and
 * lookup-by-instagram_handle branches can return DIFFERENT results, which
 * is exactly the distinction the bug fix depends on.
 */
function makeSupabaseMock({
  leadByUserId,
  leadByHandle,
}: {
  leadByUserId: { id: string } | null
  leadByHandle: { id: string; instagram_user_id: string | null } | null
}) {
  const leadUpdateEqMock = vi.fn().mockResolvedValue({ error: null })
  const leadUpdateMock = vi.fn().mockReturnValue({ eq: leadUpdateEqMock })
  const leadInsertMock = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: { id: 'new-lead-id' }, error: null }),
    }),
  })

  const interactionInsertMock = vi.fn().mockResolvedValue({ error: null })
  const interactionMaybeSingleMock = vi.fn().mockResolvedValue({ data: null, error: null })

  function leadSelectBuilder(columns: string) {
    // Two shapes reach here: .eq('workspace_id', x).eq('instagram_user_id', y).maybeSingle()
    // and .eq('workspace_id', x).eq('instagram_handle', y).maybeSingle() — track
    // the second .eq()'s column name to answer with the right fixture.
    return {
      eq: vi.fn((col1: string) => ({
        eq: vi.fn((col2: string) => ({
          maybeSingle: vi.fn().mockResolvedValue({
            data: col2 === 'instagram_user_id' ? leadByUserId : col2 === 'instagram_handle' ? leadByHandle : null,
            error: null,
          }),
        })),
      })),
    }
  }

  const supabase = {
    from: vi.fn((table: string) => {
      if (table === 'leads') {
        return {
          select: (columns: string) => leadSelectBuilder(columns),
          insert: leadInsertMock,
          update: leadUpdateMock,
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
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    }),
  }

  return { supabase, leadInsertMock, leadUpdateMock, leadUpdateEqMock }
}

describe('persistDiscoveryResult — instagram_handle fallback (regression)', () => {
  it('matches an existing lead by instagram_handle when instagram_user_id is not set yet, instead of creating a duplicate', async () => {
    const { supabase, leadInsertMock } = makeSupabaseMock({
      leadByUserId: null, // no lead has this instagram_user_id yet
      leadByHandle: { id: 'pre-hiker-lead-id', instagram_user_id: null }, // but one exists by handle
    })

    const result = await persistDiscoveryResult(supabase, 'workspace-1', makeResult())

    expect(leadInsertMock).not.toHaveBeenCalled()
    expect(result.leadsMatched).toBe(1)
    expect(result.leadsCreated).toBe(0)
  })

  it('backfills instagram_user_id on the matched lead so future runs match by id directly', async () => {
    const { supabase, leadUpdateMock, leadUpdateEqMock } = makeSupabaseMock({
      leadByUserId: null,
      leadByHandle: { id: 'pre-hiker-lead-id', instagram_user_id: null },
    })

    await persistDiscoveryResult(supabase, 'workspace-1', makeResult())

    expect(leadUpdateMock).toHaveBeenCalledWith({ instagram_user_id: 'ig_42' })
    expect(leadUpdateEqMock).toHaveBeenCalledWith('id', 'pre-hiker-lead-id')
  })

  it('does not backfill or re-lookup when the handle-matched lead already has an instagram_user_id', async () => {
    const { supabase, leadUpdateMock } = makeSupabaseMock({
      leadByUserId: null,
      leadByHandle: { id: 'some-lead-id', instagram_user_id: 'already-set' },
    })

    const result = await persistDiscoveryResult(supabase, 'workspace-1', makeResult())

    expect(leadUpdateMock).not.toHaveBeenCalled()
    expect(result.leadsMatched).toBe(1)
  })

  it('creates a new lead only when neither instagram_user_id nor instagram_handle match anything', async () => {
    const { supabase, leadInsertMock } = makeSupabaseMock({ leadByUserId: null, leadByHandle: null })

    const result = await persistDiscoveryResult(supabase, 'workspace-1', makeResult())

    expect(leadInsertMock).toHaveBeenCalledTimes(1)
    expect(result.leadsCreated).toBe(1)
  })
})

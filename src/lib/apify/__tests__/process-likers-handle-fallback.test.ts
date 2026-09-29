// Regression test — same root cause and fix as
// src/lib/hiker/__tests__/persist-handle-fallback.test.ts: processLikersDataset
// only matched existing leads by instagram_user_id, so a lead created before
// any Hiker/Apify run (instagram_handle set, instagram_user_id NULL) was
// never found, creating a duplicate lead on every later run that observed
// the same person (found via SQL audit: 17 duplicated handles in production).
import { describe, it, expect, vi } from 'vitest'
import { processLikersDataset } from '../process-likers'
import type { ApifyLikerItem } from '../client'

function makeItem(overrides: Partial<ApifyLikerItem> = {}): ApifyLikerItem {
  return {
    position: 1,
    userId: 'ig_user_42',
    username: 'jean_dupont',
    fullName: 'Jean Dupont',
    profilePicUrl: 'https://example.com/pic.jpg',
    isVerified: false,
    sourcePost: 'https://www.instagram.com/reel/abc/',
    scrapedAt: '2026-08-21T10:00:00.000Z',
    ...overrides,
  }
}

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

  function leadSelectBuilder() {
    return {
      eq: vi.fn(() => ({
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
          select: () => leadSelectBuilder(),
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

describe('processLikersDataset — instagram_handle fallback (regression)', () => {
  it('matches an existing lead by instagram_handle when instagram_user_id is not set yet, instead of creating a duplicate', async () => {
    const { supabase, leadInsertMock } = makeSupabaseMock({
      leadByUserId: null,
      leadByHandle: { id: 'pre-apify-lead-id', instagram_user_id: null },
    })

    const result = await processLikersDataset(supabase, 'workspace-1', 'watched-post-1', 'https://www.instagram.com/reel/abc/', [makeItem()])

    expect(leadInsertMock).not.toHaveBeenCalled()
    expect(result.leadsMatched).toBe(1)
    expect(result.leadsCreated).toBe(0)
  })

  it('backfills instagram_user_id on the matched lead', async () => {
    const { supabase, leadUpdateMock, leadUpdateEqMock } = makeSupabaseMock({
      leadByUserId: null,
      leadByHandle: { id: 'pre-apify-lead-id', instagram_user_id: null },
    })

    await processLikersDataset(supabase, 'workspace-1', 'watched-post-1', 'https://www.instagram.com/reel/abc/', [makeItem()])

    expect(leadUpdateMock).toHaveBeenCalledWith({ instagram_user_id: 'ig_user_42' })
    expect(leadUpdateEqMock).toHaveBeenCalledWith('id', 'pre-apify-lead-id')
  })

  it('creates a new lead only when neither instagram_user_id nor instagram_handle match anything', async () => {
    const { supabase, leadInsertMock } = makeSupabaseMock({ leadByUserId: null, leadByHandle: null })

    const result = await processLikersDataset(supabase, 'workspace-1', 'watched-post-1', 'https://www.instagram.com/reel/abc/', [makeItem()])

    expect(leadInsertMock).toHaveBeenCalledTimes(1)
    expect(result.leadsCreated).toBe(1)
  })
})

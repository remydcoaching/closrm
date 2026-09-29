import { describe, it, expect, vi } from 'vitest'
import { processLikersDataset } from '../process-likers'
import type { ApifyLikerItem } from '../client'

function makeItem(overrides: Partial<ApifyLikerItem> = {}): ApifyLikerItem {
  return {
    position: 1,
    userId: 'ig_user_1',
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

  return {
    supabase,
    leadInsertMock,
    interactionInsertMock,
    interactionUpdateMock,
    interactionUpdateEqMock,
  }
}

describe('processLikersDataset', () => {
  it('creates a new lead when no existing lead matches instagram_user_id', async () => {
    const { supabase, leadInsertMock, interactionInsertMock } = makeSupabaseMock({ existingLeadId: null })

    const result = await processLikersDataset(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase as any,
      'workspace-1',
      'watched-post-1',
      'https://www.instagram.com/reel/abc/',
      [makeItem()],
    )

    expect(leadInsertMock).toHaveBeenCalled()
    expect(interactionInsertMock).toHaveBeenCalled()
    expect(result).toEqual({ leadsCreated: 1, leadsMatched: 0, interactionsUpserted: 1 })
  })

  it('reuses an existing lead when instagram_user_id already matches', async () => {
    const { supabase, leadInsertMock, interactionInsertMock } = makeSupabaseMock({
      existingLeadId: 'existing-lead-id',
    })

    const result = await processLikersDataset(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase as any,
      'workspace-1',
      'watched-post-1',
      'https://www.instagram.com/reel/abc/',
      [makeItem()],
    )

    expect(leadInsertMock).not.toHaveBeenCalled()
    expect(interactionInsertMock).toHaveBeenCalled()
    expect(result).toEqual({ leadsCreated: 0, leadsMatched: 1, interactionsUpserted: 1 })
  })

  it('updates last_seen_at instead of inserting a duplicate when the interaction already exists', async () => {
    const { supabase, interactionInsertMock, interactionUpdateMock, interactionUpdateEqMock } = makeSupabaseMock({
      existingLeadId: 'existing-lead-id',
      existingInteractionId: 'existing-interaction-id',
    })

    const result = await processLikersDataset(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase as any,
      'workspace-1',
      'watched-post-1',
      'https://www.instagram.com/reel/abc/',
      [makeItem()],
    )

    expect(interactionInsertMock).not.toHaveBeenCalled()
    expect(interactionUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ last_seen_at: '2026-08-21T10:00:00.000Z' }),
    )
    expect(interactionUpdateEqMock).toHaveBeenCalledWith('id', 'existing-interaction-id')
    expect(result).toEqual({ leadsCreated: 0, leadsMatched: 1, interactionsUpserted: 1 })
  })

  it('processes multiple items independently, summing counts', async () => {
    const { supabase } = makeSupabaseMock({ existingLeadId: null })

    const result = await processLikersDataset(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase as any,
      'workspace-1',
      'watched-post-1',
      'https://www.instagram.com/reel/abc/',
      [makeItem({ userId: 'ig_user_1' }), makeItem({ userId: 'ig_user_2', username: 'marie_martin' })],
    )

    expect(result).toEqual({ leadsCreated: 2, leadsMatched: 0, interactionsUpserted: 2 })
  })
})

// Tests for the new "Ciblage" persistence — a scan must OBSERVE profiles
// without creating any lead automatically. See persist-profiles.ts header.
import { describe, it, expect, vi } from 'vitest'
import { persistDiscoveryProfiles } from '../persist-profiles'
import type { DiscoveryResult } from '../discovery'
import type { NormalizedProfile } from '../discovery'

function makeProfile(overrides: Partial<NormalizedProfile> = {}): NormalizedProfile {
  return {
    instagramUserId: 'ig_1',
    username: 'jean_dupont',
    fullName: 'Jean Dupont',
    profilePicUrl: null,
    isVerified: false,
    likeCount: 3,
    commentCount: 1,
    likedContentIds: new Set(['c1']),
    commentedContentIds: new Set(['c1']),
    followsTarget: true,
    firstSeenAt: '2026-09-01T00:00:00Z',
    lastSeenAt: '2026-09-02T00:00:00Z',
    sources: ['liker', 'commenter'],
    ...overrides,
  }
}

function makeResult(users: NormalizedProfile[]): DiscoveryResult {
  return {
    account: { instagramUserId: 'target_1', username: 'target_account', profile: {} as never },
    contents: [],
    users,
    interactions: [],
    followers: [],
    stories: [],
    stats: {
      mediaFetched: 0,
      clipsFetched: 0,
      uniqueContentsFetched: 0,
      contentsAnalyzedForInteractions: 0,
      uniqueUsers: users.length,
      totalInteractions: 0,
      followersFetched: 0,
      httpCalls: 0,
      estimatedBilledRequests: 0,
      startedAt: '2026-09-01T00:00:00Z',
      completedAt: '2026-09-01T00:01:00Z',
      durationMs: 60000,
    },
    errors: [],
    warnings: [],
    status: 'SUCCESS',
    stoppedReason: 'completed',
  }
}

function makeSupabaseMock({ leadByUserId, leadByHandle }: { leadByUserId: { id: string } | null; leadByHandle: { id: string } | null }) {
  const insertMock = vi.fn().mockResolvedValue({ error: null })

  const supabase = {
    from: vi.fn((table: string) => {
      if (table === 'leads') {
        return {
          select: () => ({
            eq: () => ({
              eq: (col: string) => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: col === 'instagram_user_id' ? leadByUserId : col === 'instagram_handle' ? leadByHandle : null,
                  error: null,
                }),
              }),
            }),
          }),
        }
      }
      if (table === 'discovery_profiles') {
        return { insert: insertMock }
      }
      throw new Error(`Unexpected table: ${table}`)
    }),
  }

  return { supabase, insertMock }
}

describe('persistDiscoveryProfiles', () => {
  it('never creates a lead — only inserts an observation row', async () => {
    const { supabase, insertMock } = makeSupabaseMock({ leadByUserId: null, leadByHandle: null })

    const result = await persistDiscoveryProfiles(supabase, 'workspace-1', 'run-1', makeResult([makeProfile()]))

    expect(insertMock).toHaveBeenCalledTimes(1)
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        workspace_id: 'workspace-1',
        discovery_run_id: 'run-1',
        instagram_username: 'jean_dupont',
        likes_count: 3,
        comments_count: 1,
        follows_target: true,
        matched_lead_id: null,
      }),
    )
    expect(result.profilesObserved).toBe(1)
    expect(result.alreadyLeadsCount).toBe(0)
  })

  it('flags a profile as already a lead when matched by instagram_user_id, without creating a new one', async () => {
    const { supabase, insertMock } = makeSupabaseMock({ leadByUserId: { id: 'existing-lead-id' }, leadByHandle: null })

    const result = await persistDiscoveryProfiles(supabase, 'workspace-1', 'run-1', makeResult([makeProfile()]))

    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ matched_lead_id: 'existing-lead-id' }))
    expect(result.alreadyLeadsCount).toBe(1)
  })

  it('falls back to matching by instagram_handle when no id-based match exists', async () => {
    const { supabase, insertMock } = makeSupabaseMock({ leadByUserId: null, leadByHandle: { id: 'lead-by-handle' } })

    await persistDiscoveryProfiles(supabase, 'workspace-1', 'run-1', makeResult([makeProfile()]))

    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ matched_lead_id: 'lead-by-handle' }))
  })

  it('inserts one row per observed profile in the run', async () => {
    const { supabase, insertMock } = makeSupabaseMock({ leadByUserId: null, leadByHandle: null })

    const result = await persistDiscoveryProfiles(
      supabase,
      'workspace-1',
      'run-1',
      makeResult([makeProfile({ username: 'a', instagramUserId: 'ig_a' }), makeProfile({ username: 'b', instagramUserId: 'ig_b' })]),
    )

    expect(insertMock).toHaveBeenCalledTimes(2)
    expect(result.profilesObserved).toBe(2)
  })

  it('returns an empty result without error when no profiles were observed', async () => {
    const { supabase, insertMock } = makeSupabaseMock({ leadByUserId: null, leadByHandle: null })

    const result = await persistDiscoveryProfiles(supabase, 'workspace-1', 'run-1', makeResult([]))

    expect(insertMock).not.toHaveBeenCalled()
    expect(result).toEqual({ profilesObserved: 0, alreadyLeadsCount: 0, errors: [] })
  })
})

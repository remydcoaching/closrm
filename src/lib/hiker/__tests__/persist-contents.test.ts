// Tests for content metadata persistence — powers the Content page's
// engagement-vs-views chart, previously discarded data (see
// persist-contents.ts header).
import { describe, it, expect, vi } from 'vitest'
import { persistDiscoveryContents } from '../persist-contents'
import type { DiscoveryResult } from '../discovery'
import type { NormalizedContent } from '../normalizer'

function makeContent(overrides: Partial<NormalizedContent> = {}): NormalizedContent {
  return {
    id: 'content_1',
    shortcode: 'AbCdEf',
    type: 'media',
    ownerUserId: 'target_1',
    ownerUsername: 'target_account',
    url: 'https://www.instagram.com/p/AbCdEf/',
    timestamp: '2026-09-01T00:00:00.000Z',
    likeCount: 42,
    likeCountReliable: false,
    commentCount: 5,
    viewCount: 12345,
    rawMetadata: { thumbnail_url: 'https://cdn.example.com/thumb.jpg' } as never,
    ...overrides,
  }
}

function makeResult(contents: NormalizedContent[]): DiscoveryResult {
  return {
    account: { instagramUserId: 'target_1', username: 'target_account', profile: {} as never },
    contents,
    users: [],
    interactions: [],
    followers: [],
    stories: [],
    stats: {
      mediaFetched: contents.length,
      clipsFetched: 0,
      uniqueContentsFetched: contents.length,
      contentsAnalyzedForInteractions: 0,
      uniqueUsers: 0,
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

function makeSupabaseMock() {
  const insertMock = vi.fn().mockResolvedValue({ error: null })
  const supabase = { from: vi.fn(() => ({ insert: insertMock })) }
  return { supabase, insertMock }
}

describe('persistDiscoveryContents', () => {
  it('persists view count, thumbnail, and type for each observed content', async () => {
    const { supabase, insertMock } = makeSupabaseMock()

    const result = await persistDiscoveryContents(supabase, 'workspace-1', 'run-1', makeResult([makeContent()]))

    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        workspace_id: 'workspace-1',
        discovery_run_id: 'run-1',
        content_id: 'content_1',
        content_type: 'media',
        view_count: 12345,
        thumbnail_url: 'https://cdn.example.com/thumb.jpg',
      }),
    )
    expect(result.contentsPersisted).toBe(1)
  })

  it('persists reported like/comment counts as-is, without validating reliability (caller must qualify them in the UI)', async () => {
    const { supabase, insertMock } = makeSupabaseMock()

    await persistDiscoveryContents(supabase, 'workspace-1', 'run-1', makeResult([makeContent({ likeCount: 3, commentCount: 0 })]))

    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ reported_like_count: 3, reported_comment_count: 0 }))
  })

  it('treats a duplicate (discovery_run_id, content_id) insert as already-persisted, not an error', async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: { message: 'duplicate key value violates unique constraint' } })
    const supabase = { from: vi.fn(() => ({ insert: insertMock })) }

    const result = await persistDiscoveryContents(supabase, 'workspace-1', 'run-1', makeResult([makeContent()]))

    expect(result.errors).toEqual([])
    expect(result.contentsPersisted).toBe(1)
  })

  it('records a real insert failure as an error and does not count it as persisted', async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: { message: 'connection reset' } })
    const supabase = { from: vi.fn(() => ({ insert: insertMock })) }

    const result = await persistDiscoveryContents(supabase, 'workspace-1', 'run-1', makeResult([makeContent()]))

    expect(result.errors).toHaveLength(1)
    expect(result.contentsPersisted).toBe(0)
  })

  it('returns an empty result when there is no content to persist', async () => {
    const { supabase, insertMock } = makeSupabaseMock()

    const result = await persistDiscoveryContents(supabase, 'workspace-1', 'run-1', makeResult([]))

    expect(insertMock).not.toHaveBeenCalled()
    expect(result).toEqual({ contentsPersisted: 0, errors: [] })
  })
})

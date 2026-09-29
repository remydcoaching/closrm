import { describe, it, expect, vi, afterEach } from 'vitest'
import { discoverInstagramAccount } from '../discovery'
import { HikerClient, type HikerCallLogEntry } from '../client'
import {
  fixtureProfile,
  fixtureMediaChunkPage,
  makeMediaItem,
  fixtureLikersResponse,
  fixtureLiker,
  fixtureCommentsResponse,
  fixtureFollowersResponse,
  fixtureStoriesNoneActive,
  fixtureInsufficientFundsBody,
  fixtureNotFoundBody,
} from './fixtures/responses'

const originalFetch = global.fetch

function jsonResponse(status: number, body: unknown) {
  return { status, text: () => Promise.resolve(JSON.stringify(body)) } as Response
}

function buildClientFactory(responses: Array<{ status: number; body: unknown }>) {
  const mockFetch = vi.fn()
  for (const r of responses) mockFetch.mockResolvedValueOnce(jsonResponse(r.status, r.body))
  global.fetch = mockFetch as unknown as typeof fetch
  return (onCall: (entry: HikerCallLogEntry) => void) => new HikerClient({ apiKey: 'test-key', onCall })
}

describe('discoverInstagramAccount', () => {
  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('runs a full discovery with one media, one liker, one comment, one follower, no stories', async () => {
    const buildClient = buildClientFactory([
      { status: 200, body: fixtureProfile }, // resolve username
      { status: 200, body: fixtureMediaChunkPage([makeMediaItem({ pk: 1, code: 'A' })], null) }, // media page 1
      { status: 200, body: fixtureMediaChunkPage([], null) }, // clips page 1 (empty)
      { status: 200, body: fixtureFollowersResponse([fixtureLiker], null) }, // followers page 1
      { status: 200, body: fixtureStoriesNoneActive }, // stories
      { status: 200, body: fixtureLikersResponse([fixtureLiker]) }, // likers for content 1
      { status: 200, body: fixtureCommentsResponse([{ pk: 'c1', user: fixtureLiker, text: 'nice' }], null) }, // comments for content 1
    ])

    const result = await discoverInstagramAccount(buildClient, 'test_account')

    expect(result.status).toBe('SUCCESS')
    expect(result.account.instagramUserId).toBe('1000000001')
    expect(result.contents).toHaveLength(1)
    expect(result.interactions).toHaveLength(2) // 1 like + 1 comment, same person
    expect(result.users).toHaveLength(1)
    expect(result.users[0].sources).toEqual(expect.arrayContaining(['liker', 'commenter', 'follower']))
  })

  it('stops cleanly on INSUFFICIENT_FUNDS mid-run and reports PARTIAL, preserving already-collected data', async () => {
    const buildClient = buildClientFactory([
      { status: 200, body: fixtureProfile },
      { status: 200, body: fixtureMediaChunkPage([makeMediaItem({ pk: 1, code: 'A' }), makeMediaItem({ pk: 2, code: 'B' })], null) },
      { status: 200, body: fixtureMediaChunkPage([], null) }, // clips
      { status: 200, body: fixtureFollowersResponse([], null) }, // followers
      { status: 200, body: fixtureStoriesNoneActive },
      { status: 200, body: fixtureLikersResponse([fixtureLiker]) }, // likers for content 1 succeed
      { status: 200, body: fixtureCommentsResponse([], null) }, // comments for content 1 succeed
      { status: 402, body: fixtureInsufficientFundsBody }, // likers for content 2 fail
    ])

    const result = await discoverInstagramAccount(buildClient, 'test_account')

    expect(result.status).toBe('PARTIAL')
    expect(result.stoppedReason).toBe('insufficient_funds')
    expect(result.interactions).toHaveLength(1) // content 1's liker was preserved
    expect(result.warnings.some((w) => w.includes('insufficient funds'))).toBe(true)
  })

  it('does not treat a 404 on comments as zero comments — records it as a content error', async () => {
    const buildClient = buildClientFactory([
      { status: 200, body: fixtureProfile },
      { status: 200, body: fixtureMediaChunkPage([makeMediaItem({ pk: 1, code: 'A' })], null) },
      { status: 200, body: fixtureMediaChunkPage([], null) },
      { status: 200, body: fixtureFollowersResponse([], null) },
      { status: 200, body: fixtureStoriesNoneActive },
      { status: 200, body: fixtureLikersResponse([]) },
      { status: 404, body: fixtureNotFoundBody },
    ])

    const result = await discoverInstagramAccount(buildClient, 'test_account')

    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toMatchObject({ stage: 'comments', status: 'not_found' })
    // A single content error must not fail the whole discovery.
    expect(result.status).not.toBe('FAILED')
  })

  it('regression: a comment with an unparseable created_at does not crash the run (was RangeError: Invalid time value in production)', async () => {
    // Reproduces the real production incident: POST /api/instagram/discovery
    // returned 500 "Invalid time value" after ~41s of real, billed Hiker
    // requests, because a comment's created_at reached new Date(...).toISOString()
    // unvalidated. discoverInstagramAccount must complete and simply fall
    // back to "now" for that one comment's observedAt.
    const buildClient = buildClientFactory([
      { status: 200, body: fixtureProfile },
      { status: 200, body: fixtureMediaChunkPage([makeMediaItem({ pk: 1, code: 'A' })], null) },
      { status: 200, body: fixtureMediaChunkPage([], null) },
      { status: 200, body: fixtureFollowersResponse([], null) },
      { status: 200, body: fixtureStoriesNoneActive },
      { status: 200, body: fixtureLikersResponse([]) },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { status: 200, body: fixtureCommentsResponse([{ pk: 'c1', user: fixtureLiker, text: 'nice', created_at: NaN as any }], null) },
    ])

    const result = await discoverInstagramAccount(buildClient, 'test_account')

    expect(result.status).not.toBe('FAILED')
    expect(result.interactions).toHaveLength(1)
    expect(result.interactions[0].observedAt).toBeTruthy()
    expect(Number.isNaN(new Date(result.interactions[0].observedAt).getTime())).toBe(false)
  })

  it('deduplicates media and clips that reference the same content id', async () => {
    const sharedItem = makeMediaItem({ pk: 42, code: 'SHARED' })
    const buildClient = buildClientFactory([
      { status: 200, body: fixtureProfile },
      { status: 200, body: fixtureMediaChunkPage([sharedItem], null) },
      { status: 200, body: fixtureMediaChunkPage([sharedItem], null) }, // clips returns the SAME item
      { status: 200, body: fixtureFollowersResponse([], null) },
      { status: 200, body: fixtureStoriesNoneActive },
      { status: 200, body: fixtureLikersResponse([]) },
      { status: 200, body: fixtureCommentsResponse([], null) },
    ])

    const result = await discoverInstagramAccount(buildClient, 'test_account')
    expect(result.stats.mediaFetched).toBe(1)
    expect(result.stats.clipsFetched).toBe(1)
    expect(result.stats.uniqueContentsFetched).toBe(1) // deduplicated
  })

  it('marks followers on discovered profiles without creating like/comment interactions for them', async () => {
    const followerOnly = { pk: 999, username: 'follower_only_user' }
    const buildClient = buildClientFactory([
      { status: 200, body: fixtureProfile },
      { status: 200, body: fixtureMediaChunkPage([], null) },
      { status: 200, body: fixtureMediaChunkPage([], null) },
      { status: 200, body: fixtureFollowersResponse([followerOnly], null) },
      { status: 200, body: fixtureStoriesNoneActive },
    ])

    const result = await discoverInstagramAccount(buildClient, 'test_account')
    expect(result.users).toHaveLength(1)
    expect(result.users[0].sources).toEqual(['follower'])
    expect(result.interactions).toHaveLength(0)
  })

  it('is idempotent to run twice: the second run produces the same logical interaction set', async () => {
    const item = makeMediaItem({ pk: 1, code: 'A' })
    const responses = [
      { status: 200, body: fixtureProfile },
      { status: 200, body: fixtureMediaChunkPage([item], null) },
      { status: 200, body: fixtureMediaChunkPage([], null) },
      { status: 200, body: fixtureFollowersResponse([], null) },
      { status: 200, body: fixtureStoriesNoneActive },
      { status: 200, body: fixtureLikersResponse([fixtureLiker]) },
      { status: 200, body: fixtureCommentsResponse([], null) },
    ]

    const buildClient1 = buildClientFactory(responses)
    const run1 = await discoverInstagramAccount(buildClient1, 'test_account')

    const buildClient2 = buildClientFactory(responses)
    const run2 = await discoverInstagramAccount(buildClient2, 'test_account')

    // Same shape of result across two independent runs against identical
    // upstream data — the persistence layer (persist.ts) is what makes this
    // idempotent in the database (upsert-by-identity), this asserts the
    // discovery engine itself is deterministic given the same inputs.
    expect(run1.interactions.length).toBe(run2.interactions.length)
    expect(run1.users.length).toBe(run2.users.length)
  })
})

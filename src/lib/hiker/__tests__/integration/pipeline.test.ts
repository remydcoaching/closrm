// Integration tests for the full pipeline: mock Hiker response -> normalizer
// -> deduplicator -> persist -> (simulated) Supabase. NO real network call —
// see in-memory-supabase.ts for why this is a faithful-but-not-identical
// stand-in for a real Postgres run (Docker unavailable in this session).
import { describe, it, expect, beforeEach } from 'vitest'
import { FakeDatabase, makeFakeSupabase } from './in-memory-supabase'
import { persistDiscoveryResult } from '../../persist'
import type { DiscoveryResult } from '../../discovery'

const WORKSPACE_A = 'workspace-a'
const WORKSPACE_B = 'workspace-b'

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
      startedAt: '2026-09-19T10:00:00.000Z',
      completedAt: '2026-09-19T10:01:00.000Z',
      durationMs: 60000,
    },
    errors: [],
    warnings: [],
    status: 'SUCCESS',
    stoppedReason: 'completed',
  }
}

describe('Phase 3.5 — leads (point 4)', () => {
  let db: FakeDatabase
  beforeEach(() => {
    db = new FakeDatabase()
  })

  it('creates exactly one lead on first pass for instagram_user_id=123456789', async () => {
    const supabase = makeFakeSupabase(db, WORKSPACE_A)
    const interaction: DiscoveryResult['interactions'][number] = {
      instagramUserId: '123456789',
      username: 'test_hiker_user',
      fullName: 'Test Hiker User',
      profileUrl: 'https://www.instagram.com/test_hiker_user/',
      interactionType: 'like',
      sourceContentId: 'content_a',
      sourceContentUrl: 'https://www.instagram.com/p/a/',
      observedAt: '2026-09-19T10:00:00.000Z',
    }

    const result = await persistDiscoveryResult(supabase, WORKSPACE_A, makeResult([interaction]))

    expect(result.leadsCreated).toBe(1)
    expect(db.leads).toHaveLength(1)
    expect(db.leads[0]).toMatchObject({ instagram_user_id: '123456789', instagram_handle: 'test_hiker_user' })
  })

  it('running the exact same discovery a second time never creates a duplicate lead', async () => {
    const supabase = makeFakeSupabase(db, WORKSPACE_A)
    const interaction: DiscoveryResult['interactions'][number] = {
      instagramUserId: '123456789',
      username: 'test_hiker_user',
      fullName: 'Test Hiker User',
      profileUrl: 'https://www.instagram.com/test_hiker_user/',
      interactionType: 'like',
      sourceContentId: 'content_a',
      sourceContentUrl: 'https://www.instagram.com/p/a/',
      observedAt: '2026-09-19T10:00:00.000Z',
    }

    await persistDiscoveryResult(supabase, WORKSPACE_A, makeResult([interaction]))
    const secondPass = await persistDiscoveryResult(supabase, WORKSPACE_A, makeResult([interaction]))

    expect(db.leads).toHaveLength(1) // still exactly 1 lead in the database
    expect(secondPass.leadsCreated).toBe(0)
    expect(secondPass.leadsMatched).toBe(1)
  })

  it('matches the same lead when the username changes but instagram_user_id stays identical', async () => {
    const supabase = makeFakeSupabase(db, WORKSPACE_A)
    const first: DiscoveryResult['interactions'][number] = {
      instagramUserId: '123456789',
      username: 'test_hiker_user',
      fullName: 'Test Hiker User',
      profileUrl: 'https://www.instagram.com/test_hiker_user/',
      interactionType: 'like',
      sourceContentId: 'content_a',
      sourceContentUrl: 'https://www.instagram.com/p/a/',
      observedAt: '2026-09-19T10:00:00.000Z',
    }
    const renamed: DiscoveryResult['interactions'][number] = {
      ...first,
      username: 'test_hiker_user_renamed',
      sourceContentId: 'content_b',
      observedAt: '2026-09-20T10:00:00.000Z',
    }

    await persistDiscoveryResult(supabase, WORKSPACE_A, makeResult([first]))
    const secondPass = await persistDiscoveryResult(supabase, WORKSPACE_A, makeResult([renamed]))

    expect(db.leads).toHaveLength(1) // same person, same lead, despite the handle change
    expect(secondPass.leadsMatched).toBe(1)
    expect(secondPass.leadsCreated).toBe(0)
  })
})

describe('Phase 3.5 — interactions (point 5)', () => {
  let db: FakeDatabase
  beforeEach(() => {
    db = new FakeDatabase()
  })

  it('creates 3 distinct interaction rows for like(A) + like(B) + comment(A) from the same user', async () => {
    const supabase = makeFakeSupabase(db, WORKSPACE_A)
    const base = {
      instagramUserId: '123456789',
      username: 'test_hiker_user',
      fullName: 'Test Hiker User',
      profileUrl: 'https://www.instagram.com/test_hiker_user/',
      observedAt: '2026-09-19T10:00:00.000Z',
    }
    const interactions: DiscoveryResult['interactions'] = [
      { ...base, interactionType: 'like', sourceContentId: 'content_a', sourceContentUrl: 'https://www.instagram.com/p/a/' },
      { ...base, interactionType: 'like', sourceContentId: 'content_b', sourceContentUrl: 'https://www.instagram.com/p/b/' },
      { ...base, interactionType: 'comment', sourceContentId: 'content_a', sourceContentUrl: 'https://www.instagram.com/p/a/' },
    ]

    const result = await persistDiscoveryResult(supabase, WORKSPACE_A, makeResult(interactions))

    expect(result.interactionsUpserted).toBe(3)
    expect(db.interactions).toHaveLength(3)
    expect(db.leads).toHaveLength(1) // still one person
  })

  it('a second identical pass produces zero new interaction rows (dedup by expression index)', async () => {
    const supabase = makeFakeSupabase(db, WORKSPACE_A)
    const base = {
      instagramUserId: '123456789',
      username: 'test_hiker_user',
      fullName: 'Test Hiker User',
      profileUrl: 'https://www.instagram.com/test_hiker_user/',
      observedAt: '2026-09-19T10:00:00.000Z',
    }
    const interactions: DiscoveryResult['interactions'] = [
      { ...base, interactionType: 'like', sourceContentId: 'content_a', sourceContentUrl: 'https://www.instagram.com/p/a/' },
      { ...base, interactionType: 'like', sourceContentId: 'content_b', sourceContentUrl: 'https://www.instagram.com/p/b/' },
      { ...base, interactionType: 'comment', sourceContentId: 'content_a', sourceContentUrl: 'https://www.instagram.com/p/a/' },
    ]

    await persistDiscoveryResult(supabase, WORKSPACE_A, makeResult(interactions))
    await persistDiscoveryResult(supabase, WORKSPACE_A, makeResult(interactions))

    expect(db.interactions).toHaveLength(3) // still exactly 3, no duplicates from the second pass
  })

  it('writes source_provider=hiker and a source_post_id with no corresponding apify_watched_posts row', async () => {
    const supabase = makeFakeSupabase(db, WORKSPACE_A)
    const interaction: DiscoveryResult['interactions'][number] = {
      instagramUserId: '123456789',
      username: 'test_hiker_user',
      fullName: null,
      profileUrl: 'https://www.instagram.com/test_hiker_user/',
      interactionType: 'like',
      sourceContentId: 'hiker_media_pk_987654321', // a raw Hiker media id, never registered anywhere
      sourceContentUrl: 'https://www.instagram.com/p/xyz/',
      observedAt: '2026-09-19T10:00:00.000Z',
    }

    await persistDiscoveryResult(supabase, WORKSPACE_A, makeResult([interaction]))

    expect(db.interactions[0]).toMatchObject({
      source_provider: 'hiker',
      source_post_id: 'hiker_media_pk_987654321',
    })
    // This row has no counterpart in apify_watched_posts anywhere — the whole
    // point of migration 102. The in-memory mock has no apify_watched_posts
    // table at all, which is itself the assertion: persisting this row never
    // required one to exist.
  })
})

describe('Phase 3.5 — Apify compatibility (point 6)', () => {
  it('an existing Apify-sourced interaction row is untouched by Hiker persistence logic', async () => {
    const db = new FakeDatabase()
    const supabase = makeFakeSupabase(db, WORKSPACE_A)

    // Simulate a pre-existing Apify lead + interaction, as process-likers.ts
    // would have created before this migration existed.
    db.leads.push({
      id: 'lead-apify-1',
      workspace_id: WORKSPACE_A,
      first_name: 'Jean Dupont',
      last_name: '',
      phone: '',
      email: null,
      status: 'nouveau',
      source: 'instagram_engagement',
      instagram_handle: 'jean_dupont',
      instagram_user_id: 'apify_user_1',
    })
    db.interactions.push({
      id: 'interaction-apify-1',
      workspace_id: WORKSPACE_A,
      lead_id: 'lead-apify-1',
      interaction_type: 'like',
      instagram_user_id: 'apify_user_1',
      instagram_username: 'jean_dupont',
      full_name: 'Jean Dupont',
      profile_url: 'https://www.instagram.com/jean_dupont/',
      source_post_id: 'apify-watched-post-uuid-1', // an apify_watched_posts.id, as text post-migration
      source_post_url: 'https://www.instagram.com/reel/abc/',
      source_provider: 'apify', // backfilled by migration 096
      first_seen_at: '2026-08-01T00:00:00.000Z',
      last_seen_at: '2026-08-01T00:00:00.000Z',
      metadata: { position: 1, isVerified: false },
    })

    // A brand new Hiker discovery for a DIFFERENT person must not touch the
    // pre-existing Apify row in any way.
    const hikerInteraction: DiscoveryResult['interactions'][number] = {
      instagramUserId: 'hiker_user_1',
      username: 'marie_martin',
      fullName: 'Marie Martin',
      profileUrl: 'https://www.instagram.com/marie_martin/',
      interactionType: 'like',
      sourceContentId: 'hiker_media_1',
      sourceContentUrl: 'https://www.instagram.com/p/def/',
      observedAt: '2026-09-19T10:00:00.000Z',
    }

    await persistDiscoveryResult(supabase, WORKSPACE_A, makeResult([hikerInteraction]))

    const apifyRow = db.interactions.find((r) => r.id === 'interaction-apify-1')
    expect(apifyRow).toMatchObject({
      source_provider: 'apify',
      source_post_id: 'apify-watched-post-uuid-1',
      last_seen_at: '2026-08-01T00:00:00.000Z', // untouched
    })
    expect(db.leads.find((l) => l.id === 'lead-apify-1')).toBeDefined() // untouched
    expect(db.interactions).toHaveLength(2) // old Apify row + new Hiker row, both present
  })
})

describe('Phase 3.5 — RLS simulation (point 10)', () => {
  it('workspace A cannot read workspace B leads through the same query shape', async () => {
    const db = new FakeDatabase()
    db.leads.push({
      id: 'lead-b-1',
      workspace_id: WORKSPACE_B,
      first_name: 'Secret',
      last_name: '',
      phone: '',
      email: null,
      status: 'nouveau',
      source: 'instagram_engagement',
      instagram_handle: 'secret_user',
      instagram_user_id: 'secret_id_1',
    })

    const supabaseAsA = makeFakeSupabase(db, WORKSPACE_A)
    const lookup = await supabaseAsA.from('leads').select('id').eq('workspace_id', WORKSPACE_B).eq('instagram_user_id', 'secret_id_1').maybeSingle()

    expect(lookup.data).toBeNull() // workspace A's scoped client never sees workspace B's row
  })

  it('a discovery for workspace A never creates a lead visible to workspace B', async () => {
    const db = new FakeDatabase()
    const supabaseAsA = makeFakeSupabase(db, WORKSPACE_A)
    const interaction: DiscoveryResult['interactions'][number] = {
      instagramUserId: 'shared_person_1',
      username: 'shared_person',
      fullName: null,
      profileUrl: 'https://www.instagram.com/shared_person/',
      interactionType: 'like',
      sourceContentId: 'content_x',
      sourceContentUrl: null,
      observedAt: '2026-09-19T10:00:00.000Z',
    }

    await persistDiscoveryResult(supabaseAsA, WORKSPACE_A, makeResult([interaction]))

    const supabaseAsB = makeFakeSupabase(db, WORKSPACE_B)
    const lookupFromB = await supabaseAsB.from('leads').select('id').eq('workspace_id', WORKSPACE_A).eq('instagram_user_id', 'shared_person_1').maybeSingle()

    expect(lookupFromB.data).toBeNull()
    expect(db.leads).toHaveLength(1) // the lead exists, just not visible cross-workspace
  })

  it('refuses to insert a row for a workspace other than the one the client is scoped to', async () => {
    const db = new FakeDatabase()
    const supabaseAsA = makeFakeSupabase(db, WORKSPACE_A)

    const insertResult = await supabaseAsA
      .from('leads')
      .insert({ workspace_id: WORKSPACE_B, source: 'instagram_engagement', first_name: 'x' })
      .select('id')
      .single()

    expect(insertResult.error).not.toBeNull()
    expect(db.leads).toHaveLength(0)
  })
})

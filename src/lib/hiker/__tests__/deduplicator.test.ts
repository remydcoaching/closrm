import { describe, it, expect } from 'vitest'
import { UserDeduplicator } from '../deduplicator'
import { normalizeUser } from '../normalizer'

describe('UserDeduplicator', () => {
  it('merges a username-only sighting into an id-known profile seen later', () => {
    const dedup = new UserDeduplicator()
    dedup.recordInteraction(normalizeUser({ username: 'pierre' }), 'like', 'content1', '2026-01-01T00:00:00Z')
    dedup.recordInteraction(normalizeUser({ username: 'pierre', pk: 123 }), 'comment', 'content2', '2026-01-02T00:00:00Z')

    const profiles = dedup.allProfiles()
    expect(profiles).toHaveLength(1)
    expect(profiles[0].instagramUserId).toBe('123')
    expect(profiles[0].likeCount).toBe(1)
    expect(profiles[0].commentCount).toBe(1)
  })

  it('treats the same instagramUserId as one person even if username changed between sightings', () => {
    const dedup = new UserDeduplicator()
    dedup.recordInteraction(normalizeUser({ username: 'pierre', pk: 123 }), 'like', 'content1', '2026-01-01T00:00:00Z')
    dedup.recordInteraction(normalizeUser({ username: 'pierre_coaching', pk: 123 }), 'like', 'content2', '2026-01-02T00:00:00Z')

    const profiles = dedup.allProfiles()
    expect(profiles).toHaveLength(1)
    expect(profiles[0].username).toBe('pierre_coaching') // latest username wins for display
    expect(profiles[0].likeCount).toBe(2)
  })

  it('does not double-count a like on the same content from the same user', () => {
    const dedup = new UserDeduplicator()
    dedup.recordInteraction(normalizeUser({ username: 'x', pk: 1 }), 'like', 'content1', '2026-01-01T00:00:00Z')
    dedup.recordInteraction(normalizeUser({ username: 'x', pk: 1 }), 'like', 'content1', '2026-01-01T00:00:01Z')

    const profiles = dedup.allProfiles()
    expect(profiles[0].likeCount).toBe(1)
  })

  it('never merges two genuinely different usernames without a shared id', () => {
    const dedup = new UserDeduplicator()
    dedup.recordInteraction(normalizeUser({ username: 'alice' }), 'like', 'content1', '2026-01-01T00:00:00Z')
    dedup.recordInteraction(normalizeUser({ username: 'bob' }), 'like', 'content1', '2026-01-01T00:00:00Z')

    expect(dedup.allProfiles()).toHaveLength(2)
  })

  it('marks followsTarget without creating a like/comment interaction', () => {
    const dedup = new UserDeduplicator()
    dedup.markFollower(normalizeUser({ username: 'follower_only', pk: 1 }))

    const profiles = dedup.allProfiles()
    expect(profiles).toHaveLength(1)
    expect(profiles[0].followsTarget).toBe(true)
    expect(profiles[0].likeCount).toBe(0)
    expect(profiles[0].commentCount).toBe(0)
  })

  it('tracks first and last seen timestamps across interactions', () => {
    const dedup = new UserDeduplicator()
    const u = normalizeUser({ username: 'x', pk: 1 })
    dedup.recordInteraction(u, 'like', 'c1', '2026-01-05T00:00:00Z')
    dedup.recordInteraction(u, 'comment', 'c2', '2026-01-01T00:00:00Z')
    dedup.recordInteraction(u, 'like', 'c3', '2026-01-10T00:00:00Z')

    const profile = dedup.allProfiles()[0]
    expect(profile.firstSeenAt).toBe('2026-01-01T00:00:00Z')
    expect(profile.lastSeenAt).toBe('2026-01-10T00:00:00Z')
  })
})

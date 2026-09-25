// In-memory user deduplication for a single discovery run. Mirrors the logic
// validated in scripts/hiker-poc/normalize.ts (Deduplicator), adapted to the
// production NormalizedUser shape. Primary key: instagramUserId. Fallback:
// username, only when the id is genuinely absent from the source data.
import type { NormalizedUser } from './normalizer'

export type DiscoveredInteractionType = 'like' | 'comment'

export interface DiscoveredProfile {
  instagramUserId: string | null
  username: string
  fullName: string | null
  profilePicUrl: string | null
  isVerified: boolean | null
  likeCount: number
  commentCount: number
  likedContentIds: Set<string>
  commentedContentIds: Set<string>
  followsTarget: boolean
  firstSeenAt: string | null
  lastSeenAt: string | null
}

export class UserDeduplicator {
  private byId = new Map<string, DiscoveredProfile>()
  private byUsernameOnly = new Map<string, DiscoveredProfile>()

  private newProfile(u: NormalizedUser): DiscoveredProfile {
    return {
      instagramUserId: u.instagramUserId,
      username: u.username,
      fullName: u.fullName,
      profilePicUrl: u.profilePicUrl,
      isVerified: u.isVerified,
      likeCount: 0,
      commentCount: 0,
      likedContentIds: new Set(),
      commentedContentIds: new Set(),
      followsTarget: false,
      firstSeenAt: null,
      lastSeenAt: null,
    }
  }

  upsertUser(u: NormalizedUser): DiscoveredProfile {
    if (u.instagramUserId) {
      let profile = this.byId.get(u.instagramUserId)
      if (!profile) {
        const usernameOnly = this.byUsernameOnly.get(u.username.toLowerCase())
        if (usernameOnly) {
          profile = usernameOnly
          profile.instagramUserId = u.instagramUserId
          this.byUsernameOnly.delete(u.username.toLowerCase())
        } else {
          profile = this.newProfile(u)
        }
        this.byId.set(u.instagramUserId, profile)
      }
      if (!profile.fullName && u.fullName) profile.fullName = u.fullName
      if (!profile.profilePicUrl && u.profilePicUrl) profile.profilePicUrl = u.profilePicUrl
      profile.username = u.username // username can drift; id is the stable identity
      return profile
    }

    const key = u.username.toLowerCase()
    for (const p of this.byId.values()) {
      if (p.username.toLowerCase() === key) return p
    }
    let profile = this.byUsernameOnly.get(key)
    if (!profile) {
      profile = this.newProfile(u)
      this.byUsernameOnly.set(key, profile)
    }
    return profile
  }

  recordInteraction(u: NormalizedUser, type: DiscoveredInteractionType, contentId: string, observedAt: string) {
    const profile = this.upsertUser(u)
    if (type === 'like' && !profile.likedContentIds.has(contentId)) {
      profile.likeCount += 1
      profile.likedContentIds.add(contentId)
    } else if (type === 'comment' && !profile.commentedContentIds.has(contentId)) {
      profile.commentCount += 1
      profile.commentedContentIds.add(contentId)
    }
    if (!profile.firstSeenAt || observedAt < profile.firstSeenAt) profile.firstSeenAt = observedAt
    if (!profile.lastSeenAt || observedAt > profile.lastSeenAt) profile.lastSeenAt = observedAt
  }

  markFollower(u: NormalizedUser) {
    const profile = this.upsertUser(u)
    profile.followsTarget = true
  }

  allProfiles(): DiscoveredProfile[] {
    const seen = new Set<DiscoveredProfile>()
    const result: DiscoveredProfile[] = []
    for (const p of this.byId.values()) {
      if (!seen.has(p)) {
        seen.add(p)
        result.push(p)
      }
    }
    for (const p of this.byUsernameOnly.values()) {
      if (!seen.has(p)) {
        seen.add(p)
        result.push(p)
      }
    }
    return result
  }
}

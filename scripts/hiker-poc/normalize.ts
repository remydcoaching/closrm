// In-memory normalization + deduplication. NEVER writes to ClosRM DB.

export interface NormalizedUser {
  instagram_user_id: string | null
  username: string
  full_name: string | null
  profile_pic_url: string | null
  is_verified: boolean | null
  is_private: boolean | null
}

export type InteractionType = 'like' | 'comment' | 'follower' | 'following'

export interface Interaction {
  instagram_user_id: string | null
  username: string
  interaction_type: InteractionType
  source_media_id: string | null
  source_media_code: string | null
  observed_at: string
  provider: 'hiker'
}

export interface AggregatedProfile {
  instagram_user_id: string | null
  username: string
  full_name: string | null
  profile_pic_url: string | null
  is_verified: boolean | null
  n_likes: number
  n_comments: number
  liked_media_count: number
  commented_media_count: number
  liked_media_ids: Set<string>
  commented_media_ids: Set<string>
  follows_target: boolean
  first_interaction: string | null
  last_interaction: string | null
  sources: Set<'liker' | 'commenter' | 'follower'>
}

// Deduplication key: instagram_user_id when present, else username.
// Merges a username-only record into an ID-known record if the ID surfaces later.
export class Deduplicator {
  private byId = new Map<string, AggregatedProfile>()
  private byUsernameOnly = new Map<string, AggregatedProfile>()

  private keyFor(u: NormalizedUser): { key: string; isId: boolean } {
    if (u.instagram_user_id) return { key: u.instagram_user_id, isId: true }
    return { key: u.username.toLowerCase(), isId: false }
  }

  private newProfile(u: NormalizedUser): AggregatedProfile {
    return {
      instagram_user_id: u.instagram_user_id,
      username: u.username,
      full_name: u.full_name,
      profile_pic_url: u.profile_pic_url,
      is_verified: u.is_verified,
      n_likes: 0,
      n_comments: 0,
      liked_media_count: 0,
      commented_media_count: 0,
      liked_media_ids: new Set(),
      commented_media_ids: new Set(),
      follows_target: false,
      first_interaction: null,
      last_interaction: null,
      sources: new Set(),
    }
  }

  upsertUser(u: NormalizedUser): AggregatedProfile {
    const { key, isId } = this.keyFor(u)

    if (isId) {
      let profile = this.byId.get(key)
      if (!profile) {
        // Check if a username-only record exists for this same username — merge it.
        const existingByUsername = this.byUsernameOnly.get(u.username.toLowerCase())
        if (existingByUsername) {
          profile = existingByUsername
          profile.instagram_user_id = u.instagram_user_id
          this.byUsernameOnly.delete(u.username.toLowerCase())
        } else {
          profile = this.newProfile(u)
        }
        this.byId.set(key, profile)
      }
      // Keep richer fields if newly provided.
      if (!profile.full_name && u.full_name) profile.full_name = u.full_name
      if (!profile.profile_pic_url && u.profile_pic_url) profile.profile_pic_url = u.profile_pic_url
      if (profile.username !== u.username) profile.username = u.username // username can change; ID is truth
      return profile
    }

    // Username-only path: check if we already know this username under an ID.
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

  recordInteraction(u: NormalizedUser, interaction: Omit<Interaction, 'instagram_user_id' | 'username'>) {
    const profile = this.upsertUser(u)

    if (interaction.interaction_type === 'like') {
      if (!interaction.source_media_id || !profile.liked_media_ids.has(interaction.source_media_id)) {
        profile.n_likes += 1
        profile.liked_media_count += 1
        if (interaction.source_media_id) profile.liked_media_ids.add(interaction.source_media_id)
      }
      profile.sources.add('liker')
    } else if (interaction.interaction_type === 'comment') {
      if (!interaction.source_media_id || !profile.commented_media_ids.has(interaction.source_media_id)) {
        profile.n_comments += 1
        profile.commented_media_count += 1
        if (interaction.source_media_id) profile.commented_media_ids.add(interaction.source_media_id)
      }
      profile.sources.add('commenter')
    } else if (interaction.interaction_type === 'follower') {
      profile.follows_target = true
      profile.sources.add('follower')
    }

    if (!profile.first_interaction || interaction.observed_at < profile.first_interaction) {
      profile.first_interaction = interaction.observed_at
    }
    if (!profile.last_interaction || interaction.observed_at > profile.last_interaction) {
      profile.last_interaction = interaction.observed_at
    }
  }

  allProfiles(): AggregatedProfile[] {
    const seen = new Set<AggregatedProfile>()
    const result: AggregatedProfile[] = []
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

  uniqueCount(): number {
    return this.allProfiles().length
  }
}

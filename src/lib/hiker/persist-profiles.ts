// Persists a DiscoveryResult as OBSERVATIONS only — into discovery_profiles
// (migration 102), never creating a lead automatically. This replaces
// persist.ts's persistDiscoveryResult for the "Ciblage" (renamed from
// "Instagram Discovery") flow per explicit product feedback: scanning an
// account must show who reacted to it (with their like/comment counts,
// follow status, and whether they're already a lead) without silently
// converting every one of them into a lead — that conversion is a manual,
// per-profile "Cibler" action (see target.ts).
//
// persist.ts's persistDiscoveryResult and its bulk-lead-creation behavior
// are kept as-is (still covered by its own tests) since other callers may
// still depend on it; only the API route (src/app/api/instagram/discovery)
// is repointed to this new function.
import type { DiscoveryResult } from './discovery'

export interface PersistProfilesResult {
  profilesObserved: number
  alreadyLeadsCount: number
  errors: string[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function persistDiscoveryProfiles(supabase: any, workspaceId: string, discoveryRunId: string, result: DiscoveryResult): Promise<PersistProfilesResult> {
  const errors: string[] = []
  let alreadyLeadsCount = 0

  // One row per observed profile per run — deliberately not deduped across
  // runs (see migration 102 comment: "les analyses sont gardées en backup",
  // each run's observations are its own historical record).
  for (const profile of result.users) {
    let matchedLeadId: string | null = null

    if (profile.instagramUserId) {
      const { data: leadByUserId } = await supabase
        .from('leads')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('instagram_user_id', profile.instagramUserId)
        .maybeSingle()
      matchedLeadId = leadByUserId?.id ?? null
    }
    if (!matchedLeadId) {
      const { data: leadByHandle } = await supabase
        .from('leads')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('instagram_handle', profile.username)
        .maybeSingle()
      matchedLeadId = leadByHandle?.id ?? null
    }
    if (matchedLeadId) alreadyLeadsCount += 1

    const { error: insertError } = await supabase.from('discovery_profiles').insert({
      workspace_id: workspaceId,
      discovery_run_id: discoveryRunId,
      instagram_user_id: profile.instagramUserId,
      instagram_username: profile.username,
      full_name: profile.fullName,
      profile_pic_url: profile.profilePicUrl,
      is_verified: profile.isVerified,
      follows_target: profile.followsTarget,
      likes_count: profile.likeCount,
      comments_count: profile.commentCount,
      matched_lead_id: matchedLeadId,
    })

    if (insertError) {
      errors.push(`Failed to persist discovery profile for ${profile.username}: ${insertError.message}`)
    }
  }

  return { profilesObserved: result.users.length, alreadyLeadsCount, errors }
}

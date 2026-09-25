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

const LOOKUP_CHUNK = 200
const INSERT_CHUNK = 500

// Batched: a scan can observe thousands of profiles — one lookup per chunk
// of ids/handles and one insert per chunk of rows, instead of 2-3 sequential
// requests per profile (which ran for minutes and risked the function's
// time budget).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function persistDiscoveryProfiles(supabase: any, workspaceId: string, discoveryRunId: string, result: DiscoveryResult): Promise<PersistProfilesResult> {
  const errors: string[] = []

  const leadIdByUserId = new Map<string, string>()
  const leadIdByHandle = new Map<string, string>()

  const userIds = [...new Set(result.users.map((u) => u.instagramUserId).filter((id): id is string => !!id))]
  for (let i = 0; i < userIds.length; i += LOOKUP_CHUNK) {
    const { data, error } = await supabase
      .from('leads')
      .select('id, instagram_user_id')
      .eq('workspace_id', workspaceId)
      .in('instagram_user_id', userIds.slice(i, i + LOOKUP_CHUNK))
    if (error) errors.push(`Lead lookup by instagram_user_id failed: ${error.message}`)
    for (const l of data ?? []) if (l.instagram_user_id) leadIdByUserId.set(l.instagram_user_id, l.id)
  }

  const handles = [...new Set(result.users.map((u) => u.username))]
  for (let i = 0; i < handles.length; i += LOOKUP_CHUNK) {
    const { data, error } = await supabase
      .from('leads')
      .select('id, instagram_handle')
      .eq('workspace_id', workspaceId)
      .in('instagram_handle', handles.slice(i, i + LOOKUP_CHUNK))
    if (error) errors.push(`Lead lookup by instagram_handle failed: ${error.message}`)
    for (const l of data ?? []) if (l.instagram_handle && !leadIdByHandle.has(l.instagram_handle)) leadIdByHandle.set(l.instagram_handle, l.id)
  }

  let alreadyLeadsCount = 0
  // One row per observed profile per run — deliberately not deduped across
  // runs (see migration 102 comment: "les analyses sont gardées en backup",
  // each run's observations are its own historical record).
  const rows = result.users.map((profile) => {
    const matchedLeadId = (profile.instagramUserId && leadIdByUserId.get(profile.instagramUserId)) || leadIdByHandle.get(profile.username) || null
    if (matchedLeadId) alreadyLeadsCount += 1
    return {
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
    }
  })

  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    const chunk = rows.slice(i, i + INSERT_CHUNK)
    const { error: insertError } = await supabase.from('discovery_profiles').insert(chunk)
    if (insertError) {
      errors.push(`Failed to persist discovery profiles ${chunk[0].instagram_username}…${chunk[chunk.length - 1].instagram_username}: ${insertError.message}`)
    }
  }

  return { profilesObserved: result.users.length, alreadyLeadsCount, errors }
}

// Persists a DiscoveryResult into ClosRM's existing leads + instagram_interactions
// tables. No new tables for leads/prospects — reuses the exact identity model
// already established by src/lib/apify/process-likers.ts:
//   - lead identity key: workspace_id + instagram_user_id (unique index from
//     migration 092), username is never a lookup key on its own.
//   - instagram_interactions dedup: an expression unique index (092) that
//     PostgREST cannot target via onConflict, so rows are looked up then
//     inserted/updated explicitly — same limitation, same workaround.
import type { DiscoveryResult } from './discovery'

export interface PersistResult {
  leadsCreated: number
  leadsMatched: number
  interactionsUpserted: number
  errors: string[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function persistDiscoveredAccountProfile(supabase: any, workspaceId: string, result: DiscoveryResult): Promise<string | null> {
  const { account } = result
  if (!account.instagramUserId) return null

  const profile = account.profile
  const update = {
    instagram_followers_count: profile.follower_count ?? null,
    instagram_following_count: profile.following_count ?? null,
    instagram_is_verified: profile.is_verified ?? null,
    instagram_is_private: profile.is_private ?? null,
    instagram_profile_pic_url: profile.profile_pic_url ?? profile.profile_pic_url_hd ?? null,
    instagram_bio: profile.biography ?? null,
    instagram_profile_synced_at: new Date().toISOString(),
  }

  const { data: existingLead } = await supabase
    .from('leads')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('instagram_user_id', account.instagramUserId)
    .maybeSingle()

  if (!existingLead) return null

  await supabase.from('leads').update(update).eq('id', existingLead.id)
  return existingLead.id as string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function persistDiscoveryResult(supabase: any, workspaceId: string, result: DiscoveryResult): Promise<PersistResult> {
  let leadsCreated = 0
  let leadsMatched = 0
  let interactionsUpserted = 0
  const errors: string[] = []

  // Group interactions by (instagramUserId ?? username) so each person is
  // looked up / created as a lead exactly once per run, then each of their
  // interactions is upserted individually (dedup key includes content id).
  const byPerson = new Map<string, { instagramUserId: string | null; username: string; fullName: string | null; interactions: typeof result.interactions }>()
  for (const interaction of result.interactions) {
    const key = interaction.instagramUserId ?? interaction.username.toLowerCase()
    let entry = byPerson.get(key)
    if (!entry) {
      entry = { instagramUserId: interaction.instagramUserId, username: interaction.username, fullName: interaction.fullName, interactions: [] }
      byPerson.set(key, entry)
    }
    entry.interactions.push(interaction)
  }

  for (const [, person] of byPerson) {
    let leadId: string

    if (person.instagramUserId) {
      // Match by instagram_user_id FIRST (stable identity), but fall back to
      // instagram_handle if no id-based match exists — a lead created before
      // any Hiker/Apify run (manual entry, CSV import, web form) has
      // instagram_handle set but instagram_user_id NULL, and matching only
      // on the id let a duplicate lead get created for the same real person
      // every time a later discovery observed them (found via SQL: 17 leads
      // with a handle appearing exactly twice in production). Once matched
      // by handle, backfill instagram_user_id so future runs match by id.
      const { data: existingByI_id, error: lookupError } = await supabase
        .from('leads')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('instagram_user_id', person.instagramUserId)
        .maybeSingle()

      if (lookupError) {
        errors.push(`Lead lookup failed for ${person.username}: ${lookupError.message}`)
        continue
      }

      let existingLead = existingByI_id
      if (!existingLead) {
        const { data: existingByHandle, error: handleLookupError } = await supabase
          .from('leads')
          .select('id, instagram_user_id')
          .eq('workspace_id', workspaceId)
          .eq('instagram_handle', person.username)
          .maybeSingle()

        if (handleLookupError) {
          errors.push(`Lead lookup by handle failed for ${person.username}: ${handleLookupError.message}`)
          continue
        }

        if (existingByHandle) {
          existingLead = existingByHandle
          if (!existingByHandle.instagram_user_id) {
            await supabase.from('leads').update({ instagram_user_id: person.instagramUserId }).eq('id', existingByHandle.id)
          }
        }
      }

      if (existingLead) {
        leadId = existingLead.id
        leadsMatched += 1
      } else {
        const { data: newLead, error: insertError } = await supabase
          .from('leads')
          .insert({
            workspace_id: workspaceId,
            first_name: person.fullName ?? person.username,
            last_name: '',
            phone: '',
            email: null,
            status: 'nouveau',
            source: 'instagram_engagement',
            instagram_handle: person.username,
            instagram_user_id: person.instagramUserId,
          })
          .select('id')
          .single()

        if (insertError || !newLead) {
          errors.push(`Failed to create lead for ${person.username}: ${insertError?.message}`)
          continue
        }
        leadId = newLead.id
        leadsCreated += 1
      }
    } else {
      // No stable Instagram id available for this person (should be rare —
      // every liker/commenter shape observed during the POC carried a pk/id).
      // Fall back to matching by instagram_handle text, accepting the known
      // risk that a changed handle could create a duplicate lead later.
      const { data: existingLead, error: lookupError } = await supabase
        .from('leads')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('instagram_handle', person.username)
        .maybeSingle()

      if (lookupError) {
        errors.push(`Lead lookup failed for ${person.username}: ${lookupError.message}`)
        continue
      }

      if (existingLead) {
        leadId = existingLead.id
        leadsMatched += 1
      } else {
        const { data: newLead, error: insertError } = await supabase
          .from('leads')
          .insert({
            workspace_id: workspaceId,
            first_name: person.fullName ?? person.username,
            last_name: '',
            phone: '',
            email: null,
            status: 'nouveau',
            source: 'instagram_engagement',
            instagram_handle: person.username,
            instagram_user_id: null,
          })
          .select('id')
          .single()

        if (insertError || !newLead) {
          errors.push(`Failed to create lead for ${person.username}: ${insertError?.message}`)
          continue
        }
        leadId = newLead.id
        leadsCreated += 1
      }
    }

    for (const interaction of person.interactions) {
      // Same limitation as src/lib/apify/process-likers.ts: instagram_interactions'
      // uniqueness lives on an expression index (coalesce() over nullable
      // columns), which PostgREST's onConflict cannot target — look up by the
      // same identity the index dedupes on, then insert or update explicitly.
      const dedupKey = interaction.instagramUserId ?? interaction.username
      const { data: existingInteraction, error: lookupError } = await supabase
        .from('instagram_interactions')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('lead_id', leadId)
        .eq('interaction_type', interaction.interactionType)
        .eq('source_post_id', interaction.sourceContentId)
        .or(`instagram_user_id.eq.${dedupKey},instagram_username.eq.${dedupKey}`)
        .maybeSingle()

      if (lookupError) {
        errors.push(`Interaction lookup failed for ${person.username}: ${lookupError.message}`)
        continue
      }

      const interactionPayload = {
        workspace_id: workspaceId,
        lead_id: leadId,
        interaction_type: interaction.interactionType,
        instagram_user_id: interaction.instagramUserId,
        instagram_username: interaction.username,
        full_name: interaction.fullName,
        profile_url: interaction.profileUrl,
        source_post_id: interaction.sourceContentId,
        source_post_url: interaction.sourceContentUrl,
        source_provider: 'hiker',
        last_seen_at: interaction.observedAt,
        metadata: {},
      }

      if (existingInteraction) {
        const { error: updateError } = await supabase
          .from('instagram_interactions')
          .update({ last_seen_at: interaction.observedAt })
          .eq('id', existingInteraction.id)
        if (updateError) {
          errors.push(`Failed to update interaction for ${person.username}: ${updateError.message}`)
          continue
        }
      } else {
        const { error: insertError } = await supabase.from('instagram_interactions').insert(interactionPayload)
        if (insertError && !/duplicate|unique/i.test(insertError.message ?? '')) {
          errors.push(`Failed to insert interaction for ${person.username}: ${insertError.message}`)
          continue
        }
      }
      interactionsUpserted += 1
    }
  }

  // Persist the discovered account's OWN Instagram profile fields (biography,
  // follower/following counts, verified/private, profile picture) onto its
  // lead row, if that account is already a lead in this workspace — see
  // migration 104. Best-effort: a failure here does not fail the whole
  // discovery run (the interactions above are the primary outcome).
  try {
    await persistDiscoveredAccountProfile(supabase, workspaceId, result)
  } catch (err) {
    errors.push(`Failed to persist Instagram profile fields: ${err instanceof Error ? err.message : 'unknown error'}`)
  }

  return { leadsCreated, leadsMatched, interactionsUpserted, errors }
}

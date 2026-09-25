import type { ApifyLikerItem } from './client'

export interface ProcessLikersResult {
  leadsCreated: number
  leadsMatched: number
  interactionsUpserted: number
}

export async function processLikersDataset(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  workspaceId: string,
  watchedPostId: string,
  postUrl: string,
  items: ApifyLikerItem[],
): Promise<ProcessLikersResult> {
  let leadsCreated = 0
  let leadsMatched = 0
  let interactionsUpserted = 0

  for (const item of items) {
    const { data: existingById } = await supabase
      .from('leads')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('instagram_user_id', item.userId)
      .maybeSingle()

    // Same fallback as src/lib/hiker/persist.ts: a lead created before any
    // Hiker/Apify run has instagram_handle set but instagram_user_id NULL —
    // matching only by id let a duplicate lead be created for the same
    // person on every later run (found via SQL in production: 17 leads with
    // a duplicated handle). Backfill instagram_user_id once matched by handle.
    let existingLead = existingById
    if (!existingLead) {
      const { data: existingByHandle } = await supabase
        .from('leads')
        .select('id, instagram_user_id')
        .eq('workspace_id', workspaceId)
        .eq('instagram_handle', item.username)
        .maybeSingle()

      if (existingByHandle) {
        existingLead = existingByHandle
        if (!existingByHandle.instagram_user_id) {
          await supabase.from('leads').update({ instagram_user_id: item.userId }).eq('id', existingByHandle.id)
        }
      }
    }

    let leadId: string

    if (existingLead) {
      leadId = existingLead.id
      leadsMatched += 1
    } else {
      const { data: newLead, error: insertError } = await supabase
        .from('leads')
        .insert({
          workspace_id: workspaceId,
          first_name: item.fullName ?? item.username,
          last_name: '',
          phone: '',
          email: null,
          status: 'nouveau',
          source: 'instagram_engagement',
          instagram_handle: item.username,
          instagram_user_id: item.userId,
        })
        .select('id')
        .single()

      if (insertError || !newLead) {
        throw new Error(`Failed to create lead for Instagram user ${item.username}: ${insertError?.message}`)
      }

      leadId = newLead.id
      leadsCreated += 1
    }

    // instagram_interactions' uniqueness lives on an EXPRESSION index (coalesce() over
    // nullable columns, see migration 092) — PostgREST's onConflict only accepts a plain
    // column list, it cannot target an expression index (same limitation documented in
    // src/app/api/unsubscribe/route.ts for email_suppressions). So we look the row up by
    // the same identity the index dedupes on, then insert or update explicitly.
    const dedupKey = item.userId ?? item.username
    const { data: existingInteraction } = await supabase
      .from('instagram_interactions')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('lead_id', leadId)
      .eq('interaction_type', 'like')
      .eq('source_post_id', watchedPostId)
      .or(`instagram_user_id.eq.${dedupKey},instagram_username.eq.${dedupKey}`)
      .maybeSingle()

    const interactionPayload = {
      workspace_id: workspaceId,
      lead_id: leadId,
      interaction_type: 'like',
      instagram_user_id: item.userId,
      instagram_username: item.username,
      full_name: item.fullName,
      profile_url: `https://www.instagram.com/${item.username}/`,
      source_post_id: watchedPostId,
      source_post_url: postUrl,
      last_seen_at: item.scrapedAt,
      metadata: { position: item.position, isVerified: item.isVerified },
    }

    if (existingInteraction) {
      const { error: updateError } = await supabase
        .from('instagram_interactions')
        .update({ last_seen_at: item.scrapedAt, metadata: interactionPayload.metadata })
        .eq('id', existingInteraction.id)

      if (updateError) {
        throw new Error(`Failed to update interaction for ${item.username}: ${updateError.message}`)
      }
    } else {
      const { error: insertError } = await supabase.from('instagram_interactions').insert(interactionPayload)

      if (insertError && !/duplicate|unique/i.test(insertError.message ?? '')) {
        throw new Error(`Failed to insert interaction for ${item.username}: ${insertError.message}`)
      }
    }

    interactionsUpserted += 1
  }

  return { leadsCreated, leadsMatched, interactionsUpserted }
}

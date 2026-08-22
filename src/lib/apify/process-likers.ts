// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    const { data: existingLead } = await supabase
      .from('leads')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('instagram_user_id', item.userId)
      .maybeSingle()

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

    const { error: upsertError } = await supabase.from('instagram_interactions').upsert(
      {
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
      },
      { onConflict: 'instagram_interactions_dedup_uq' },
    )

    if (upsertError) {
      throw new Error(`Failed to upsert interaction for ${item.username}: ${upsertError.message}`)
    }

    interactionsUpserted += 1
  }

  return { leadsCreated, leadsMatched, interactionsUpserted }
}

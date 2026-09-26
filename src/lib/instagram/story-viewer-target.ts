// "Cibler" a story viewer: link them to their existing lead (by Instagram
// user id, then handle) or create one — same lead shape as the Ciblage
// target route — then backfill every story they were seen on into
// instagram_interactions (story_view), deduplicated, so the lead's journey
// and score include those views.
import type { SupabaseClient } from '@supabase/supabase-js'
import { interactionKey } from './story-views'

export async function targetStoryViewer(supabase: SupabaseClient, workspaceId: string, instagramUserId: string) {
  const { data: rows, error } = await supabase
    .from('story_viewers')
    .select('story_pk, instagram_user_id, instagram_username, full_name, profile_pic_url, is_verified, matched_lead_id, first_seen_at')
    .eq('workspace_id', workspaceId)
    .eq('instagram_user_id', instagramUserId)
  if (error) throw new Error(error.message)
  if (!rows || rows.length === 0) return null
  const viewer = rows[0]

  let leadId: string | null = rows.find((r) => r.matched_lead_id)?.matched_lead_id ?? null
  let created = false
  if (!leadId) {
    const { data: byId } = await supabase.from('leads').select('id').eq('workspace_id', workspaceId).eq('instagram_user_id', instagramUserId).maybeSingle()
    leadId = byId?.id ?? null
  }
  if (!leadId) {
    const { data: byHandle } = await supabase
      .from('leads')
      .select('id')
      .eq('workspace_id', workspaceId)
      .ilike('instagram_handle', viewer.instagram_username)
      .limit(1)
      .maybeSingle()
    leadId = byHandle?.id ?? null
  }
  if (!leadId) {
    const { data: lead, error: insertError } = await supabase
      .from('leads')
      .insert({
        workspace_id: workspaceId,
        first_name: viewer.full_name || viewer.instagram_username,
        last_name: '',
        phone: '',
        email: null,
        status: 'nouveau',
        source: 'instagram_engagement',
        instagram_handle: viewer.instagram_username,
        instagram_user_id: instagramUserId,
        instagram_is_verified: viewer.is_verified,
        instagram_profile_pic_url: viewer.profile_pic_url,
      })
      .select('id')
      .single()
    if (insertError || !lead) throw new Error(insertError?.message ?? 'Échec de la création du lead')
    leadId = lead.id
    created = true
  }

  await supabase.from('story_viewers').update({ matched_lead_id: leadId }).eq('workspace_id', workspaceId).eq('instagram_user_id', instagramUserId)

  const pks = rows.map((r) => r.story_pk)
  const { data: existing } = await supabase
    .from('instagram_interactions')
    .select('lead_id, source_post_id, instagram_user_id')
    .eq('workspace_id', workspaceId)
    .eq('lead_id', leadId)
    .eq('interaction_type', 'story_view')
    .in('source_post_id', pks)
  const have = new Set((existing ?? []).map((e) => interactionKey(e.lead_id, e.source_post_id, e.instagram_user_id)))
  const { data: stories } = await supabase.from('story_view_stories').select('story_pk, taken_at').eq('workspace_id', workspaceId).in('story_pk', pks)
  const takenAt = new Map((stories ?? []).map((s) => [s.story_pk, s.taken_at as string]))

  const toInsert = rows
    .filter((r) => !have.has(interactionKey(leadId as string, r.story_pk, instagramUserId)))
    .map((r) => ({
      workspace_id: workspaceId,
      lead_id: leadId,
      interaction_type: 'story_view',
      instagram_user_id: instagramUserId,
      instagram_username: r.instagram_username,
      full_name: r.full_name,
      profile_url: `https://instagram.com/${r.instagram_username}`,
      source_post_id: r.story_pk,
      source_provider: 'desktop_session',
      // Real observation window: story published → first seen by ClosRM.
      first_seen_at: takenAt.get(r.story_pk) ?? r.first_seen_at,
      last_seen_at: r.first_seen_at,
    }))
  if (toInsert.length > 0) {
    const { error: iErr } = await supabase.from('instagram_interactions').insert(toInsert)
    if (iErr) throw new Error(iErr.message)
  }
  return { leadId, created, storyViewsAdded: toInsert.length }
}

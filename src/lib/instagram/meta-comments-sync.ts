// Comments on the coach's own publications, read from the official Meta API
// (free, exact dates) instead of HikerAPI (Insyder measured comments at 88 %
// of a scan's cost). Runs in the nightly Instagram sync:
//  - every comment of the recent publications → ig_comments,
//  - comments by known leads → instagram_interactions (lead journey, score),
//    keyed by the media pk (from the shortcode) like Hiker scans and the
//    publication monitor, so the same comment isn't counted twice.
import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchAllMediaComments, fetchIgMedia, type IgCommentRaw } from './api'
import { shortcodeToMediaId } from './shortcode'
import type { SyncContext } from './sync'

const RECENT_MEDIA = 30

export interface CommentForLead {
  mediaPk: string
  username: string
  text: string
  timestamp: string
}

/** Pure: interaction rows for comments written by known leads (one per lead × publication, earliest comment). */
export function planCommentInteractions(
  workspaceId: string,
  comments: CommentForLead[],
  leadByHandle: Map<string, string>,
  existing: Set<string>,
): Record<string, unknown>[] {
  const firstByKey = new Map<string, CommentForLead & { leadId: string }>()
  for (const c of comments) {
    const leadId = leadByHandle.get(c.username.toLowerCase())
    if (!leadId || !c.mediaPk) continue
    const key = `${leadId}|comment|${c.mediaPk}`
    if (existing.has(key)) continue
    const prev = firstByKey.get(key)
    if (!prev || c.timestamp < prev.timestamp) firstByKey.set(key, { ...c, leadId })
  }
  return [...firstByKey.values()].map((c) => ({
    workspace_id: workspaceId,
    lead_id: c.leadId,
    interaction_type: 'comment',
    instagram_username: c.username,
    profile_url: `https://instagram.com/${c.username}`,
    source_post_id: c.mediaPk,
    source_provider: 'meta',
    // Meta gives the exact comment time.
    first_seen_at: c.timestamp,
    last_seen_at: c.timestamp,
    metadata: { comment_text: c.text.slice(0, 2000), dated_by: 'instagram', source: 'meta_api' },
  }))
}

async function leadsByHandle(supabase: SupabaseClient, workspaceId: string, handles: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  for (let i = 0; i < handles.length; i += 200) {
    const { data } = await supabase
      .from('leads')
      .select('id, instagram_handle')
      .eq('workspace_id', workspaceId)
      .in('instagram_handle', handles.slice(i, i + 200))
    for (const l of data ?? []) if (l.instagram_handle) map.set(String(l.instagram_handle).toLowerCase(), l.id)
  }
  return map
}

export async function syncComments(ctx: SyncContext): Promise<number> {
  const token = ctx.pageAccessToken ?? ctx.accessToken
  const media = await fetchIgMedia(token, RECENT_MEDIA, ctx.igUserId)
  const forLeads: CommentForLead[] = []
  let stored = 0
  for (const m of media) {
    const count = (m as { comments_count?: number }).comments_count ?? 0
    if (count === 0) continue
    const comments: IgCommentRaw[] = await fetchAllMediaComments(token, m.id)
    if (comments.length === 0) continue
    const { error } = await ctx.supabase.from('ig_comments').upsert(
      comments.map((c) => ({
        workspace_id: ctx.workspaceId,
        ig_comment_id: c.id,
        ig_media_id: m.id,
        media_caption: m.caption?.slice(0, 500) ?? null,
        text: c.text,
        username: c.username,
        timestamp: c.timestamp,
        ig_parent_id: c.parent_id ?? null,
      })),
      { onConflict: 'ig_comment_id', ignoreDuplicates: false },
    )
    if (error) console.error('[syncComments] ig_comments:', error.message)
    else stored += comments.length
    const mediaPk = m.shortcode ? shortcodeToMediaId(m.shortcode) : ''
    for (const c of comments) if (c.username) forLeads.push({ mediaPk, username: c.username, text: c.text ?? '', timestamp: c.timestamp })
  }

  // Known leads get the comment in their journey.
  const handles = [...new Set(forLeads.map((c) => c.username.toLowerCase()))]
  const leadByHandle = await leadsByHandle(ctx.supabase, ctx.workspaceId, handles)
  const leadIds = [...new Set(leadByHandle.values())]
  const existing = new Set<string>()
  for (let i = 0; i < leadIds.length; i += 200) {
    const { data } = await ctx.supabase
      .from('instagram_interactions')
      .select('lead_id, interaction_type, source_post_id')
      .eq('workspace_id', ctx.workspaceId)
      .eq('interaction_type', 'comment')
      .in('lead_id', leadIds.slice(i, i + 200))
    for (const r of data ?? []) existing.add(`${r.lead_id}|comment|${r.source_post_id}`)
  }
  const rows = planCommentInteractions(ctx.workspaceId, forLeads, leadByHandle, existing)
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await ctx.supabase.from('instagram_interactions').insert(rows.slice(i, i + 500))
    if (error) console.error('[syncComments] interactions:', error.message)
  }
  return stored
}

// Story viewers of the coach's own account, pushed by ClosRM Desktop (which
// reads them from the coach's Instagram session while stories are live).
// Persists into story_view_stories / story_viewers (migration 106) and, for
// viewers who are already leads, a 'story_view' row in instagram_interactions
// so the view feeds the engagement score, the lead timeline and audience.
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'

const viewerSchema = z.object({
  pk: z.string().min(1).max(40),
  username: z.string().min(1).max(60),
  fullName: z.string().max(200).nullish(),
  profilePicUrl: z.string().url().max(2000).nullish(),
  isVerified: z.boolean().nullish(),
  hasLiked: z.boolean().nullish(),
})

const storySchema = z.object({
  pk: z.string().min(1).max(40),
  takenAt: z.string().datetime(),
  expiringAt: z.string().datetime().nullish(),
  mediaType: z.enum(['image', 'video']).nullish(),
  thumbnailUrl: z.string().url().max(2000).nullish(),
  viewerCount: z.number().int().min(0).nullish(),
  viewers: z.array(viewerSchema).max(20000),
})

export const storyViewsPayloadSchema = z.object({
  accountUsername: z.string().min(1).max(60),
  stories: z.array(storySchema).max(100),
})

export type StoryViewsPayload = z.infer<typeof storyViewsPayloadSchema>

export interface LeadMatch {
  byUserId: Map<string, string>
  byHandle: Map<string, string>
}

export interface PlannedRows {
  stories: Record<string, unknown>[]
  viewers: Record<string, unknown>[]
  /** story_view interactions to insert (already-existing ones filtered out). */
  interactions: Record<string, unknown>[]
}

export function interactionKey(leadId: string, storyPk: string, userId: string): string {
  return `${leadId}|${storyPk}|${userId}`
}

/** Pure: turns a payload + lead matches into the rows to write. */
export function planStoryViewRows(
  workspaceId: string,
  payload: StoryViewsPayload,
  leads: LeadMatch,
  existingInteractions: Set<string>,
  now: string,
): PlannedRows {
  const stories: Record<string, unknown>[] = []
  const viewers: Record<string, unknown>[] = []
  const interactions: Record<string, unknown>[] = []

  for (const story of payload.stories) {
    const seen = new Set<string>()
    for (const v of story.viewers) {
      if (seen.has(v.pk)) continue
      seen.add(v.pk)
      const leadId = leads.byUserId.get(v.pk) ?? leads.byHandle.get(v.username.toLowerCase()) ?? null
      viewers.push({
        workspace_id: workspaceId,
        story_pk: story.pk,
        instagram_user_id: v.pk,
        instagram_username: v.username,
        full_name: v.fullName ?? null,
        profile_pic_url: v.profilePicUrl ?? null,
        is_verified: v.isVerified ?? null,
        has_liked: v.hasLiked ?? null,
        matched_lead_id: leadId,
      })
      if (leadId && !existingInteractions.has(interactionKey(leadId, story.pk, v.pk))) {
        interactions.push({
          workspace_id: workspaceId,
          lead_id: leadId,
          interaction_type: 'story_view',
          instagram_user_id: v.pk,
          instagram_username: v.username,
          full_name: v.fullName ?? null,
          profile_url: `https://instagram.com/${v.username}`,
          source_post_id: story.pk,
          source_provider: 'desktop_session',
          // The view happened while the story was live: between its
          // publication and this collection.
          first_seen_at: story.takenAt,
          last_seen_at: now,
        })
      }
    }
    stories.push({
      workspace_id: workspaceId,
      story_pk: story.pk,
      instagram_account_username: payload.accountUsername,
      taken_at: story.takenAt,
      expiring_at: story.expiringAt ?? null,
      media_type: story.mediaType ?? null,
      thumbnail_url: story.thumbnailUrl ?? null,
      viewer_count: story.viewerCount ?? null,
      viewers_collected: seen.size,
      last_collected_at: now,
    })
  }
  return { stories, viewers, interactions }
}

const CHUNK = 200
const WRITE_CHUNK = 500

export async function persistStoryViews(supabase: SupabaseClient, workspaceId: string, payload: StoryViewsPayload) {
  const errors: string[] = []
  const allViewers = payload.stories.flatMap((s) => s.viewers)
  const userIds = [...new Set(allViewers.map((v) => v.pk))]
  const handles = [...new Set(allViewers.map((v) => v.username.toLowerCase()))]

  const leads: LeadMatch = { byUserId: new Map(), byHandle: new Map() }
  for (let i = 0; i < userIds.length; i += CHUNK) {
    const { data } = await supabase
      .from('leads')
      .select('id, instagram_user_id')
      .eq('workspace_id', workspaceId)
      .in('instagram_user_id', userIds.slice(i, i + CHUNK))
    for (const l of data ?? []) if (l.instagram_user_id) leads.byUserId.set(l.instagram_user_id, l.id)
  }
  for (let i = 0; i < handles.length; i += CHUNK) {
    const { data } = await supabase
      .from('leads')
      .select('id, instagram_handle')
      .eq('workspace_id', workspaceId)
      .in('instagram_handle', handles.slice(i, i + CHUNK))
    for (const l of data ?? []) if (l.instagram_handle) leads.byHandle.set((l.instagram_handle as string).toLowerCase(), l.id)
  }

  const matchedLeadIds = [...new Set([...leads.byUserId.values(), ...leads.byHandle.values()])]
  const storyPks = payload.stories.map((s) => s.pk)
  const existing = new Set<string>()
  for (let i = 0; i < matchedLeadIds.length; i += CHUNK) {
    const { data } = await supabase
      .from('instagram_interactions')
      .select('lead_id, source_post_id, instagram_user_id')
      .eq('workspace_id', workspaceId)
      .eq('interaction_type', 'story_view')
      .in('lead_id', matchedLeadIds.slice(i, i + CHUNK))
      .in('source_post_id', storyPks)
    for (const r of data ?? []) existing.add(interactionKey(r.lead_id, r.source_post_id, r.instagram_user_id))
  }

  const now = new Date().toISOString()
  const rows = planStoryViewRows(workspaceId, payload, leads, existing, now)

  if (rows.stories.length > 0) {
    const { error } = await supabase.from('story_view_stories').upsert(rows.stories, { onConflict: 'workspace_id,story_pk' })
    if (error) errors.push(`stories: ${error.message}`)
  }
  for (let i = 0; i < rows.viewers.length; i += WRITE_CHUNK) {
    // Merge-upsert: first_seen_at is not sent, so the first sighting is kept.
    const chunk = rows.viewers.slice(i, i + WRITE_CHUNK)
    let { error } = await supabase.from('story_viewers').upsert(chunk, { onConflict: 'workspace_id,story_pk,instagram_user_id' })
    // Migration 108 (has_liked) not applied yet: store the rest anyway.
    if (error && /has_liked/.test(error.message)) {
      ;({ error } = await supabase
        .from('story_viewers')
        .upsert(
          chunk.map(({ has_liked: _h, ...rest }) => rest),
          { onConflict: 'workspace_id,story_pk,instagram_user_id' },
        ))
    }
    if (error) errors.push(`viewers ${i}: ${error.message}`)
  }
  for (let i = 0; i < rows.interactions.length; i += WRITE_CHUNK) {
    const { error } = await supabase.from('instagram_interactions').insert(rows.interactions.slice(i, i + WRITE_CHUNK))
    if (error) errors.push(`interactions ${i}: ${error.message}`)
  }

  return {
    stories: rows.stories.length,
    viewers: rows.viewers.length,
    leadsMatched: new Set(rows.viewers.map((v) => v.matched_lead_id).filter(Boolean)).size,
    interactionsAdded: errors.some((e) => e.startsWith('interactions')) ? 0 : rows.interactions.length,
    errors,
  }
}

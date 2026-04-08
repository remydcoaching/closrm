import { SupabaseClient } from '@supabase/supabase-js'
import {
  fetchIgMedia, fetchReelInsights, fetchIgStories,
  fetchStoryInsights, fetchIgProfile, fetchIgConversations,
} from './api'

interface SyncContext {
  supabase: SupabaseClient
  workspaceId: string
  accessToken: string
  igUserId: string
  pageId?: string
  pageAccessToken?: string
}

export async function syncReels(ctx: SyncContext) {
  const media = await fetchIgMedia(ctx.accessToken, 50, ctx.igUserId)
  const reels = media.filter(m => m.media_type === 'VIDEO' || m.media_type === 'REELS')

  for (const reel of reels) {
    const insights = await fetchReelInsights(ctx.accessToken, reel.id)
    const likes = reel.like_count ?? 0
    const comments = reel.comments_count ?? 0
    const saves = insights.saved ?? 0
    const shares = insights.shares ?? 0
    const reach = insights.reach ?? 0
    const views = insights.views ?? 0
    const engagementRate = reach > 0
      ? ((likes + comments + saves + shares) / reach) * 100
      : 0

    await ctx.supabase.from('ig_reels').upsert({
      workspace_id: ctx.workspaceId,
      ig_media_id: reel.id,
      caption: reel.caption ?? null,
      thumbnail_url: reel.thumbnail_url ?? null,
      video_url: reel.media_url ?? null,
      views,
      likes,
      comments,
      shares,
      saves,
      reach,
      plays: views,
      engagement_rate: Math.round(engagementRate * 100) / 100,
      published_at: reel.timestamp,
    }, { onConflict: 'ig_media_id' })
  }

  return reels.length
}

export async function syncStories(ctx: SyncContext) {
  const stories = await fetchIgStories(ctx.accessToken, ctx.igUserId)
  let synced = 0

  for (const story of stories) {
    const insights = await fetchStoryInsights(ctx.accessToken, story.id)
    const publishedAt = story.timestamp
    const expiresAt = new Date(new Date(publishedAt).getTime() + 24 * 60 * 60 * 1000).toISOString()

    await ctx.supabase.from('ig_stories').upsert({
      workspace_id: ctx.workspaceId,
      ig_story_id: story.id,
      ig_media_url: story.media_url ?? null,
      thumbnail_url: story.thumbnail_url ?? null,
      caption: story.caption ?? null,
      story_type: story.media_type === 'VIDEO' ? 'video' : 'image',
      impressions: insights.impressions ?? 0,
      reach: insights.reach ?? 0,
      replies: insights.replies ?? 0,
      exits: insights.exits ?? 0,
      taps_forward: insights.taps_forward ?? 0,
      taps_back: insights.taps_back ?? 0,
      published_at: publishedAt,
      expires_at: expiresAt,
    }, { onConflict: 'ig_story_id' })
    synced++
  }

  return synced
}

export async function syncSnapshot(ctx: SyncContext) {
  const profile = await fetchIgProfile(ctx.accessToken, ctx.igUserId)

  const { data: reels } = await ctx.supabase
    .from('ig_reels')
    .select('views, reach')
    .eq('workspace_id', ctx.workspaceId)

  const totalViews = (reels ?? []).reduce((s, r) => s + (r.views ?? 0), 0)
  const totalReach = (reels ?? []).reduce((s, r) => s + (r.reach ?? 0), 0)

  const today = new Date().toISOString().slice(0, 10)

  const { data: prevSnaps } = await ctx.supabase
    .from('ig_snapshots')
    .select('followers')
    .eq('workspace_id', ctx.workspaceId)
    .order('snapshot_date', { ascending: false })
    .limit(1)

  const prevFollowers = prevSnaps?.[0]?.followers ?? profile.followers_count
  const newFollowers = profile.followers_count - prevFollowers

  await ctx.supabase.from('ig_snapshots').upsert({
    workspace_id: ctx.workspaceId,
    snapshot_date: today,
    followers: profile.followers_count,
    total_views: totalViews,
    total_reach: totalReach,
    new_followers: Math.max(0, newFollowers),
  }, { onConflict: 'workspace_id,snapshot_date' })

  // Keep max 10 snapshots
  const { data: allSnaps } = await ctx.supabase
    .from('ig_snapshots')
    .select('id')
    .eq('workspace_id', ctx.workspaceId)
    .order('snapshot_date', { ascending: false })

  if (allSnaps && allSnaps.length > 10) {
    const toDelete = allSnaps.slice(10).map(s => s.id)
    await ctx.supabase.from('ig_snapshots').delete().in('id', toDelete)
  }

  return { followers: profile.followers_count, newFollowers }
}

export async function syncConversations(ctx: SyncContext) {
  if (!ctx.pageId || !ctx.pageAccessToken) {
    console.warn('[syncConversations] Skipped — missing:', !ctx.pageId ? 'pageId' : 'pageAccessToken')
    return 0
  }
  const token = ctx.pageAccessToken
  const convos = await fetchIgConversations(token, ctx.pageId)
  let synced = 0

  for (const convo of convos) {
    const participant = convo.participants?.data?.find(p => p.id !== ctx.igUserId)
    if (!participant) continue

    const lastMsg = convo.messages?.data?.[0]

    // Try to fetch participant's profile pic
    let avatarUrl: string | null = null
    try {
      const picRes = await fetch(
        `https://graph.facebook.com/v25.0/${participant.id}?fields=profile_pic&access_token=${token}`
      )
      if (picRes.ok) {
        const picData = await picRes.json()
        avatarUrl = picData.profile_pic ?? null
      }
    } catch { /* skip if fails */ }

    await ctx.supabase.from('ig_conversations').upsert({
      workspace_id: ctx.workspaceId,
      ig_conversation_id: convo.id,
      participant_ig_id: participant.id,
      participant_username: participant.username ?? null,
      participant_name: participant.name ?? null,
      participant_avatar_url: avatarUrl,
      last_message_text: lastMsg?.message ?? null,
      last_message_at: lastMsg?.created_time ?? null,
    }, { onConflict: 'ig_conversation_id' })
    synced++
  }

  return synced
}

export async function syncAll(ctx: SyncContext) {
  const results = await Promise.allSettled([
    syncReels(ctx),
    syncStories(ctx),
    syncSnapshot(ctx),
    syncConversations(ctx),
  ])

  const errors: string[] = []
  const getValue = <T>(r: PromiseSettledResult<T>, label: string, fallback: T): T => {
    if (r.status === 'fulfilled') return r.value
    console.error(`[syncAll] ${label} failed:`, r.reason)
    errors.push(label)
    return fallback
  }

  return {
    reelsCount: getValue(results[0], 'reels', 0),
    storiesCount: getValue(results[1], 'stories', 0),
    snapshot: getValue(results[2], 'snapshot', { followers: 0, newFollowers: 0 }),
    convosCount: getValue(results[3], 'conversations', 0),
    errors: errors.length > 0 ? errors : undefined,
  }
}

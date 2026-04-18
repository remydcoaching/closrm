/**
 * Sync engine YouTube : channel snapshot + vidéos + analytics lifetime.
 * Idempotent (upsert).
 */
import { createServiceClient } from '@/lib/supabase/service'
import {
  fetchMyChannel,
  fetchPlaylistVideoIds,
  fetchVideosByIds,
  fetchChannelAnalytics,
  fetchVideoAnalytics,
  isoDurationToSeconds,
  isShort,
  type AnalyticsResponse,
} from './api'

interface SyncResult {
  channelUpdated: boolean
  videosUpserted: number
  snapshotSaved: boolean
  errors: string[]
}

/** Sync principal : channel + videos + stats lifetime. À appeler 1×/jour. */
export async function syncYoutubeAccount(workspaceId: string, token: string): Promise<SyncResult> {
  const result: SyncResult = { channelUpdated: false, videosUpserted: 0, snapshotSaved: false, errors: [] }
  const supabase = createServiceClient()

  // 1. Channel
  const channel = await fetchMyChannel(token)
  if (!channel) {
    result.errors.push('Aucun channel trouvé pour ce compte Google')
    return result
  }

  const uploadsPlaylistId = channel.contentDetails?.relatedPlaylists?.uploads
  const thumbnail = channel.snippet.thumbnails?.high?.url ?? channel.snippet.thumbnails?.medium?.url ?? null

  const { data: account } = await supabase
    .from('yt_accounts')
    .upsert(
      {
        workspace_id: workspaceId,
        channel_id: channel.id,
        channel_title: channel.snippet.title,
        channel_handle: channel.snippet.customUrl?.replace(/^@/, '') ?? null,
        channel_description: channel.snippet.description ?? null,
        thumbnail_url: thumbnail,
        country: channel.snippet.country ?? null,
        subscribers_baseline: parseInt(channel.statistics.subscriberCount || '0', 10),
        total_views_baseline: parseInt(channel.statistics.viewCount || '0', 10),
        videos_count_baseline: parseInt(channel.statistics.videoCount || '0', 10),
        last_synced_at: new Date().toISOString(),
      },
      { onConflict: 'workspace_id' },
    )
    .select()
    .single()

  if (!account) {
    result.errors.push('Failed to upsert yt_accounts')
    return result
  }
  result.channelUpdated = true

  // 2. Snapshot du jour
  try {
    const today = new Date().toISOString().slice(0, 10)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10)
    let revenue30d: number | null = null
    let views30d = 0
    let watchTime30d = 0
    let subsGained30d = 0
    try {
      const analytics = await fetchChannelAnalytics(token, {
        startDate: thirtyDaysAgo,
        endDate: today,
        metrics: ['views', 'estimatedMinutesWatched', 'subscribersGained'],
      })
      const row = analytics.rows?.[0]
      if (row) {
        views30d = Number(row[0] ?? 0)
        watchTime30d = Number(row[1] ?? 0)
        subsGained30d = Number(row[2] ?? 0)
      }
    } catch (e) {
      result.errors.push(`Analytics channel: ${(e as Error).message}`)
    }
    try {
      const rev = await fetchChannelAnalytics(token, {
        startDate: thirtyDaysAgo,
        endDate: today,
        metrics: ['estimatedRevenue'],
      })
      revenue30d = Number(rev.rows?.[0]?.[0] ?? 0)
    } catch {
      // Monetary scope peut ne pas être accordé → ignore
    }

    await supabase.from('yt_snapshots').upsert(
      {
        workspace_id: workspaceId,
        yt_account_id: account.id,
        date: today,
        subscribers: parseInt(channel.statistics.subscriberCount || '0', 10),
        total_views: parseInt(channel.statistics.viewCount || '0', 10),
        videos_count: parseInt(channel.statistics.videoCount || '0', 10),
        subscribers_gained_30d: subsGained30d,
        views_30d: views30d,
        watch_time_minutes_30d: watchTime30d,
        estimated_revenue_30d: revenue30d,
      },
      { onConflict: 'workspace_id,date' },
    )
    result.snapshotSaved = true
  } catch (e) {
    result.errors.push(`Snapshot: ${(e as Error).message}`)
  }

  // 3. Videos
  if (uploadsPlaylistId) {
    try {
      const videoIds = await fetchPlaylistVideoIds(token, uploadsPlaylistId, 200)
      if (videoIds.length > 0) {
        const videos = await fetchVideosByIds(token, videoIds)
        for (const v of videos) {
          const duration = isoDurationToSeconds(v.contentDetails.duration)
          const thumb =
            v.snippet.thumbnails?.maxres?.url ??
            v.snippet.thumbnails?.high?.url ??
            v.snippet.thumbnails?.medium?.url ??
            null
          await supabase.from('yt_videos').upsert(
            {
              workspace_id: workspaceId,
              yt_account_id: account.id,
              yt_video_id: v.id,
              title: v.snippet.title ?? null,
              description: v.snippet.description ?? null,
              tags: v.snippet.tags ?? [],
              category_id: v.snippet.categoryId ?? null,
              published_at: v.snippet.publishedAt ?? null,
              duration_seconds: duration,
              format: isShort(duration) ? 'short' : 'long',
              thumbnail_url: thumb,
              video_url: `https://www.youtube.com/watch?v=${v.id}`,
              privacy_status: v.status.privacyStatus ?? null,
              views: parseInt(v.statistics.viewCount ?? '0', 10),
              likes: parseInt(v.statistics.likeCount ?? '0', 10),
              comments: parseInt(v.statistics.commentCount ?? '0', 10),
              last_synced_at: new Date().toISOString(),
            },
            { onConflict: 'workspace_id,yt_video_id' },
          )
          result.videosUpserted++

          // Watch time lifetime (coûte 1u par vidéo)
          try {
            const publishedAt = v.snippet.publishedAt?.slice(0, 10) ?? '2005-01-01'
            const today2 = new Date().toISOString().slice(0, 10)
            const va = await fetchVideoAnalytics(token, {
              videoId: v.id,
              startDate: publishedAt,
              endDate: today2,
              metrics: ['estimatedMinutesWatched', 'averageViewDuration', 'averageViewPercentage', 'shares'],
            })
            const row = va.rows?.[0]
            if (row) {
              await supabase
                .from('yt_videos')
                .update({
                  watch_time_minutes: Number(row[0] ?? 0),
                  average_view_duration_sec: Math.round(Number(row[1] ?? 0)),
                  average_view_percentage: Number(row[2] ?? 0),
                  shares: Number(row[3] ?? 0),
                })
                .eq('workspace_id', workspaceId)
                .eq('yt_video_id', v.id)
            }
          } catch (e) {
            result.errors.push(`Analytics ${v.id}: ${(e as Error).message}`)
          }
        }
      }
    } catch (e) {
      result.errors.push(`Videos: ${(e as Error).message}`)
    }
  }

  return result
}

/** Daily granular stats for last 30 days per video (optionnel, coûteux en quota). */
export async function syncDailyStats(workspaceId: string, token: string, videoId: string): Promise<number> {
  const supabase = createServiceClient()
  const { data: video } = await supabase
    .from('yt_videos')
    .select('id, yt_video_id')
    .eq('workspace_id', workspaceId)
    .eq('id', videoId)
    .single()
  if (!video) return 0

  const today = new Date().toISOString().slice(0, 10)
  const start = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10)
  const analytics: AnalyticsResponse = await fetchVideoAnalytics(token, {
    videoId: video.yt_video_id,
    startDate: start,
    endDate: today,
    dimensions: 'day',
    metrics: ['views', 'estimatedMinutesWatched', 'likes', 'comments', 'shares', 'subscribersGained', 'subscribersLost'],
  })

  let count = 0
  for (const row of analytics.rows ?? []) {
    const [date, views, watchMin, likes, comments, shares, gained, lost] = row
    await supabase.from('yt_video_daily_stats').upsert(
      {
        yt_video_id: video.id,
        date,
        views: Number(views ?? 0),
        watch_time_minutes: Number(watchMin ?? 0),
        likes: Number(likes ?? 0),
        comments: Number(comments ?? 0),
        shares: Number(shares ?? 0),
        subscribers_gained: Number(gained ?? 0),
        subscribers_lost: Number(lost ?? 0),
      },
      { onConflict: 'yt_video_id,date' },
    )
    count++
  }
  return count
}

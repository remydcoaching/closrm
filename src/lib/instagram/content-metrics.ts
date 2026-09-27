// Per-content metrics for the Content page (chart + detail), pure so it can
// be unit-tested. Sources:
//  - discovery_contents: one row per (Ciblage run, content) with Instagram's
//    own public counters (views, likes, comments) at scan time;
//  - discovery_interactions: who liked/commented, per run (migration 110);
//  - instagram_content_summary: observed interactions attached to leads
//    (Apify + legacy Hiker flow).
// The most recent scan of a content is the reference snapshot.

export interface DiscoveryContentRow {
  discovery_run_id: string
  content_id: string
  content_type: string
  content_url: string | null
  thumbnail_url: string | null
  published_at: string | null
  view_count: number | null
  caption?: string | null
  reported_like_count: number | null
  reported_comment_count: number | null
  created_at: string
}

export interface ObservedCounts {
  likers: number
  commenters: number
  leads: number
}

export interface ContentMetrics {
  contentId: string
  contentType: string
  contentUrl: string | null
  thumbnailUrl: string | null
  caption: string | null
  publishedAt: string | null
  runId: string
  views: number | null
  /** Instagram's public counters when available, observed counts otherwise. */
  likesCount: number
  commentsCount: number
  /** (likes + comments) / views — null without views. */
  engagementRate: number | null
  /** Profiles actually identified (likers / commenters) and leads among them. */
  identifiedLikers: number
  identifiedCommenters: number
  leadsCount: number
}

/** Keeps the latest scan row per content_id. */
export function latestPerContent(rows: DiscoveryContentRow[]): DiscoveryContentRow[] {
  const latest = new Map<string, DiscoveryContentRow>()
  for (const r of rows) {
    const prev = latest.get(r.content_id)
    if (!prev || r.created_at > prev.created_at) latest.set(r.content_id, r)
  }
  return [...latest.values()]
}

export function buildContentMetrics(row: DiscoveryContentRow, observed: ObservedCounts): ContentMetrics {
  const likes = row.reported_like_count ?? observed.likers
  const comments = row.reported_comment_count ?? observed.commenters
  const views = row.view_count && row.view_count > 0 ? row.view_count : null
  return {
    contentId: row.content_id,
    contentType: row.content_type,
    contentUrl: row.content_url,
    thumbnailUrl: row.thumbnail_url,
    caption: row.caption ?? null,
    publishedAt: row.published_at,
    runId: row.discovery_run_id,
    views,
    likesCount: likes,
    commentsCount: comments,
    engagementRate: views ? (likes + comments) / views : null,
    identifiedLikers: observed.likers,
    identifiedCommenters: observed.commenters,
    leadsCount: observed.leads,
  }
}

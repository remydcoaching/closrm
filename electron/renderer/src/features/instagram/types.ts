import type { LeadStatus } from '../leads/types'
// Mirrors the real Hiker discovery contract — POST/GET /api/instagram/discovery
// (src/app/api/instagram/discovery/route.ts) and discovery_runs (migration
// 097) from the main ClosRM repo. No new backend, no invented shape.
export type DiscoveryStatus = 'RUNNING' | 'SUCCESS' | 'PARTIAL' | 'FAILED'
export type DiscoveryStoppedReason = 'completed' | 'insufficient_funds' | 'auth_error' | null

export interface DiscoveryRun {
  id: string
  workspace_id: string
  provider: 'hiker'
  instagram_username: string
  instagram_user_id: string | null
  status: DiscoveryStatus
  stopped_reason: DiscoveryStoppedReason
  contents_found: number
  users_found: number
  interactions_found: number
  followers_found: number
  http_calls: number
  estimated_billed_requests: number
  errors_count: number
  started_at: string
  completed_at: string | null
  metadata: Record<string, unknown> | null
}

export interface DiscoveryStats {
  mediaFetched: number
  clipsFetched: number
  uniqueContentsFetched: number
  contentsAnalyzedForInteractions: number
  uniqueUsers: number
  totalInteractions: number
  followersFetched: number
  httpCalls: number
  estimatedBilledRequests: number
  startedAt: string
  completedAt: string
  durationMs: number
}

export interface DiscoveryResponse {
  runId: string
  status: DiscoveryStatus
  stoppedReason: DiscoveryStoppedReason
  stats: DiscoveryStats
  persisted: {
    profilesObserved: number
    alreadyLeadsCount: number
  }
  warnings: string[]
  errors: string[]
}

// ─── Discovery profiles ("Ciblage" results, migration 108) ────────────────
// One row per Instagram profile OBSERVED during a run — never a lead by
// itself. matched_lead_id is set if it was already a lead at scan time, or
// once the coach clicks "Cibler" (see POST .../target).
export interface DiscoveryProfile {
  id: string
  workspace_id: string
  discovery_run_id: string
  instagram_user_id: string | null
  instagram_username: string
  full_name: string | null
  profile_pic_url: string | null
  is_verified: boolean | null
  follows_target: boolean
  likes_count: number
  comments_count: number
  dm_count: number
  matched_lead_id: string | null
  targeted_at: string | null
  created_at: string
}

// ─── Interactions (instagram_interactions table, migrations 092/096) ───────
export type InteractionType = 'like' | 'comment' | 'dm' | 'mention'
export type InteractionProvider = 'apify' | 'hiker' | null

export interface InstagramInteraction {
  id: string
  workspace_id: string
  lead_id: string
  interaction_type: InteractionType
  instagram_user_id: string | null
  instagram_username: string
  full_name: string | null
  profile_url: string | null
  source_post_id: string | null
  source_post_url: string | null
  source_provider: InteractionProvider
  first_seen_at: string
  last_seen_at: string
  metadata: Record<string, unknown> | null
  // Joined lead fields, when the listing route includes them.
  lead?: { id: string; first_name: string; last_name: string; instagram_handle: string | null; status: string } | null
}

// ─── Content aggregation (instagram_content_summary view, migration 105) ──
export interface InstagramContentSummary {
  workspace_id: string
  source_post_id: string
  source_post_url: string | null
  source_provider: InteractionProvider
  leads_count: number
  likes_count: number
  comments_count: number
  dm_count: number
  mention_count: number
  first_interaction_at: string
  last_interaction_at: string
}

// ─── Content chart point (GET /api/instagram/content/chart) ───────────────
/** Mirrors ContentMetrics (src/lib/instagram/content-metrics.ts). */
export interface ContentChartPoint {
  contentId: string
  contentType: 'media' | 'clip'
  contentUrl: string | null
  thumbnailUrl: string | null
  caption?: string | null
  publishedAt: string | null
  runId: string
  views: number | null
  likesCount: number
  commentsCount: number
  engagementRate: number | null
  identifiedLikers: number
  identifiedCommenters: number
  leadsCount: number
  /** Official Meta figures (null when the publication isn't synced from the Meta API). */
  reach?: number | null
  saves?: number | null
  shares?: number | null
  source?: 'meta' | 'hiker' | 'meta+hiker'
  /** Reels synced from Meta: false = Reels tab only, not on the grid (trial reel); null/undefined = unknown. */
  onGrid?: boolean | null
  /** Leads reached per confidence level (only with ?confidence=1). */
  confidence?: Partial<Record<ConfidenceKey, number>>
}

export type ConfidenceKey = 'tres_eleve' | 'eleve' | 'moyen' | 'faible' | 'insuffisant'

/** Mirrors ContentProfile (src/lib/instagram/content-data.ts). */
export interface ContentProfile {
  username: string
  fullName: string | null
  instagramUserId: string | null
  profilePicUrl: string | null
  isVerified: boolean | null
  followsTarget: boolean | null
  liked: boolean
  commented: boolean
  totalLikes: number | null
  totalComments: number | null
  discoveryProfileId: string | null
  runId: string | null
  lead: { id: string; firstName: string; lastName: string; status: LeadStatus } | null
}

export interface ContentDetail {
  metrics: ContentChartPoint
  profiles: ContentProfile[]
}

// Mirrors the relevant slices of src/types/index.ts (Instagram, social posts,
// YouTube) — same field names as the API responses.

export interface IgAccount {
  id: string
  ig_user_id: string
  ig_username: string | null
  is_connected: boolean
  starting_followers: number
  starting_date: string | null
}

export interface IgStory {
  id: string
  ig_story_id: string
  ig_media_url: string | null
  thumbnail_url: string | null
  caption: string | null
  story_type: 'video' | 'image'
  impressions: number
  reach: number
  replies: number
  exits: number
  taps_forward: number
  taps_back: number
  published_at: string
  expires_at: string
}

export type StorySequenceType =
  | 'confiance'
  | 'peur'
  | 'preuve_sociale'
  | 'urgence'
  | 'autorite'
  | 'storytelling'
  | 'offre'
  | 'education'

export interface StorySequence {
  id: string
  name: string
  sequence_type: StorySequenceType
  objective: string | null
  notes: string | null
  status: string
  total_impressions: number
  overall_dropoff_rate: number
  total_replies: number
  created_at: string
  published_at: string | null
}

export interface StorySequenceItem {
  id: string
  sequence_id: string
  story_id: string
  position: number
  story?: IgStory | null
}

export interface IgReel {
  id: string
  ig_media_id: string
  caption: string | null
  thumbnail_url: string | null
  video_url: string | null
  views: number
  likes: number
  comments: number
  shares: number
  saves: number
  reach: number
  plays: number
  engagement_rate: number
  format: 'talking_head' | 'text_overlay' | 'raw_documentary' | null
  pillar_id: string | null
  published_at: string
}

export interface ContentPillar {
  id: string
  name: string
  color: string
  created_at: string
}

export type IgDraftStatus = 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed'
export type IgDraftMediaType = 'IMAGE' | 'VIDEO' | 'CAROUSEL' | 'REELS' | 'STORY'

export interface IgDraft {
  id: string
  caption: string | null
  hashtags: string[]
  media_urls: string[]
  media_type: IgDraftMediaType | null
  status: IgDraftStatus
  scheduled_at: string | null
  published_at: string | null
  ig_media_id: string | null
  error_message: string | null
  created_at: string
  updated_at: string
}

export interface IgHashtagGroup {
  id: string
  name: string
  hashtags: string[]
  created_at: string
}

export type IgCaptionCategory =
  | 'general'
  | 'education'
  | 'storytelling'
  | 'offre'
  | 'preuve_sociale'
  | 'motivation'
  | 'behind_the_scenes'

export interface IgCaptionTemplate {
  id: string
  title: string
  body: string
  category: IgCaptionCategory
  hashtags: string[]
  created_at: string
}

export interface IgSnapshot {
  id: string
  snapshot_date: string
  followers: number
  total_views: number
  total_reach: number
  new_followers: number
}

export interface IgGoal {
  id: string
  quarter: string
  metric: string
  target_value: number
}

export interface IgConversation {
  id: string
  participant_username: string | null
  participant_name: string | null
  participant_avatar_url: string | null
  lead_id: string | null
  last_message_text: string | null
  last_message_at: string | null
  unread_count: number
}

export interface IgComment {
  id: string
  ig_comment_id: string
  ig_media_id: string
  media_caption?: string | null
  text: string
  username: string | null
  timestamp: string | null
  parent_id: string | null
}

// ─── Social posts (planning) ────────────────────────────────────────────────
export type SocialPlatform = 'instagram' | 'youtube' | 'tiktok'
export type SocialPostStatus = 'draft' | 'scheduled' | 'publishing' | 'published' | 'partial' | 'failed'
export type SocialContentKind = 'post' | 'story' | 'reel'
export type SocialProductionStatus = 'idea' | 'to_film' | 'filmed' | 'edited' | 'ready'
export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'
export type TrameGrid = Record<Weekday, (string | null)[]>

export interface SocialPostPublication {
  id?: string
  platform: SocialPlatform
  config: Record<string, unknown>
  scheduled_at: string | null
  status?: 'pending' | 'publishing' | 'published' | 'failed' | 'skipped'
  public_url?: string | null
  error_message?: string | null
}

export interface FinalVersion {
  version: number
  url: string
  uploaded_at: string
  uploaded_by: string | null
}

export interface SocialPost {
  id: string
  workspace_id: string
  title: string | null
  caption?: string | null
  hashtags?: string[]
  media_urls: string[]
  media_type?: string | null
  status: SocialPostStatus
  scheduled_at: string | null
  published_at: string | null
  pillar_id: string | null
  content_kind: SocialContentKind | null
  production_status: SocialProductionStatus | null
  plan_date: string | null
  slot_index: number | null
  hook: string | null
  script?: string | null
  references_urls?: string[]
  notes?: string | null
  monteur_id: string | null
  rush_url: string | null
  final_url: string | null
  final_versions?: FinalVersion[]
  editor_notes?: string | null
  montage_deadline?: string | null
  publications?: SocialPostPublication[]
}

export interface ContentTrame {
  id: string
  stories_grid: TrameGrid
  posts_grid: TrameGrid
  stories_per_day: number
  posts_per_day: number
}

export interface SlotMessage {
  id: string
  author_id: string
  body: string
  created_at: string
  video_timestamp_seconds: number | null
  resolved_at: string | null
  author: { id: string; full_name: string | null; email: string | null; avatar_url: string | null } | null
}

export interface TournageSession {
  id: string
  name: string | null
  scheduled_date: string | null
  status: 'draft' | 'ready' | 'in_progress' | 'completed' | 'archived'
  notes: string | null
  created_at: string
  reels_count: number
  stats: { total: number; done: number; skipped: number }
  reels?: { social_post_id: string; position: number; post?: { id: string; title: string | null; hook: string | null } | null }[]
}

// ─── YouTube ────────────────────────────────────────────────────────────────
export interface YtAccount {
  id: string
  channel_title: string | null
  channel_handle: string | null
  thumbnail_url: string | null
  subscribers_baseline: number | null
  last_synced_at: string | null
}

export interface YtVideo {
  id: string
  yt_video_id: string
  title: string | null
  description: string | null
  published_at: string | null
  duration_seconds: number | null
  format: 'short' | 'long' | null
  thumbnail_url: string | null
  video_url: string | null
  privacy_status: string | null
  views: number
  likes: number
  comments: number
  watch_time_minutes: number
  average_view_duration_sec: number
  average_view_percentage: number
  estimated_revenue: number | null
}

export interface YtVideoWithStats extends YtVideo {
  daily_stats: { date: string; views: number }[]
  traffic_sources: { source_type: string; views: number }[]
  demographics: { age_group: string; gender: string; viewer_percentage: number }[]
}

export interface YtSnapshot {
  date: string
  subscribers: number
  views_30d: number | null
  watch_time_minutes_30d: number | null
  subscribers_gained_30d: number | null
}

export interface YtComment {
  id: string
  author_name: string | null
  author_avatar_url: string | null
  text: string | null
  published_at: string | null
  like_count: number
  yt_videos?: { title: string | null; yt_video_id: string } | null
}

export interface ListResponse<T> {
  data: T[]
}

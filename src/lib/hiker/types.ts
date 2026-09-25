// Types for the Hiker production provider. Field shapes here are the ones
// CONFIRMED by direct probing during the POC (scripts/hiker-poc/), not the
// (sometimes misleading) descriptions from the HikerAPI OpenAPI schema —
// see scripts/hiker-poc/HIKER_POC_REPORT.md for the discrepancies found
// (e.g. /v3/media/likers returns { users: [...] }, not a bare array).

export interface HikerUserShort {
  pk?: number | string
  id?: number | string
  username: string
  full_name?: string | null
  profile_pic_url?: string | null
  profile_pic_url_hd?: string | null
  is_verified?: boolean | null
  is_private?: boolean | null
}

export interface HikerUserProfile extends HikerUserShort {
  media_count?: number
  follower_count?: number
  following_count?: number
  biography?: string
  external_url?: string
}

export interface HikerMediaItem {
  pk?: number | string
  id?: string
  code?: string
  taken_at?: number
  taken_at_ts?: number
  media_type?: number
  product_type?: string
  thumbnail_url?: string
  video_url?: string
  comment_count?: number
  comments_disabled?: boolean
  like_count?: number
  play_count?: number
  view_count?: number
  caption_text?: string
  user?: HikerUserShort
}

// [items, nextCursor|null] — confirmed shape for /v1/user/medias/chunk and
// /v1/user/clips/chunk. See HIKER_POC_REPORT.md §16.
export type HikerChunkResponse<T> = [T[], string | null]

export interface HikerLikersResponse {
  users?: HikerUserShort[]
  user_count?: number
  disclaimer_text?: string
  follow_ranking_token?: string
  status?: string
}

export interface HikerComment {
  pk?: string
  user?: HikerUserShort
  text?: string
  created_at?: number
  comment_like_count?: number
}

export interface HikerCommentsResponse {
  response?: {
    comments?: HikerComment[]
    comment_count?: number
    has_more_comments?: boolean
    has_more_headload_comments?: boolean
  }
  next_page_id?: string | null
}

// { response: { users: [...] }, next_page_id } — confirmed shape for
// /g2/user/followers.
export interface HikerPageIdResponse<TKey extends string, T> {
  response?: Record<TKey, T[]>
  next_page_id?: string | null
}

export interface HikerStoryItem {
  pk?: number | string
  id?: string
  taken_at?: number
  expiring_at?: number
  media_type?: number
  thumbnail_url?: string
  video_url?: string
}

export interface HikerStoriesResponse {
  broadcast?: unknown
  reel?: { items?: HikerStoryItem[]; expiring_at?: number; id?: string; is_archived?: boolean } | null
  status?: string
}

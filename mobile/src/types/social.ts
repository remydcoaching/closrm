// Types locaux pour le module Réseaux Sociaux côté mobile.
// Miroir des types du repo web (src/types/index.ts) — gardé minimal,
// on n'expose que ce dont l'app mobile a besoin pour lister/créer
// des posts.

export type SocialPlatform = 'instagram' | 'youtube' | 'tiktok'

export type SocialPostStatus =
  | 'draft'
  | 'scheduled'
  | 'publishing'
  | 'published'
  | 'partial'
  | 'failed'

export type SocialContentKind = 'post' | 'story' | 'reel'

export type SocialProductionStatus =
  | 'idea'
  | 'to_film'
  | 'filmed'
  | 'edited'
  | 'ready'

export type SocialPublicationStatus =
  | 'pending'
  | 'publishing'
  | 'published'
  | 'failed'
  | 'skipped'

export interface SocialPostPublication {
  id: string
  social_post_id: string
  platform: SocialPlatform
  scheduled_at: string | null
  status: SocialPublicationStatus
  public_url: string | null
  published_at: string | null
  error_message: string | null
}

export interface SocialPost {
  id: string
  workspace_id: string
  title: string | null
  caption: string | null
  hashtags: string[]
  media_urls: string[]
  thumbnail_url: string | null
  status: SocialPostStatus
  scheduled_at: string | null
  published_at: string | null
  pillar_id: string | null
  content_kind: SocialContentKind | null
  production_status: SocialProductionStatus | null
  plan_date: string | null
  slot_index: number | null
  hook: string | null
  created_at: string
  updated_at: string
}

export interface SocialPostWithPublications extends SocialPost {
  publications: SocialPostPublication[]
}

export const STATUS_LABELS: Record<SocialPostStatus, string> = {
  draft: 'Brouillon',
  scheduled: 'Programmé',
  publishing: 'Publication…',
  published: 'Publié',
  partial: 'Partiel',
  failed: 'Échec',
}

export const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  instagram: 'Instagram',
  youtube: 'YouTube',
  tiktok: 'TikTok',
}

export const PLATFORM_ICONS: Record<SocialPlatform, 'logo-instagram' | 'logo-youtube' | 'musical-notes'> = {
  instagram: 'logo-instagram',
  youtube: 'logo-youtube',
  tiktok: 'musical-notes', // TikTok pas dans Ionicons par défaut
}

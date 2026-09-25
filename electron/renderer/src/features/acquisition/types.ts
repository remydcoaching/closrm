// Mirrors the EXISTING GET/POST/PATCH/DELETE /api/lead-magnets and
// GET /api/lead-magnets/:id/stats — same routes the web uses, no new backend.
export type LeadMagnetPlatform = 'youtube' | 'tiktok' | 'instagram' | 'podcast' | 'blog' | 'pdf' | 'other'

export interface LeadMagnet {
  id: string
  workspace_id: string
  title: string
  url: string
  platform: LeadMagnetPlatform
  created_at: string
  updated_at: string
}

export interface LeadMagnetTopLead {
  lead_id: string
  name: string
  clicks: number
  last_clicked_at: string | null
}

export interface LeadMagnetStats {
  total_clicks: number
  unique_leads: number
  top_leads: LeadMagnetTopLead[]
}

export const PLATFORM_OPTIONS: { value: LeadMagnetPlatform; label: string; emoji: string }[] = [
  { value: 'youtube', label: 'YouTube', emoji: '🎥' },
  { value: 'tiktok', label: 'TikTok', emoji: '🎵' },
  { value: 'instagram', label: 'Instagram', emoji: '📷' },
  { value: 'podcast', label: 'Podcast', emoji: '🎧' },
  { value: 'blog', label: 'Blog', emoji: '📝' },
  { value: 'pdf', label: 'PDF', emoji: '📘' },
  { value: 'other', label: 'Autre', emoji: '🔗' },
]

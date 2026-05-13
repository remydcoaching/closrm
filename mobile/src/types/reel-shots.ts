// Types miroir de la table reel_shots (1 row = 1 phrase d'un reel,
// avec lieu de tournage assigné). Mêmes colonnes que côté web :
// closrm/supabase/migrations/077_reel_shots.sql

export interface ReelShot {
  id: string
  workspace_id: string
  social_post_id: string
  position: number
  text: string
  location: string | null
  shot_note: string | null
  done: boolean
  skipped: boolean
  ai_suggested_location: string | null
  created_at: string
  updated_at: string
}

export interface ShotInfo {
  id: string
  reelId: string
  reelTitle: string
  text: string
  shotNote: string | null
  position: number
  total: number
  prevText: string | null
  nextText: string | null
  skipped: boolean
}

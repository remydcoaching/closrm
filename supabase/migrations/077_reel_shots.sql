-- supabase/migrations/077_reel_shots.sql
-- Plan de tournage par lieu : 1 row = 1 phrase d'un reel avec son lieu
-- de tournage et son statut (tournée / reportée).
--
-- Voir docs/superpowers/specs/2026-05-09-reels-tournage-design.md
--
-- Idempotent (safe à re-jouer).

CREATE TABLE IF NOT EXISTS reel_shots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  social_post_id UUID NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,

  -- Position dans le reel (0, 1, 2, ...). Permet de retrouver l'ordre
  -- même si on edit la liste. Unique par (social_post_id, position).
  position INT NOT NULL,

  -- La phrase à dire pendant le tournage
  text TEXT NOT NULL,

  -- Lieu de tournage (texte libre, autocomplete côté UI)
  location TEXT,

  -- Notes de cadrage / action (ex: "gros plan visage", "pointer la barre")
  shot_note TEXT,

  -- Statuts de tournage
  done BOOLEAN NOT NULL DEFAULT false,
  skipped BOOLEAN NOT NULL DEFAULT false,

  -- Suggestion de l'IA (pour audit + override visible)
  ai_suggested_location TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (social_post_id, position)
);

-- Index pour la query principale "tous les shots non tournés à la poulie"
CREATE INDEX IF NOT EXISTS idx_reel_shots_workspace_location_todo
  ON reel_shots(workspace_id, location)
  WHERE done = false AND location IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reel_shots_post
  ON reel_shots(social_post_id, position);

CREATE INDEX IF NOT EXISTS idx_reel_shots_workspace
  ON reel_shots(workspace_id);

-- ═════════════════════════════════════════════════════════
-- RLS — workspace_members
-- ═════════════════════════════════════════════════════════
ALTER TABLE reel_shots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reel_shots_select" ON reel_shots;
DROP POLICY IF EXISTS "reel_shots_insert" ON reel_shots;
DROP POLICY IF EXISTS "reel_shots_update" ON reel_shots;
DROP POLICY IF EXISTS "reel_shots_delete" ON reel_shots;

CREATE POLICY "reel_shots_select" ON reel_shots FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));
CREATE POLICY "reel_shots_insert" ON reel_shots FOR INSERT
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));
CREATE POLICY "reel_shots_update" ON reel_shots FOR UPDATE
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));
CREATE POLICY "reel_shots_delete" ON reel_shots FOR DELETE
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

-- ═════════════════════════════════════════════════════════
-- Trigger updated_at (réutilise update_updated_at() existant)
-- ═════════════════════════════════════════════════════════
DROP TRIGGER IF EXISTS reel_shots_updated_at ON reel_shots;
CREATE TRIGGER reel_shots_updated_at
  BEFORE UPDATE ON reel_shots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

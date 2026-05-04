-- Migration 064: Bibliothèque de hooks réutilisables
-- Permet de sauvegarder les hooks générés/écrits pour les réutiliser sur d'autres slots.

CREATE TABLE IF NOT EXISTS social_hook_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  pillar_id UUID REFERENCES ig_content_pillars(id) ON DELETE SET NULL,
  content_kind TEXT,
  source TEXT NOT NULL DEFAULT 'manual',  -- 'manual' | 'ai_generated' | 'extracted'
  used_count INT NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE social_hook_library DROP CONSTRAINT IF EXISTS hook_library_source_check;
ALTER TABLE social_hook_library ADD CONSTRAINT hook_library_source_check
  CHECK (source IN ('manual', 'ai_generated', 'extracted'));

ALTER TABLE social_hook_library DROP CONSTRAINT IF EXISTS hook_library_content_kind_check;
ALTER TABLE social_hook_library ADD CONSTRAINT hook_library_content_kind_check
  CHECK (content_kind IS NULL OR content_kind IN ('post', 'story', 'reel'));

CREATE INDEX IF NOT EXISTS idx_hook_library_workspace
  ON social_hook_library(workspace_id, used_count DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hook_library_pillar
  ON social_hook_library(pillar_id) WHERE pillar_id IS NOT NULL;

ALTER TABLE social_hook_library ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hook_library_select" ON social_hook_library;
DROP POLICY IF EXISTS "hook_library_insert" ON social_hook_library;
DROP POLICY IF EXISTS "hook_library_update" ON social_hook_library;
DROP POLICY IF EXISTS "hook_library_delete" ON social_hook_library;

CREATE POLICY "hook_library_select" ON social_hook_library FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));
CREATE POLICY "hook_library_insert" ON social_hook_library FOR INSERT
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));
CREATE POLICY "hook_library_update" ON social_hook_library FOR UPDATE
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));
CREATE POLICY "hook_library_delete" ON social_hook_library FOR DELETE
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

-- Migration 063: Content Trame & Planning Mensuel
-- Spec: docs/superpowers/specs/2026-05-04-content-trame-planning-design.md
-- Idempotent (safe à re-jouer).

-- ═════════════════════════════════════════════════════════
-- 1. Colonnes additionnelles sur social_posts
-- ═════════════════════════════════════════════════════════

ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS content_kind TEXT;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS production_status TEXT;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS plan_date DATE;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS slot_index INT;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS hook TEXT;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS script TEXT;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS references_urls TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS notes TEXT;

-- CHECK constraints (drop+add idempotent)
ALTER TABLE social_posts DROP CONSTRAINT IF EXISTS social_posts_content_kind_check;
ALTER TABLE social_posts ADD CONSTRAINT social_posts_content_kind_check
  CHECK (content_kind IS NULL OR content_kind IN ('post', 'story', 'reel'));

ALTER TABLE social_posts DROP CONSTRAINT IF EXISTS social_posts_production_status_check;
ALTER TABLE social_posts ADD CONSTRAINT social_posts_production_status_check
  CHECK (production_status IS NULL OR production_status IN ('idea', 'to_film', 'filmed', 'edited', 'ready'));

-- ═════════════════════════════════════════════════════════
-- 2. content_trame
-- ═════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS content_trame (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID UNIQUE NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  stories_grid JSONB NOT NULL DEFAULT '{}'::jsonb,
  posts_grid JSONB NOT NULL DEFAULT '{}'::jsonb,
  stories_per_day INT NOT NULL DEFAULT 5,
  posts_per_day INT NOT NULL DEFAULT 2,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE content_trame ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "content_trame_select" ON content_trame;
DROP POLICY IF EXISTS "content_trame_insert" ON content_trame;
DROP POLICY IF EXISTS "content_trame_update" ON content_trame;
DROP POLICY IF EXISTS "content_trame_delete" ON content_trame;

CREATE POLICY "content_trame_select" ON content_trame FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));
CREATE POLICY "content_trame_insert" ON content_trame FOR INSERT
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));
CREATE POLICY "content_trame_update" ON content_trame FOR UPDATE
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));
CREATE POLICY "content_trame_delete" ON content_trame FOR DELETE
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

DROP TRIGGER IF EXISTS content_trame_updated_at ON content_trame;
CREATE TRIGGER content_trame_updated_at
  BEFORE UPDATE ON content_trame
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ═════════════════════════════════════════════════════════
-- 3. content_trame_generations
-- ═════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS content_trame_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  year INT NOT NULL,
  month INT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  generated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  slots_created INT NOT NULL DEFAULT 0,
  UNIQUE (workspace_id, year, month)
);

ALTER TABLE content_trame_generations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ctg_select" ON content_trame_generations;
DROP POLICY IF EXISTS "ctg_insert" ON content_trame_generations;
DROP POLICY IF EXISTS "ctg_update" ON content_trame_generations;
DROP POLICY IF EXISTS "ctg_delete" ON content_trame_generations;

CREATE POLICY "ctg_select" ON content_trame_generations FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));
CREATE POLICY "ctg_insert" ON content_trame_generations FOR INSERT
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));
CREATE POLICY "ctg_update" ON content_trame_generations FOR UPDATE
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));
CREATE POLICY "ctg_delete" ON content_trame_generations FOR DELETE
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

-- ═════════════════════════════════════════════════════════
-- 4. Index
-- ═════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_social_posts_workspace_plan_date
  ON social_posts(workspace_id, plan_date)
  WHERE plan_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_social_posts_workspace_production
  ON social_posts(workspace_id, production_status)
  WHERE status = 'draft';

-- Index dédupe pour idempotence regénération.
-- COALESCE pour gérer slots avec ou sans pillar_id.
CREATE UNIQUE INDEX IF NOT EXISTS idx_social_posts_trame_slot_dedupe
  ON social_posts(workspace_id, plan_date, content_kind, slot_index, COALESCE(pillar_id::text, ''))
  WHERE plan_date IS NOT NULL AND slot_index IS NOT NULL;

-- ═════════════════════════════════════════════════════════
-- 5. Backfill slots existants
-- ═════════════════════════════════════════════════════════

UPDATE social_posts
SET content_kind = COALESCE(content_kind, 'post'),
    production_status = COALESCE(production_status,
      CASE WHEN status IN ('scheduled', 'published', 'publishing', 'partial') THEN 'ready'
           ELSE 'idea' END),
    plan_date = COALESCE(plan_date, scheduled_at::date)
WHERE content_kind IS NULL OR production_status IS NULL;

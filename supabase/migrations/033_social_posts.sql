-- supabase/migrations/033_social_posts.sql
-- Refactor pour publication multi-plateforme (Instagram + YouTube + TikTok future).
-- Idempotent (safe à re-jouer).

-- ═════════════════════════════════════════════════════════
-- 1. social_posts
-- ═════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS social_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title TEXT,
  caption TEXT,
  hashtags TEXT[] NOT NULL DEFAULT '{}',
  media_urls TEXT[] NOT NULL DEFAULT '{}',
  media_type TEXT,                          -- CHECK défini plus bas pour idempotence
  thumbnail_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  pillar_id UUID,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- CHECK constraints (drop+add pour être idempotent et tolérant aux valeurs legacy)
ALTER TABLE social_posts DROP CONSTRAINT IF EXISTS social_posts_media_type_check;
ALTER TABLE social_posts ADD CONSTRAINT social_posts_media_type_check
  CHECK (media_type IS NULL OR media_type IN ('IMAGE', 'VIDEO', 'CAROUSEL', 'SHORT', 'LONG_VIDEO', 'REEL', 'REELS'));

ALTER TABLE social_posts DROP CONSTRAINT IF EXISTS social_posts_status_check;
ALTER TABLE social_posts ADD CONSTRAINT social_posts_status_check
  CHECK (status IN ('draft', 'scheduled', 'publishing', 'published', 'partial', 'failed'));

CREATE INDEX IF NOT EXISTS idx_social_posts_workspace ON social_posts(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_posts_scheduled ON social_posts(workspace_id, status, scheduled_at)
  WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_social_posts_pillar ON social_posts(pillar_id) WHERE pillar_id IS NOT NULL;

-- ═════════════════════════════════════════════════════════
-- 2. social_post_publications
-- ═════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS social_post_publications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  social_post_id UUID NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  scheduled_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',
  provider_post_id TEXT,
  public_url TEXT,
  published_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INT NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (social_post_id, platform)
);

ALTER TABLE social_post_publications DROP CONSTRAINT IF EXISTS spp_platform_check;
ALTER TABLE social_post_publications ADD CONSTRAINT spp_platform_check
  CHECK (platform IN ('instagram', 'youtube', 'tiktok'));
ALTER TABLE social_post_publications DROP CONSTRAINT IF EXISTS spp_status_check;
ALTER TABLE social_post_publications ADD CONSTRAINT spp_status_check
  CHECK (status IN ('pending', 'publishing', 'published', 'failed', 'skipped'));

CREATE INDEX IF NOT EXISTS idx_spp_social_post ON social_post_publications(social_post_id);
CREATE INDEX IF NOT EXISTS idx_spp_workspace ON social_post_publications(workspace_id);
CREATE INDEX IF NOT EXISTS idx_spp_pending ON social_post_publications(status, scheduled_at)
  WHERE status IN ('pending', 'publishing');
CREATE INDEX IF NOT EXISTS idx_spp_platform_status ON social_post_publications(workspace_id, platform, status);

-- ═════════════════════════════════════════════════════════
-- 3. RLS
-- ═════════════════════════════════════════════════════════
ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_post_publications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "social_posts_select" ON social_posts;
DROP POLICY IF EXISTS "social_posts_insert" ON social_posts;
DROP POLICY IF EXISTS "social_posts_update" ON social_posts;
DROP POLICY IF EXISTS "social_posts_delete" ON social_posts;
CREATE POLICY "social_posts_select" ON social_posts FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));
CREATE POLICY "social_posts_insert" ON social_posts FOR INSERT
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));
CREATE POLICY "social_posts_update" ON social_posts FOR UPDATE
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));
CREATE POLICY "social_posts_delete" ON social_posts FOR DELETE
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "spp_select" ON social_post_publications;
DROP POLICY IF EXISTS "spp_insert" ON social_post_publications;
DROP POLICY IF EXISTS "spp_update" ON social_post_publications;
DROP POLICY IF EXISTS "spp_delete" ON social_post_publications;
CREATE POLICY "spp_select" ON social_post_publications FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));
CREATE POLICY "spp_insert" ON social_post_publications FOR INSERT
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));
CREATE POLICY "spp_update" ON social_post_publications FOR UPDATE
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));
CREATE POLICY "spp_delete" ON social_post_publications FOR DELETE
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

-- ═════════════════════════════════════════════════════════
-- 4. Trigger updated_at
-- ═════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION trg_social_posts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS social_posts_updated_at ON social_posts;
CREATE TRIGGER social_posts_updated_at
  BEFORE UPDATE ON social_posts
  FOR EACH ROW EXECUTE FUNCTION trg_social_posts_updated_at();

DROP TRIGGER IF EXISTS social_post_publications_updated_at ON social_post_publications;
CREATE TRIGGER social_post_publications_updated_at
  BEFORE UPDATE ON social_post_publications
  FOR EACH ROW EXECUTE FUNCTION trg_social_posts_updated_at();

-- ═════════════════════════════════════════════════════════
-- 5. Backfill depuis ig_drafts
-- Les anciens 'REELS'/'REEL' sont normalisés en 'VIDEO'.
-- ═════════════════════════════════════════════════════════
INSERT INTO social_posts (
  id, workspace_id, caption, hashtags, media_urls, media_type,
  status, scheduled_at, published_at,
  created_at, updated_at
)
SELECT
  id, workspace_id, caption, hashtags, media_urls,
  CASE
    WHEN UPPER(media_type) IN ('REEL', 'REELS') THEN 'VIDEO'
    WHEN media_type IN ('IMAGE', 'VIDEO', 'CAROUSEL', 'SHORT', 'LONG_VIDEO') THEN media_type
    ELSE NULL
  END,
  status, scheduled_at, published_at,
  created_at, updated_at
FROM ig_drafts
ON CONFLICT (id) DO NOTHING;

INSERT INTO social_post_publications (
  social_post_id, workspace_id, platform, config,
  scheduled_at, status, provider_post_id, published_at,
  error_message, created_at, updated_at
)
SELECT
  d.id,
  d.workspace_id,
  'instagram',
  jsonb_build_object(
    'caption', d.caption,
    'hashtags', d.hashtags,
    'ig_account_id', d.ig_account_id,
    'legacy_media_type', d.media_type
  ),
  d.scheduled_at,
  CASE d.status
    WHEN 'draft'      THEN 'pending'
    WHEN 'scheduled'  THEN 'pending'
    WHEN 'publishing' THEN 'publishing'
    WHEN 'published'  THEN 'published'
    WHEN 'failed'     THEN 'failed'
    ELSE 'pending'
  END,
  d.ig_media_id,
  d.published_at,
  d.error_message,
  d.created_at,
  d.updated_at
FROM ig_drafts d
ON CONFLICT (social_post_id, platform) DO NOTHING;

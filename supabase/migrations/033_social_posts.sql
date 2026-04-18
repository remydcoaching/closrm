-- supabase/migrations/033_social_posts.sql
-- Refactor pour publication multi-plateforme (Instagram + YouTube + TikTok future).
-- Les drafts Instagram existants (ig_drafts) sont migrés en social_posts + social_post_publications.
-- ig_drafts reste en DB en mode "read-only legacy" pour un sprint puis sera supprimé.

-- ═════════════════════════════════════════════════════════
-- 1. social_posts (post unifié, plateforme-agnostique)
-- ═════════════════════════════════════════════════════════
CREATE TABLE social_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Contenu commun
  title TEXT,                              -- titre principal (utilisé pour YouTube, ignoré pour IG)
  caption TEXT,                            -- légende/description
  hashtags TEXT[] NOT NULL DEFAULT '{}',
  media_urls TEXT[] NOT NULL DEFAULT '{}', -- URLs Supabase Storage (content-drafts bucket)
  media_type TEXT CHECK (media_type IN ('IMAGE', 'VIDEO', 'CAROUSEL', 'SHORT', 'LONG_VIDEO')),
  thumbnail_url TEXT,                      -- thumbnail custom (surtout utile YouTube)

  -- État global
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'scheduled', 'publishing', 'published', 'partial', 'failed'
  )),
  scheduled_at TIMESTAMPTZ,                -- si NULL = brouillon; sinon horaire de publication
  published_at TIMESTAMPTZ,                -- rempli quand TOUTES les publications sont published

  -- Metadata
  pillar_id UUID,                          -- référence à content_pillars (tâche 035 renommera ig_content_pillars)
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_social_posts_workspace ON social_posts(workspace_id, created_at DESC);
CREATE INDEX idx_social_posts_scheduled ON social_posts(workspace_id, status, scheduled_at)
  WHERE status = 'scheduled';
CREATE INDEX idx_social_posts_pillar ON social_posts(pillar_id) WHERE pillar_id IS NOT NULL;

-- ═════════════════════════════════════════════════════════
-- 2. social_post_publications (1 ligne par post × plateforme)
-- ═════════════════════════════════════════════════════════
CREATE TABLE social_post_publications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  social_post_id UUID NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'youtube', 'tiktok')),

  -- Overrides per-plateforme (caption spécifique, hashtags différents, titre YouTube, etc.)
  -- Exemples attendus:
  --   IG: { caption, hashtags }
  --   YT: { title, description, tags, category_id, privacy_status, made_for_kids }
  --   TikTok: { caption, privacy_level, disable_comments, disable_duet, disable_stitch }
  config JSONB NOT NULL DEFAULT '{}',

  -- Horaire de publication (si différent de social_posts.scheduled_at)
  scheduled_at TIMESTAMPTZ,

  -- État de publication
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'publishing', 'published', 'failed', 'skipped'
  )),
  provider_post_id TEXT,                   -- ig_media_id, youtube videoId, tiktok post_id
  public_url TEXT,                         -- URL publique du post après publication
  published_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INT NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (social_post_id, platform)
);

CREATE INDEX idx_spp_social_post ON social_post_publications(social_post_id);
CREATE INDEX idx_spp_workspace ON social_post_publications(workspace_id);
CREATE INDEX idx_spp_pending ON social_post_publications(status, scheduled_at)
  WHERE status IN ('pending', 'publishing');
CREATE INDEX idx_spp_platform_status ON social_post_publications(workspace_id, platform, status);

-- ═════════════════════════════════════════════════════════
-- 3. RLS
-- ═════════════════════════════════════════════════════════
ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_post_publications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "social_posts_select" ON social_posts FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "social_posts_insert" ON social_posts FOR INSERT
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "social_posts_update" ON social_posts FOR UPDATE
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "social_posts_delete" ON social_posts FOR DELETE
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "spp_select" ON social_post_publications FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "spp_insert" ON social_post_publications FOR INSERT
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "spp_update" ON social_post_publications FOR UPDATE
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "spp_delete" ON social_post_publications FOR DELETE
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

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

CREATE TRIGGER social_posts_updated_at
  BEFORE UPDATE ON social_posts
  FOR EACH ROW EXECUTE FUNCTION trg_social_posts_updated_at();

CREATE TRIGGER social_post_publications_updated_at
  BEFORE UPDATE ON social_post_publications
  FOR EACH ROW EXECUTE FUNCTION trg_social_posts_updated_at();

-- ═════════════════════════════════════════════════════════
-- 5. Backfill depuis ig_drafts
-- ═════════════════════════════════════════════════════════
-- Stratégie : copier chaque ig_drafts → 1 social_posts + 1 social_post_publications (platform='instagram')
-- L'id du social_posts reprend l'id du ig_drafts pour cohérence.
INSERT INTO social_posts (
  id, workspace_id, caption, hashtags, media_urls, media_type,
  status, scheduled_at, published_at,
  created_at, updated_at
)
SELECT
  id, workspace_id, caption, hashtags, media_urls, media_type,
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
    'ig_account_id', d.ig_account_id
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

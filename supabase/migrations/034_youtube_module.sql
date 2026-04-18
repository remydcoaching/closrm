-- supabase/migrations/034_youtube_module.sql
-- Module YouTube: OAuth via integrations (type='youtube'), channel+videos+analytics.

-- ═════════════════════════════════════════════════════════
-- 1. Autoriser 'youtube' dans integrations.type
-- ═════════════════════════════════════════════════════════
ALTER TABLE integrations DROP CONSTRAINT IF EXISTS integrations_type_check;
ALTER TABLE integrations ADD CONSTRAINT integrations_type_check
  CHECK (type IN ('google_calendar', 'meta', 'whatsapp', 'stripe', 'telegram', 'youtube'));

-- ═════════════════════════════════════════════════════════
-- 2. yt_accounts (1 channel YouTube par workspace en V1)
-- ═════════════════════════════════════════════════════════
CREATE TABLE yt_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL,
  channel_title TEXT,
  channel_handle TEXT,                   -- @handle sans le @
  channel_description TEXT,
  thumbnail_url TEXT,
  country TEXT,
  -- Baselines au moment de la connexion
  subscribers_baseline INT,
  total_views_baseline BIGINT,
  videos_count_baseline INT,
  -- Sync tracking
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id)                  -- V1: 1 channel / workspace
);
CREATE INDEX idx_yt_accounts_workspace ON yt_accounts(workspace_id);

-- ═════════════════════════════════════════════════════════
-- 3. yt_videos (vidéos publiées, shorts + long)
-- ═════════════════════════════════════════════════════════
CREATE TABLE yt_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  yt_account_id UUID NOT NULL REFERENCES yt_accounts(id) ON DELETE CASCADE,
  yt_video_id TEXT NOT NULL,

  title TEXT,
  description TEXT,
  tags TEXT[] DEFAULT '{}',
  category_id TEXT,                      -- id catégorie YouTube (ex: "22" = People)
  published_at TIMESTAMPTZ,
  duration_seconds INT,
  format TEXT CHECK (format IN ('short', 'long')),  -- short = <60s vertical
  thumbnail_url TEXT,
  video_url TEXT,                        -- URL publique
  privacy_status TEXT CHECK (privacy_status IN ('public', 'unlisted', 'private')),

  -- Stats lifetime (rafraichies par sync)
  views BIGINT DEFAULT 0,
  likes BIGINT DEFAULT 0,
  comments BIGINT DEFAULT 0,
  shares BIGINT DEFAULT 0,
  watch_time_minutes BIGINT DEFAULT 0,
  average_view_duration_sec INT DEFAULT 0,
  average_view_percentage NUMERIC(5,2) DEFAULT 0,

  -- Monétisation (si dispo)
  estimated_revenue NUMERIC(12,2),
  cpm NUMERIC(8,2),
  monetized_playbacks BIGINT,

  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, yt_video_id)
);
CREATE INDEX idx_yt_videos_workspace ON yt_videos(workspace_id, published_at DESC);
CREATE INDEX idx_yt_videos_account ON yt_videos(yt_account_id);
CREATE INDEX idx_yt_videos_format ON yt_videos(workspace_id, format);

-- ═════════════════════════════════════════════════════════
-- 4. yt_video_daily_stats (historique jour/jour par vidéo)
-- ═════════════════════════════════════════════════════════
CREATE TABLE yt_video_daily_stats (
  yt_video_id UUID NOT NULL REFERENCES yt_videos(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  views BIGINT DEFAULT 0,
  watch_time_minutes BIGINT DEFAULT 0,
  likes INT DEFAULT 0,
  comments INT DEFAULT 0,
  shares INT DEFAULT 0,
  subscribers_gained INT DEFAULT 0,
  subscribers_lost INT DEFAULT 0,
  estimated_revenue NUMERIC(12,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (yt_video_id, date)
);

-- ═════════════════════════════════════════════════════════
-- 5. yt_traffic_sources (d'où viennent les vues)
-- ═════════════════════════════════════════════════════════
CREATE TABLE yt_traffic_sources (
  yt_video_id UUID NOT NULL REFERENCES yt_videos(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  source_type TEXT NOT NULL,             -- BROWSE, SEARCH, SUGGESTED, EXTERNAL, PLAYLIST, NOTIFICATION, CHANNEL, etc.
  views BIGINT DEFAULT 0,
  watch_time_minutes BIGINT DEFAULT 0,
  PRIMARY KEY (yt_video_id, date, source_type)
);

-- ═════════════════════════════════════════════════════════
-- 6. yt_demographics (démographie viewers par vidéo)
-- ═════════════════════════════════════════════════════════
CREATE TABLE yt_demographics (
  yt_video_id UUID NOT NULL REFERENCES yt_videos(id) ON DELETE CASCADE,
  age_group TEXT NOT NULL,               -- age13-17, age18-24, ...
  gender TEXT NOT NULL,                  -- male, female, user_specified, unknown
  viewer_percentage NUMERIC(5,2),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (yt_video_id, age_group, gender)
);

-- ═════════════════════════════════════════════════════════
-- 7. yt_snapshots (KPIs quotidiens au niveau channel)
-- ═════════════════════════════════════════════════════════
CREATE TABLE yt_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  yt_account_id UUID NOT NULL REFERENCES yt_accounts(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  subscribers INT DEFAULT 0,
  total_views BIGINT DEFAULT 0,
  total_watch_time_minutes BIGINT DEFAULT 0,
  videos_count INT DEFAULT 0,
  subscribers_gained_30d INT,
  views_30d BIGINT,
  watch_time_minutes_30d BIGINT,
  estimated_revenue_30d NUMERIC(12,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, date)
);
CREATE INDEX idx_yt_snapshots_workspace ON yt_snapshots(workspace_id, date DESC);

-- ═════════════════════════════════════════════════════════
-- 8. yt_comments (commentaires vidéos + réponses)
-- ═════════════════════════════════════════════════════════
CREATE TABLE yt_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  yt_video_id UUID NOT NULL REFERENCES yt_videos(id) ON DELETE CASCADE,
  yt_comment_id TEXT NOT NULL,
  parent_id UUID REFERENCES yt_comments(id) ON DELETE CASCADE,  -- pour threading
  author_name TEXT,
  author_channel_id TEXT,
  author_avatar_url TEXT,
  text TEXT,
  like_count INT DEFAULT 0,
  is_hidden BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, yt_comment_id)
);
CREATE INDEX idx_yt_comments_video ON yt_comments(yt_video_id, published_at DESC);
CREATE INDEX idx_yt_comments_parent ON yt_comments(parent_id) WHERE parent_id IS NOT NULL;

-- ═════════════════════════════════════════════════════════
-- 9. RLS (workspace_members)
-- ═════════════════════════════════════════════════════════
ALTER TABLE yt_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE yt_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE yt_video_daily_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE yt_traffic_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE yt_demographics ENABLE ROW LEVEL SECURITY;
ALTER TABLE yt_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE yt_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "yt_accounts_workspace" ON yt_accounts FOR ALL
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));
CREATE POLICY "yt_videos_workspace" ON yt_videos FOR ALL
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));
CREATE POLICY "yt_video_daily_stats_workspace" ON yt_video_daily_stats FOR ALL
  USING (yt_video_id IN (
    SELECT id FROM yt_videos
    WHERE workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
  ));
CREATE POLICY "yt_traffic_sources_workspace" ON yt_traffic_sources FOR ALL
  USING (yt_video_id IN (
    SELECT id FROM yt_videos
    WHERE workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
  ));
CREATE POLICY "yt_demographics_workspace" ON yt_demographics FOR ALL
  USING (yt_video_id IN (
    SELECT id FROM yt_videos
    WHERE workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
  ));
CREATE POLICY "yt_snapshots_workspace" ON yt_snapshots FOR ALL
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));
CREATE POLICY "yt_comments_workspace" ON yt_comments FOR ALL
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

-- ═════════════════════════════════════════════════════════
-- 10. Triggers updated_at
-- ═════════════════════════════════════════════════════════
CREATE TRIGGER yt_accounts_updated_at
  BEFORE UPDATE ON yt_accounts
  FOR EACH ROW EXECUTE FUNCTION trg_social_posts_updated_at();

CREATE TRIGGER yt_videos_updated_at
  BEFORE UPDATE ON yt_videos
  FOR EACH ROW EXECUTE FUNCTION trg_social_posts_updated_at();

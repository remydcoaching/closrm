-- ============================================================================
-- Migration 009: Instagram social module
-- ============================================================================

-- 1. ig_accounts
CREATE TABLE ig_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  ig_user_id TEXT NOT NULL,
  ig_username TEXT,
  access_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ,
  page_id TEXT,
  page_access_token TEXT,
  is_connected BOOLEAN DEFAULT true,
  starting_followers INTEGER DEFAULT 0,
  starting_date DATE,
  starting_monthly_views BIGINT DEFAULT 0,
  starting_engagement NUMERIC DEFAULT 0,
  starting_best_reel BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ig_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ig_accounts_workspace" ON ig_accounts
  FOR ALL USING (
    workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid())
  );
CREATE UNIQUE INDEX ig_accounts_workspace_unique ON ig_accounts(workspace_id);

-- 2. ig_content_pillars (must come before ig_reels FK)
CREATE TABLE ig_content_pillars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ig_content_pillars ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ig_content_pillars_workspace" ON ig_content_pillars
  FOR ALL USING (
    workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid())
  );

-- 3. ig_stories
CREATE TABLE ig_stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  ig_story_id TEXT NOT NULL UNIQUE,
  ig_media_url TEXT,
  thumbnail_url TEXT,
  caption TEXT,
  story_type TEXT CHECK (story_type IN ('video', 'image')),
  impressions INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  replies INTEGER DEFAULT 0,
  exits INTEGER DEFAULT 0,
  taps_forward INTEGER DEFAULT 0,
  taps_back INTEGER DEFAULT 0,
  published_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
);

ALTER TABLE ig_stories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ig_stories_workspace" ON ig_stories
  FOR ALL USING (
    workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid())
  );
CREATE INDEX ig_stories_published ON ig_stories(workspace_id, published_at DESC);

-- 4. story_sequences
CREATE TABLE story_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sequence_type TEXT NOT NULL CHECK (sequence_type IN (
    'confiance', 'peur', 'preuve_sociale', 'urgence',
    'autorite', 'storytelling', 'offre', 'education'
  )),
  objective TEXT,
  notes TEXT,
  status TEXT DEFAULT 'draft',
  total_impressions INTEGER DEFAULT 0,
  overall_dropoff_rate NUMERIC DEFAULT 0,
  total_replies INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  published_at TIMESTAMPTZ
);

ALTER TABLE story_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "story_sequences_workspace" ON story_sequences
  FOR ALL USING (
    workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid())
  );

-- 5. story_sequence_items
CREATE TABLE story_sequence_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID NOT NULL REFERENCES story_sequences(id) ON DELETE CASCADE,
  story_id UUID NOT NULL REFERENCES ig_stories(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  impressions INTEGER DEFAULT 0,
  replies INTEGER DEFAULT 0,
  exits INTEGER DEFAULT 0
);

ALTER TABLE story_sequence_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "story_sequence_items_workspace" ON story_sequence_items
  FOR ALL USING (
    sequence_id IN (SELECT id FROM story_sequences WHERE workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    ))
  );
CREATE INDEX story_sequence_items_seq ON story_sequence_items(sequence_id, position);

-- 6. ig_reels
CREATE TABLE ig_reels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  ig_media_id TEXT NOT NULL UNIQUE,
  caption TEXT,
  thumbnail_url TEXT,
  video_url TEXT,
  views BIGINT DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  saves INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  plays INTEGER DEFAULT 0,
  engagement_rate NUMERIC DEFAULT 0,
  format TEXT CHECK (format IN ('talking_head', 'text_overlay', 'raw_documentary')),
  pillar_id UUID REFERENCES ig_content_pillars(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ
);

ALTER TABLE ig_reels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ig_reels_workspace" ON ig_reels
  FOR ALL USING (
    workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid())
  );
CREATE INDEX ig_reels_published ON ig_reels(workspace_id, published_at DESC);

-- 7. ig_drafts
CREATE TABLE ig_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  ig_account_id UUID REFERENCES ig_accounts(id) ON DELETE SET NULL,
  caption TEXT,
  hashtags TEXT[] DEFAULT '{}',
  media_urls TEXT[] DEFAULT '{}',
  media_type TEXT CHECK (media_type IN ('IMAGE', 'VIDEO', 'CAROUSEL')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'scheduled', 'publishing', 'published', 'failed'
  )),
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  ig_media_id TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ig_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ig_drafts_workspace" ON ig_drafts
  FOR ALL USING (
    workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid())
  );
CREATE INDEX ig_drafts_status ON ig_drafts(workspace_id, status);
CREATE INDEX ig_drafts_scheduled ON ig_drafts(workspace_id, scheduled_at)
  WHERE status = 'scheduled';

-- 8. ig_hashtag_groups
CREATE TABLE ig_hashtag_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  hashtags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ig_hashtag_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ig_hashtag_groups_workspace" ON ig_hashtag_groups
  FOR ALL USING (
    workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid())
  );

-- 9. ig_caption_templates
CREATE TABLE ig_caption_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  category TEXT DEFAULT 'general' CHECK (category IN (
    'general', 'education', 'storytelling', 'offre',
    'preuve_sociale', 'motivation', 'behind_the_scenes'
  )),
  hashtags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ig_caption_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ig_caption_templates_workspace" ON ig_caption_templates
  FOR ALL USING (
    workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid())
  );

-- 10. ig_snapshots
CREATE TABLE ig_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  followers INTEGER DEFAULT 0,
  total_views BIGINT DEFAULT 0,
  total_reach BIGINT DEFAULT 0,
  new_followers INTEGER DEFAULT 0,
  UNIQUE(workspace_id, snapshot_date)
);

ALTER TABLE ig_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ig_snapshots_workspace" ON ig_snapshots
  FOR ALL USING (
    workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid())
  );

-- 11. ig_goals
CREATE TABLE ig_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  quarter TEXT NOT NULL,
  metric TEXT NOT NULL,
  target_value NUMERIC NOT NULL DEFAULT 0,
  UNIQUE(workspace_id, quarter, metric)
);

ALTER TABLE ig_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ig_goals_workspace" ON ig_goals
  FOR ALL USING (
    workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid())
  );

-- 12. ig_conversations
CREATE TABLE ig_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  ig_conversation_id TEXT NOT NULL UNIQUE,
  participant_ig_id TEXT,
  participant_username TEXT,
  participant_name TEXT,
  participant_avatar_url TEXT,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  last_message_text TEXT,
  last_message_at TIMESTAMPTZ,
  unread_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ig_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ig_conversations_workspace" ON ig_conversations
  FOR ALL USING (
    workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid())
  );
CREATE INDEX ig_conversations_last_msg ON ig_conversations(workspace_id, last_message_at DESC);

-- 13. ig_messages
CREATE TABLE ig_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES ig_conversations(id) ON DELETE CASCADE,
  ig_message_id TEXT UNIQUE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('user', 'participant')),
  text TEXT,
  media_url TEXT,
  media_type TEXT CHECK (media_type IN ('image', 'video', 'audio', 'sticker')),
  sent_at TIMESTAMPTZ DEFAULT now(),
  is_read BOOLEAN DEFAULT false
);

ALTER TABLE ig_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ig_messages_workspace" ON ig_messages
  FOR ALL USING (
    workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid())
  );
CREATE INDEX ig_messages_conversation ON ig_messages(conversation_id, sent_at ASC);

-- Storage bucket for content drafts media
INSERT INTO storage.buckets (id, name, public) VALUES ('content-drafts', 'content-drafts', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "content_drafts_upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'content-drafts' AND auth.uid() IS NOT NULL);
CREATE POLICY "content_drafts_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'content-drafts');
CREATE POLICY "content_drafts_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'content-drafts' AND auth.uid() IS NOT NULL);

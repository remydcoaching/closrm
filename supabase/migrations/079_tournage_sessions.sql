CREATE TABLE IF NOT EXISTS tournage_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT,
  scheduled_date DATE,
  status TEXT NOT NULL DEFAULT 'draft',
  monteur_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  brief_sent_at TIMESTAMPTZ,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE tournage_sessions DROP CONSTRAINT IF EXISTS tournage_sessions_status_check;
ALTER TABLE tournage_sessions ADD CONSTRAINT tournage_sessions_status_check
  CHECK (status IN ('draft', 'ready', 'in_progress', 'completed', 'archived'));

CREATE INDEX IF NOT EXISTS idx_tournage_sessions_workspace
  ON tournage_sessions(workspace_id, scheduled_date DESC);

CREATE TABLE IF NOT EXISTS tournage_session_reels (
  session_id UUID NOT NULL REFERENCES tournage_sessions(id) ON DELETE CASCADE,
  social_post_id UUID NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  position INT NOT NULL DEFAULT 0,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (session_id, social_post_id)
);

CREATE INDEX IF NOT EXISTS idx_tsr_session ON tournage_session_reels(session_id, position);
CREATE INDEX IF NOT EXISTS idx_tsr_post ON tournage_session_reels(social_post_id);

ALTER TABLE tournage_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournage_session_reels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tournage_sessions_select" ON tournage_sessions;
DROP POLICY IF EXISTS "tournage_sessions_insert" ON tournage_sessions;
DROP POLICY IF EXISTS "tournage_sessions_update" ON tournage_sessions;
DROP POLICY IF EXISTS "tournage_sessions_delete" ON tournage_sessions;

CREATE POLICY "tournage_sessions_select" ON tournage_sessions FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));
CREATE POLICY "tournage_sessions_insert" ON tournage_sessions FOR INSERT
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));
CREATE POLICY "tournage_sessions_update" ON tournage_sessions FOR UPDATE
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));
CREATE POLICY "tournage_sessions_delete" ON tournage_sessions FOR DELETE
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "tournage_session_reels_select" ON tournage_session_reels;
DROP POLICY IF EXISTS "tournage_session_reels_insert" ON tournage_session_reels;
DROP POLICY IF EXISTS "tournage_session_reels_delete" ON tournage_session_reels;

CREATE POLICY "tournage_session_reels_select" ON tournage_session_reels FOR SELECT
  USING (session_id IN (SELECT id FROM tournage_sessions WHERE workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())));
CREATE POLICY "tournage_session_reels_insert" ON tournage_session_reels FOR INSERT
  WITH CHECK (session_id IN (SELECT id FROM tournage_sessions WHERE workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())));
CREATE POLICY "tournage_session_reels_delete" ON tournage_session_reels FOR DELETE
  USING (session_id IN (SELECT id FROM tournage_sessions WHERE workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())));

DROP TRIGGER IF EXISTS tournage_sessions_updated_at ON tournage_sessions;
CREATE TRIGGER tournage_sessions_updated_at
  BEFORE UPDATE ON tournage_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

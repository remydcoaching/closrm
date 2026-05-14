ALTER TABLE reel_shots ADD COLUMN IF NOT EXISTS done_at TIMESTAMPTZ;
ALTER TABLE reel_shots ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

UPDATE reel_shots SET done_at = updated_at WHERE done = true AND done_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_reel_shots_workspace_done_at
  ON reel_shots(workspace_id, done_at DESC)
  WHERE done = true AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_reel_shots_workspace_active
  ON reel_shots(workspace_id, social_post_id, position)
  WHERE deleted_at IS NULL;

-- -----------------------------------------------------------------
-- 078 -- Table notification_preferences (opt-out par type de push)
--
-- Par défaut tout est activé (absence de row = enabled). Une row
-- avec enabled=false désactive ce type de push pour ce user.
-- -----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id, type)
);

CREATE INDEX IF NOT EXISTS notif_prefs_user_idx
  ON notification_preferences (user_id, workspace_id);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notif_prefs_self_only" ON notification_preferences;
CREATE POLICY "notif_prefs_self_only" ON notification_preferences
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

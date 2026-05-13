-- ─────────────────────────────────────────────────────────────────────
-- 077 — Table push_tokens (multi-device par user)
--
-- Stocke les Expo push tokens pour envoyer des push à l'app mobile.
-- Multi-device : un user peut avoir un iPhone + iPad → plusieurs tokens.
-- L'unicité du token (Expo le rend unique par device+app) garantit pas
-- de doublons. Quand un device revient avec un token différent (réinstall,
-- restore), on insert ; les vieux tokens deviennent stale et seront
-- supprimés au prochain envoi qui retournera DeviceNotRegistered.
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Token brut Expo, ex: "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"
  token TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  device_name TEXT,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_tokens_user_idx ON push_tokens (user_id);
CREATE INDEX IF NOT EXISTS push_tokens_workspace_idx ON push_tokens (workspace_id);

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push_tokens_self_only" ON push_tokens;
CREATE POLICY "push_tokens_self_only" ON push_tokens
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Auto-update last_seen_at on UPSERT
CREATE OR REPLACE FUNCTION push_tokens_touch_last_seen()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.last_seen_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS push_tokens_touch_last_seen_trg ON push_tokens;
CREATE TRIGGER push_tokens_touch_last_seen_trg
  BEFORE UPDATE ON push_tokens
  FOR EACH ROW EXECUTE FUNCTION push_tokens_touch_last_seen();

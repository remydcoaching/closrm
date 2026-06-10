-- ─────────────────────────────────────────────────────────────────────
-- 076 — Table notifications (mobile feed d'activité + push)
--
-- Mirroir UI des événements importants pour l'app mobile : nouveau lead,
-- no-show, deal closé, nouveau DM, rappel call, booking. Insertés par
-- des triggers/jobs côté serveur (à brancher au fil des features) et
-- consommés par mobile/src/hooks/useNotifications.ts via subscription
-- temps réel + par le système push.
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  -- type cf shared/types AppNotificationType
  type TEXT NOT NULL CHECK (type IN (
    'new_lead', 'no_show', 'deal_closed', 'dm_reply', 'call_reminder', 'booking'
  )),
  title TEXT NOT NULL,
  subtitle TEXT,
  -- Pour deep-link depuis push tap
  entity_type TEXT CHECK (entity_type IN ('lead', 'call', 'deal', 'conversation')),
  entity_id UUID,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_workspace_created_idx
  ON notifications (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_workspace_unread_idx
  ON notifications (workspace_id, read) WHERE read = false;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_workspace_isolation" ON notifications;
CREATE POLICY "notifications_workspace_isolation" ON notifications
  FOR ALL
  USING (
    workspace_id = (SELECT workspace_id FROM users WHERE id = auth.uid())
  )
  WITH CHECK (
    workspace_id = (SELECT workspace_id FROM users WHERE id = auth.uid())
  );

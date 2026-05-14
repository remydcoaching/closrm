-- ═════════════════════════════════════════════════════════════════════
-- 072 — Annotations resolution status (Frame.io style)
--
-- Permet de marquer une annotation video comme "resolue" (corrige dans
-- une nouvelle version du montage). L'annotation reste visible mais
-- est visuellement distincte (grise/barre) et exclue par defaut des
-- markers actifs.
--
-- - resolved_at : NULL = active. Timestamp = resolue a ce moment.
-- - resolved_by : qui a marque comme resolu (FK auth.users).
-- ═════════════════════════════════════════════════════════════════════

ALTER TABLE social_post_messages
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Index pour requeter rapidement les annotations non resolues d'un slot
CREATE INDEX IF NOT EXISTS idx_slot_msg_unresolved
  ON social_post_messages(social_post_id)
  WHERE video_timestamp_seconds IS NOT NULL AND resolved_at IS NULL;

-- Policy UPDATE : tout membre actif du workspace ayant acces au slot peut
-- toggle le statut resolved. Le UI ne permet de modifier que resolved_at /
-- resolved_by — l'API valide explicitement les champs autorises.
DROP POLICY IF EXISTS "slot_msg_update" ON social_post_messages;
CREATE POLICY "slot_msg_update" ON social_post_messages FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

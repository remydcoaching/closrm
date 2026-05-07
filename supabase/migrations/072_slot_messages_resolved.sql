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

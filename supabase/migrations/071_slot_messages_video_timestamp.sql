-- ═════════════════════════════════════════════════════════════════════
-- 071 — Annotations video timestamped (Frame.io style)
--
-- Ajoute video_timestamp_seconds a social_post_messages :
--   - NULL = commentaire general (comportement existant inchange)
--   - REAL >= 0 = annotation ancree a un moment precis de la video du slot
--
-- Le client (player video) affiche des markers sur la timeline pour
-- chaque message avec timestamp non-null. Click marker → seek + scroll
-- vers le message dans la liste de discussion.
-- ═════════════════════════════════════════════════════════════════════

ALTER TABLE social_post_messages
  ADD COLUMN IF NOT EXISTS video_timestamp_seconds REAL;

ALTER TABLE social_post_messages
  ADD CONSTRAINT slot_msg_video_ts_positive
  CHECK (video_timestamp_seconds IS NULL OR video_timestamp_seconds >= 0);

-- Index pour requeter rapidement les annotations d'un slot
CREATE INDEX IF NOT EXISTS idx_slot_msg_video_ts
  ON social_post_messages(social_post_id, video_timestamp_seconds)
  WHERE video_timestamp_seconds IS NOT NULL;

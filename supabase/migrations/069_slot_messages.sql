-- ═════════════════════════════════════════════════════════════════════
-- 069 — Mini chat par slot (coach <-> monteur)
--
-- Chaque slot social_posts a son propre fil de discussion. Permet au
-- coach et au monteur d'echanger sans sortir de la fiche.
--
-- Tables :
--   social_post_messages — un message par ligne
--   social_post_message_reads — derniere fois qu'un user a "vu" le fil
--                               d'un slot (pour calculer le compteur de
--                               non-lus a afficher en badge sur la card).
-- ═════════════════════════════════════════════════════════════════════

-- ─── social_post_messages ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS social_post_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  social_post_id  uuid NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  author_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body            text NOT NULL CHECK (length(body) > 0 AND length(body) <= 4000),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_slot_msg_post_created
  ON social_post_messages(social_post_id, created_at);
CREATE INDEX IF NOT EXISTS idx_slot_msg_workspace
  ON social_post_messages(workspace_id);

ALTER TABLE social_post_messages ENABLE ROW LEVEL SECURITY;

-- Tout membre actif du workspace qui a deja le droit de voir le slot
-- peut voir les messages du slot. On reutilise la meme logique que
-- social_posts_select (cf. 068) pour rester coherent.
DROP POLICY IF EXISTS "slot_msg_select" ON social_post_messages;
CREATE POLICY "slot_msg_select" ON social_post_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM social_posts sp
      WHERE sp.id = social_post_messages.social_post_id
        -- la policy RLS de social_posts s'applique automatiquement ici
    )
  );

-- N'importe quel membre actif du workspace ayant acces au slot peut poster.
-- L'author_id doit etre l'utilisateur courant.
DROP POLICY IF EXISTS "slot_msg_insert" ON social_post_messages;
CREATE POLICY "slot_msg_insert" ON social_post_messages FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
    AND EXISTS (
      SELECT 1 FROM social_posts sp
      WHERE sp.id = social_post_messages.social_post_id
        AND sp.workspace_id = social_post_messages.workspace_id
    )
  );

-- L'auteur peut supprimer son propre message (sinon read-only).
DROP POLICY IF EXISTS "slot_msg_delete" ON social_post_messages;
CREATE POLICY "slot_msg_delete" ON social_post_messages FOR DELETE
  USING (author_id = auth.uid());

-- ─── social_post_message_reads ──────────────────────────────────────
-- last_read_at marque la derniere fois que <user> a ouvert le chat
-- pour ce slot. Sert a compter les messages non-lus :
--   unread = COUNT(messages WHERE created_at > last_read_at AND author_id != user)
CREATE TABLE IF NOT EXISTS social_post_message_reads (
  social_post_id  uuid NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_read_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (social_post_id, user_id)
);

ALTER TABLE social_post_message_reads ENABLE ROW LEVEL SECURITY;

-- Chaque user gere ses propres lignes de read tracking
DROP POLICY IF EXISTS "slot_msg_reads_select" ON social_post_message_reads;
CREATE POLICY "slot_msg_reads_select" ON social_post_message_reads FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "slot_msg_reads_upsert" ON social_post_message_reads;
CREATE POLICY "slot_msg_reads_upsert" ON social_post_message_reads FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "slot_msg_reads_update" ON social_post_message_reads;
CREATE POLICY "slot_msg_reads_update" ON social_post_message_reads FOR UPDATE
  USING (user_id = auth.uid());

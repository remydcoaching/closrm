-- ============================================================================
-- Migration 044: Email Messaging (inbound + threading)
-- Tables email_conversations + email_messages, miroir du module Instagram.
-- Permet de recevoir les réponses des leads et d'y répondre depuis le CRM.
-- ============================================================================

-- ─── Email Conversations ────────────────────────────────────────────────────
CREATE TABLE email_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Participant externe (le lead ou prospect)
  participant_email TEXT NOT NULL,
  participant_name TEXT,

  -- Lien vers le lead (null si on ne l'a pas encore matché)
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,

  -- Sujet du thread (= subject du premier message, sans "Re:")
  subject TEXT,

  -- Thread identification : Message-ID du premier email
  -- Sert à rattacher les futures réponses via In-Reply-To / References
  root_message_id TEXT,

  -- Métadonnées display
  last_message_text TEXT,
  last_message_at TIMESTAMPTZ,
  last_message_from TEXT CHECK (last_message_from IN ('user','participant')),
  unread_count INT NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Un workspace ne peut pas avoir deux threads ouverts pour le même email +
  -- même sujet racine (évite doublons si le parsing des headers échoue).
  UNIQUE(workspace_id, participant_email, root_message_id)
);

CREATE INDEX idx_email_conv_workspace_last
  ON email_conversations(workspace_id, last_message_at DESC NULLS LAST);
CREATE INDEX idx_email_conv_lead
  ON email_conversations(lead_id) WHERE lead_id IS NOT NULL;
CREATE INDEX idx_email_conv_participant
  ON email_conversations(workspace_id, participant_email);

ALTER TABLE email_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_conv_workspace" ON email_conversations
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- ─── Email Messages ─────────────────────────────────────────────────────────
CREATE TABLE email_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES email_conversations(id) ON DELETE CASCADE,

  -- SES / Message-ID unique (sert aussi à l'idempotence inbound)
  ses_message_id TEXT UNIQUE,

  -- Message-ID RFC 5322 de l'email (pour threading)
  message_id_header TEXT,
  in_reply_to TEXT,
  references_header TEXT,

  -- Direction
  sender_type TEXT NOT NULL CHECK (sender_type IN ('user','participant')),

  -- Addresses
  from_email TEXT NOT NULL,
  from_name TEXT,
  to_email TEXT NOT NULL,

  -- Contenu
  subject TEXT,
  body_text TEXT,
  body_html TEXT,

  -- Pièces jointes : tableau de { filename, content_type, size, storage_path }
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,

  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_read BOOLEAN NOT NULL DEFAULT false,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_msg_conversation
  ON email_messages(conversation_id, sent_at ASC);
CREATE INDEX idx_email_msg_workspace
  ON email_messages(workspace_id, created_at DESC);
CREATE INDEX idx_email_msg_message_id
  ON email_messages(message_id_header) WHERE message_id_header IS NOT NULL;

ALTER TABLE email_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_msg_workspace" ON email_messages
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

COMMENT ON TABLE email_conversations IS 'Threads email entre le coach et ses leads/prospects. Un thread = un participant + un sujet racine.';
COMMENT ON TABLE email_messages IS 'Messages d''un thread email. sender_type=user (envoyé depuis ClosRM) ou participant (reçu du lead).';

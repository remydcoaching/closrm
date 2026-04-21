-- Liste de suppression SES : adresses qui ont hard-bounced ou complained.
-- AWS exige qu'on n'envoie plus jamais à ces adresses, sinon suspension du compte.
-- Deux niveaux de scope :
--   - workspace_id NULL → suppression globale (ex: opt-out général)
--   - workspace_id défini → suppression locale au workspace (ex: bounce email lead)

CREATE TABLE IF NOT EXISTS email_suppressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  email text NOT NULL,
  reason text NOT NULL CHECK (reason IN ('bounce', 'complaint', 'manual', 'unsubscribe')),
  bounce_type text, -- "Permanent" | "Transient" | "Undetermined" (si reason=bounce)
  bounce_subtype text, -- "General" | "NoEmail" | "Suppressed" | etc.
  diagnostic text, -- message DSN brut si dispo
  ses_message_id text, -- messageId de l'envoi qui a bounced
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Unicité : un même email ne peut être qu'une fois par scope (workspace ou global)
CREATE UNIQUE INDEX IF NOT EXISTS email_suppressions_workspace_email_key
  ON email_suppressions (COALESCE(workspace_id::text, 'global'), lower(email));

CREATE INDEX IF NOT EXISTS email_suppressions_email_idx
  ON email_suppressions (lower(email));

ALTER TABLE email_suppressions ENABLE ROW LEVEL SECURITY;

-- RLS : un coach voit uniquement les suppressions de son workspace
CREATE POLICY "email_suppressions_select" ON email_suppressions FOR SELECT
  USING (
    workspace_id IS NULL
    OR workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Insert/delete : service role uniquement (via webhooks et API internes)
-- Pas de policy user → seul le service_role y touche.

-- Multi-compte Google Calendar : permet de connecter plusieurs adresses
-- Google (perso, pro, etc.) à un même workspace ClosRM.

-- Table dédiée aux comptes Google Calendar connectés
CREATE TABLE IF NOT EXISTS google_calendar_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email text NOT NULL,
  label text,
  color text NOT NULL DEFAULT '#4285F4',
  credentials_encrypted text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  connected_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, email)
);

ALTER TABLE google_calendar_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "google_calendar_accounts_workspace"
  ON google_calendar_accounts
  FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM users WHERE id = auth.uid()
    )
  );

-- Lien booking → compte Google d'origine (pour sync/dedup par compte)
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS google_account_id uuid REFERENCES google_calendar_accounts(id) ON DELETE SET NULL;

-- Migrer l'intégration google_calendar existante vers la nouvelle table
-- On récupère l'email depuis les credentials si possible, sinon on met un placeholder
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT id, workspace_id, credentials_encrypted, connected_at
    FROM integrations
    WHERE type = 'google_calendar' AND is_active = true
  LOOP
    INSERT INTO google_calendar_accounts (workspace_id, email, label, credentials_encrypted, connected_at)
    VALUES (
      r.workspace_id,
      'compte-migre@google.com',
      'Google Agenda',
      r.credentials_encrypted,
      COALESCE(r.connected_at, now())
    )
    ON CONFLICT (workspace_id, email) DO NOTHING;

    -- Lier les bookings google_sync existants au nouveau compte
    UPDATE bookings
    SET google_account_id = (
      SELECT gca.id FROM google_calendar_accounts gca
      WHERE gca.workspace_id = r.workspace_id
      LIMIT 1
    )
    WHERE workspace_id = r.workspace_id
      AND source = 'google_sync'
      AND google_account_id IS NULL;
  END LOOP;
END $$;

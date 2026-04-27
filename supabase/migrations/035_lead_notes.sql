-- supabase/migrations/035_lead_notes.sql
-- Notes multiples par lead avec horodatage et édition

CREATE TABLE IF NOT EXISTS lead_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_notes_lead ON lead_notes(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_notes_workspace ON lead_notes(workspace_id);

ALTER TABLE lead_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lead_notes_select" ON lead_notes;
CREATE POLICY "lead_notes_select" ON lead_notes FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "lead_notes_insert" ON lead_notes;
CREATE POLICY "lead_notes_insert" ON lead_notes FOR INSERT
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "lead_notes_update" ON lead_notes;
CREATE POLICY "lead_notes_update" ON lead_notes FOR UPDATE
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "lead_notes_delete" ON lead_notes;
CREATE POLICY "lead_notes_delete" ON lead_notes FOR DELETE
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE OR REPLACE FUNCTION touch_lead_notes_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_lead_notes_touch ON lead_notes;
CREATE TRIGGER trg_lead_notes_touch BEFORE UPDATE ON lead_notes
  FOR EACH ROW EXECUTE FUNCTION touch_lead_notes_updated_at();

-- Migration: copier la note existante de leads.notes vers lead_notes si non vide
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id, workspace_id, notes, created_at FROM leads
           WHERE notes IS NOT NULL AND length(trim(notes)) > 0
  LOOP
    INSERT INTO lead_notes (workspace_id, lead_id, content, created_at, updated_at)
    VALUES (r.workspace_id, r.id, r.notes, COALESCE(r.created_at, NOW()), NOW())
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

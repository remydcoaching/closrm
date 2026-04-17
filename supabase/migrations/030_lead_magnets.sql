-- supabase/migrations/029_lead_magnets.sql

-- 1. Table lead_magnets
CREATE TABLE lead_magnets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title text NOT NULL,
  url text NOT NULL,
  platform text NOT NULL DEFAULT 'other'
    CHECK (platform IN ('youtube','tiktok','instagram','podcast','blog','pdf','other')),
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lead_magnets_workspace ON lead_magnets(workspace_id);

-- 2. Table tracked_links
CREATE TABLE tracked_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  lead_magnet_id uuid NOT NULL REFERENCES lead_magnets(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  short_code text NOT NULL UNIQUE,
  clicks_count int NOT NULL DEFAULT 0,
  first_clicked_at timestamptz,
  last_clicked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE(lead_magnet_id, lead_id)
);

CREATE INDEX idx_tracked_links_short_code ON tracked_links(short_code);
CREATE INDEX idx_tracked_links_lead ON tracked_links(lead_id);
CREATE INDEX idx_tracked_links_magnet ON tracked_links(lead_magnet_id);

-- 3. RLS
ALTER TABLE lead_magnets ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracked_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lead_magnets_select" ON lead_magnets FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "lead_magnets_insert" ON lead_magnets FOR INSERT
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "lead_magnets_update" ON lead_magnets FOR UPDATE
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "lead_magnets_delete" ON lead_magnets FOR DELETE
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "tracked_links_select" ON tracked_links FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "tracked_links_insert" ON tracked_links FOR INSERT
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "tracked_links_delete" ON tracked_links FOR DELETE
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

-- 4. Migration des données JSON existantes (skip si colonne déjà droppée)
DO $$
DECLARE
  brief_row RECORD;
  item jsonb;
  col_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_coach_briefs' AND column_name = 'lead_magnets'
  ) INTO col_exists;

  IF NOT col_exists THEN
    RAISE NOTICE 'ai_coach_briefs.lead_magnets does not exist, skipping data migration';
    RETURN;
  END IF;

  FOR brief_row IN
    EXECUTE 'SELECT workspace_id, lead_magnets FROM ai_coach_briefs WHERE lead_magnets IS NOT NULL AND lead_magnets != '''''
  LOOP
    BEGIN
      FOR item IN SELECT * FROM jsonb_array_elements(brief_row.lead_magnets::jsonb)
      LOOP
        IF (item->>'url') IS NOT NULL AND (item->>'url') != '' THEN
          INSERT INTO lead_magnets (workspace_id, title, url, platform)
          VALUES (
            brief_row.workspace_id,
            COALESCE(item->>'title', 'Sans titre'),
            item->>'url',
            'other'
          );
        END IF;
      END LOOP;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skipping invalid JSON for workspace %', brief_row.workspace_id;
    END;
  END LOOP;
END $$;

-- 5. Drop colonne obsolete
ALTER TABLE ai_coach_briefs DROP COLUMN IF EXISTS lead_magnets;

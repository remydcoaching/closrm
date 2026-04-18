-- supabase/migrations/032_workflow_assets.sql
-- Bibliothèque d'assets réutilisables pour les workflows (liens, audios, fichiers).

CREATE TABLE workflow_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('link', 'audio', 'file')),
  name text NOT NULL,
  url text NOT NULL,
  mime_type text,
  file_size integer,
  storage_path text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_workflow_assets_workspace ON workflow_assets(workspace_id, created_at DESC);

ALTER TABLE workflow_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workflow_assets_select" ON workflow_assets FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "workflow_assets_insert" ON workflow_assets FOR INSERT
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "workflow_assets_update" ON workflow_assets FOR UPDATE
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "workflow_assets_delete" ON workflow_assets FOR DELETE
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

-- Storage bucket
INSERT INTO storage.buckets (id, name, public)
  VALUES ('workflow-assets', 'workflow-assets', true)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "workflow_assets_storage_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'workflow-assets' AND auth.uid() IS NOT NULL);
CREATE POLICY "workflow_assets_storage_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'workflow-assets');
CREATE POLICY "workflow_assets_storage_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'workflow-assets' AND auth.uid() IS NOT NULL);

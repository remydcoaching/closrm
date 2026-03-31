-- T-020: Branding — accent color + workspace logo

-- Add branding columns to workspaces
ALTER TABLE workspaces
  ADD COLUMN accent_color text NOT NULL DEFAULT '#00C853',
  ADD COLUMN logo_url text;

-- Storage bucket for workspace logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('workspace-logos', 'workspace-logos', true)
ON CONFLICT (id) DO NOTHING;

-- RLS: only workspace owner can upload/update/delete logos
CREATE POLICY "workspace_logos_owner_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'workspace-logos'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM workspaces WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "workspace_logos_owner_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'workspace-logos'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM workspaces WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "workspace_logos_owner_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'workspace-logos'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM workspaces WHERE owner_id = auth.uid()
    )
  );

-- Logos are publicly accessible (shown on booking pages)
CREATE POLICY "workspace_logos_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'workspace-logos');

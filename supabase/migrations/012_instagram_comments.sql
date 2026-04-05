-- Instagram Comments module
CREATE TABLE ig_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  ig_comment_id TEXT NOT NULL,
  ig_media_id TEXT NOT NULL,
  media_caption TEXT,
  text TEXT NOT NULL,
  username TEXT,
  timestamp TIMESTAMPTZ,
  is_hidden BOOLEAN DEFAULT FALSE,
  parent_id UUID REFERENCES ig_comments(id),
  ig_parent_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(ig_comment_id)
);

ALTER TABLE ig_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_isolation" ON ig_comments
  USING (workspace_id = (SELECT workspace_id FROM users WHERE id = auth.uid()));

CREATE INDEX idx_ig_comments_workspace ON ig_comments(workspace_id);
CREATE INDEX idx_ig_comments_media ON ig_comments(ig_media_id);

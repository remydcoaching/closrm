-- Team chat messages table
CREATE TABLE team_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- null = message general
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL, -- null = pas lie a un lead
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_team_msg_workspace ON team_messages(workspace_id);
CREATE INDEX idx_team_msg_sender ON team_messages(sender_id);
CREATE INDEX idx_team_msg_recipient ON team_messages(recipient_id);

ALTER TABLE team_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team_messages_access" ON team_messages
  FOR ALL USING (workspace_id IN (SELECT user_workspace_ids()));

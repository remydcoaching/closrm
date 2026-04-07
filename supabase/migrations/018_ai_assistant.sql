-- Brief du coach pour l'IA
CREATE TABLE ai_coach_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID UNIQUE NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  offer_description TEXT,
  target_audience TEXT,
  tone TEXT DEFAULT 'tu' CHECK (tone IN ('tu', 'vous', 'mixed')),
  approach TEXT,
  example_messages TEXT,
  goal TEXT DEFAULT 'book_call' CHECK (goal IN ('book_call', 'sell_dm', 'both')),
  generated_brief TEXT,
  wins_analyzed INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Conversations tagguees pour le self-learning
CREATE TABLE ai_conversation_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES ig_conversations(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('won', 'lost', 'no_response')),
  messages_snapshot JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE ai_coach_briefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workspace brief" ON ai_coach_briefs FOR ALL USING (
  workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid())
);

ALTER TABLE ai_conversation_outcomes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workspace outcomes" ON ai_conversation_outcomes FOR ALL USING (
  workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid())
);

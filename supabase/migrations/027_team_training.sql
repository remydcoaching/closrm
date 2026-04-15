-- ═══════════════════════════════════════════════════════════════════════════
-- 027 — Team Training / SOP + Handoff Brief
-- ═══════════════════════════════════════════════════════════════════════════

-- Training modules (sections)
CREATE TABLE team_training_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  role TEXT CHECK (role IN ('setter', 'closer', 'all')),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Training items (content inside a module)
CREATE TABLE team_training_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES team_training_modules(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('pdf', 'video', 'link', 'text', 'checklist')),
  title TEXT NOT NULL,
  content TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Progress tracking per user per item
CREATE TABLE team_training_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES team_training_items(id) ON DELETE CASCADE,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  UNIQUE(user_id, item_id)
);

-- RLS
ALTER TABLE team_training_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_training_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_training_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "training_modules_access" ON team_training_modules FOR ALL USING (workspace_id IN (SELECT user_workspace_ids()));
CREATE POLICY "training_items_access" ON team_training_items FOR ALL USING (workspace_id IN (SELECT user_workspace_ids()));
CREATE POLICY "training_progress_access" ON team_training_progress FOR ALL USING (workspace_id IN (SELECT user_workspace_ids()));

-- Handoff brief on calls
ALTER TABLE calls ADD COLUMN IF NOT EXISTS handoff_brief JSONB;

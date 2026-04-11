-- Team objectives (configurable targets per role or per member)
CREATE TABLE team_objectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- null = default for the role
  role TEXT CHECK (role IN ('setter', 'closer')),
  metric TEXT NOT NULL, -- 'calls_per_day', 'rdv_per_week', 'closings_per_month', 'ca_per_month', 'joignabilite'
  target_value NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE team_objectives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "objectives_access" ON team_objectives
  FOR ALL USING (workspace_id IN (SELECT user_workspace_ids()));

-- Commissions config
CREATE TABLE team_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- null = default
  role TEXT DEFAULT 'closer' CHECK (role IN ('setter', 'closer')),
  type TEXT NOT NULL DEFAULT 'percentage' CHECK (type IN ('percentage', 'fixed')),
  value NUMERIC NOT NULL DEFAULT 10, -- 10% or 50EUR
  bonus_threshold INTEGER, -- e.g. 10 closings for bonus
  bonus_amount NUMERIC, -- e.g. 200EUR
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE team_commissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "commissions_access" ON team_commissions
  FOR ALL USING (workspace_id IN (SELECT user_workspace_ids()));

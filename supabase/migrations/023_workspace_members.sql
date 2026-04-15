-- ============================================================================
-- MIGRATION 023: Workspace Members (Team feature)
--
-- This migration creates the workspace_members table for multi-user support.
-- It MUST be applied BEFORE migration 024 (RLS policy updates).
--
-- Safe: additive only, no breaking changes to existing functionality.
-- ============================================================================

-- 1. Create workspace_members table
CREATE TABLE IF NOT EXISTS workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'setter' CHECK (role IN ('admin', 'setter', 'closer')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'suspended')),
  permissions JSONB DEFAULT '{}'::jsonb,
  invited_by UUID REFERENCES auth.users(id),
  invited_at TIMESTAMPTZ DEFAULT now(),
  activated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);

-- 2. Indexes for performance (RLS queries will use these)
CREATE INDEX IF NOT EXISTS idx_wm_workspace ON workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_wm_user ON workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_wm_user_status ON workspace_members(user_id, status);

-- 3. RLS on workspace_members
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;

-- Members can see other members of their workspace
CREATE POLICY "wm_select" ON workspace_members
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Only admin can insert new members
CREATE POLICY "wm_insert" ON workspace_members
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Only admin can update members
CREATE POLICY "wm_update" ON workspace_members
  FOR UPDATE USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Only admin can delete members
CREATE POLICY "wm_delete" ON workspace_members
  FOR DELETE USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- 4. BACKFILL: Migrate all existing workspace owners as admin members
-- This is CRITICAL — must happen before any RLS policy change
INSERT INTO workspace_members (workspace_id, user_id, role, status, activated_at, invited_at)
SELECT w.id, w.owner_id, 'admin', 'active', w.created_at, w.created_at
FROM workspaces w
WHERE NOT EXISTS (
  SELECT 1 FROM workspace_members wm
  WHERE wm.workspace_id = w.id AND wm.user_id = w.owner_id
)
ON CONFLICT (workspace_id, user_id) DO NOTHING;

-- Also backfill any users in the users table not yet in workspace_members
INSERT INTO workspace_members (workspace_id, user_id, role, status, activated_at, invited_at)
SELECT u.workspace_id, u.id,
  CASE u.role
    WHEN 'coach' THEN 'admin'
    WHEN 'setter' THEN 'setter'
    WHEN 'closer' THEN 'closer'
    ELSE 'admin'
  END,
  'active', u.created_at, u.created_at
FROM users u
WHERE NOT EXISTS (
  SELECT 1 FROM workspace_members wm
  WHERE wm.workspace_id = u.workspace_id AND wm.user_id = u.id
)
ON CONFLICT (workspace_id, user_id) DO NOTHING;

-- 5. Add assigned_to columns on leads, calls, bookings
ALTER TABLE leads ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id);
ALTER TABLE calls ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_leads_assigned ON leads(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calls_assigned ON calls(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_assigned ON bookings(assigned_to) WHERE assigned_to IS NOT NULL;

-- 6. Update handle_new_user trigger to also create workspace_member
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_workspace_id uuid;
BEGIN
  -- Create workspace
  INSERT INTO workspaces (name, owner_id)
  VALUES (
    COALESCE(new.raw_user_meta_data->>'full_name', 'Mon workspace') || ' — Workspace',
    new.id
  )
  RETURNING id INTO new_workspace_id;

  -- Create user profile
  INSERT INTO users (id, workspace_id, email, role, full_name)
  VALUES (
    new.id,
    new_workspace_id,
    new.email,
    'coach',
    COALESCE(new.raw_user_meta_data->>'full_name', '')
  );

  -- Create workspace_member as admin
  INSERT INTO workspace_members (workspace_id, user_id, role, status, activated_at)
  VALUES (new_workspace_id, new.id, 'admin', 'active', now());

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Helper function for RLS policies (used in migration 024)
-- Returns all workspace IDs the current user is an active member of
CREATE OR REPLACE FUNCTION user_workspace_ids()
RETURNS SETOF UUID AS $$
  SELECT workspace_id FROM workspace_members
  WHERE user_id = auth.uid() AND status = 'active'
$$ LANGUAGE sql SECURITY DEFINER STABLE;

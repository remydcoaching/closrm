-- T-036: Workspace-level customization of lead statuses and sources.
-- Adds two nullable JSONB columns on workspaces. NULL = use hardcoded
-- defaults. Non-null = ordered array of entries with label/color/bg/visible.

ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS status_config jsonb,
  ADD COLUMN IF NOT EXISTS source_config jsonb;

COMMENT ON COLUMN workspaces.status_config IS
  'T-036: Array<{key: LeadStatus, label, color, bg, visible}>. NULL = use defaults.';
COMMENT ON COLUMN workspaces.source_config IS
  'T-036: Array<{key: LeadSource, label, color, bg, visible}>. NULL = use defaults.';

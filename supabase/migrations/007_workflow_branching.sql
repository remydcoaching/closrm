-- ============================================================================
-- Migration 007: Workflow branching + wait_for_event step type
-- ============================================================================

-- Add branching support to workflow_steps
ALTER TABLE workflow_steps ADD COLUMN IF NOT EXISTS parent_step_id UUID REFERENCES workflow_steps(id) ON DELETE CASCADE;
ALTER TABLE workflow_steps ADD COLUMN IF NOT EXISTS branch TEXT CHECK (branch IN ('main', 'true', 'false'));

-- Default existing steps to main branch
UPDATE workflow_steps SET branch = 'main' WHERE branch IS NULL;

-- Update step_type constraint to include wait_for_event
ALTER TABLE workflow_steps DROP CONSTRAINT IF EXISTS workflow_steps_step_type_check;
ALTER TABLE workflow_steps ADD CONSTRAINT workflow_steps_step_type_check
  CHECK (step_type IN ('action', 'delay', 'condition', 'wait_for_event'));

-- Update condition_operator constraint to include new operators
ALTER TABLE workflow_steps DROP CONSTRAINT IF EXISTS workflow_steps_condition_operator_check;

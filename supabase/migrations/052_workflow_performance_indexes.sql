-- Migration 052: Performance indexes for workflow/automation system
-- Fixes critical disk IO issues: full table scans on workflow_executions,
-- workflow_execution_logs, and leads (inactive trigger).

-- workflow_executions: anti-duplicate check (workflow_id + lead_id + started_at)
CREATE INDEX IF NOT EXISTS idx_wf_exec_workflow_lead_started
  ON workflow_executions(workflow_id, lead_id, started_at DESC);

-- workflow_executions: resume waiting executions
CREATE INDEX IF NOT EXISTS idx_wf_exec_waiting_resume
  ON workflow_executions(status, resume_at)
  WHERE status = 'waiting';

-- workflow_executions: filter by workspace + status
CREATE INDEX IF NOT EXISTS idx_wf_exec_workspace_status
  ON workflow_executions(workspace_id, status);

-- workflow_execution_logs: lookup by execution
CREATE INDEX IF NOT EXISTS idx_wf_exec_logs_execution_id
  ON workflow_execution_logs(execution_id);

-- leads: inactive lead trigger (workspace + last_activity_at)
CREATE INDEX IF NOT EXISTS idx_leads_workspace_last_activity
  ON leads(workspace_id, last_activity_at DESC);

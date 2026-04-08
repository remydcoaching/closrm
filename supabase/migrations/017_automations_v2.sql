-- Migration 017: Automations v2 — new triggers, actions, tracking
-- Run in Supabase > SQL Editor

-- Tracking last activity for lead_inactive_x_days trigger
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ DEFAULT now();

-- Index for cron lead_inactive
CREATE INDEX IF NOT EXISTS idx_leads_last_activity_at ON leads(last_activity_at) WHERE last_activity_at IS NOT NULL;

-- Notification on failure for workflows
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS notify_on_failure BOOLEAN DEFAULT FALSE;
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS failure_notification_channel TEXT;

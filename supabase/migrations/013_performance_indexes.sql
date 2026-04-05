-- Performance indexes for commonly filtered/sorted columns
-- Migration 013 — 2026-04-05

-- Leads: frequently filtered by status, searched by name, sorted by created_at
CREATE INDEX IF NOT EXISTS idx_leads_workspace_status ON leads(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_leads_workspace_created ON leads(workspace_id, created_at DESC);

-- Calls: frequently filtered by type, sorted by scheduled_at
CREATE INDEX IF NOT EXISTS idx_calls_workspace_scheduled ON calls(workspace_id, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_calls_lead_id ON calls(lead_id);

-- Follow-ups: filtered by status
CREATE INDEX IF NOT EXISTS idx_followups_workspace_status ON follow_ups(workspace_id, status);

-- Instagram drafts: filtered by status, sorted by scheduled_at
CREATE INDEX IF NOT EXISTS idx_ig_drafts_workspace_status ON ig_drafts(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_ig_drafts_scheduled ON ig_drafts(status, scheduled_at) WHERE status = 'scheduled';

-- Instagram conversations: sorted by last_message_at
CREATE INDEX IF NOT EXISTS idx_ig_conversations_workspace_last_msg ON ig_conversations(workspace_id, last_message_at DESC);

-- Instagram comments: filtered by media, sorted by timestamp
CREATE INDEX IF NOT EXISTS idx_ig_comments_workspace_timestamp ON ig_comments(workspace_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_ig_comments_media ON ig_comments(workspace_id, ig_media_id);

-- Bookings: filtered by calendar, status, sorted by scheduled_at
CREATE INDEX IF NOT EXISTS idx_bookings_workspace_scheduled ON bookings(workspace_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_bookings_workspace_calendar ON bookings(workspace_id, calendar_id);

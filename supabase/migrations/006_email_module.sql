-- ============================================================================
-- Migration 006: Email Module (T-020)
-- Domaines custom, templates, broadcasts, sends, sequence enrollments
-- ============================================================================

-- ── Email Domains ───────────────────────────────────────────────────────────

CREATE TABLE email_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  resend_domain_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'failed')),
  dns_records JSONB,
  default_from_email TEXT,
  default_from_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id, domain)
);

ALTER TABLE email_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_domains_workspace" ON email_domains
  FOR ALL USING (
    workspace_id IN (SELECT workspace_id FROM users WHERE id = auth.uid())
  );

-- ── Email Templates ─────────────────────────────────────────────────────────

CREATE TABLE email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  blocks JSONB NOT NULL DEFAULT '[]',
  preview_text TEXT,
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_templates_workspace" ON email_templates
  FOR ALL USING (
    workspace_id IN (SELECT workspace_id FROM users WHERE id = auth.uid())
  );

-- ── Email Broadcasts ────────────────────────────────────────────────────────

CREATE TABLE email_broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  template_id UUID REFERENCES email_templates(id) ON DELETE SET NULL,
  subject TEXT,
  filters JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'failed')),
  scheduled_at TIMESTAMPTZ,
  sent_count INT DEFAULT 0,
  total_count INT DEFAULT 0,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE email_broadcasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_broadcasts_workspace" ON email_broadcasts
  FOR ALL USING (
    workspace_id IN (SELECT workspace_id FROM users WHERE id = auth.uid())
  );

-- ── Email Sends (centralized log) ──────────────────────────────────────────

CREATE TABLE email_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  broadcast_id UUID REFERENCES email_broadcasts(id) ON DELETE SET NULL,
  sequence_id UUID REFERENCES workflows(id) ON DELETE SET NULL,
  template_id UUID REFERENCES email_templates(id) ON DELETE SET NULL,
  resend_email_id TEXT,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained')),
  subject TEXT,
  from_email TEXT,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE email_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_sends_workspace" ON email_sends
  FOR ALL USING (
    workspace_id IN (SELECT workspace_id FROM users WHERE id = auth.uid())
  );

-- Index for webhook lookups by resend_email_id
CREATE INDEX idx_email_sends_resend_id ON email_sends(resend_email_id) WHERE resend_email_id IS NOT NULL;

-- ── Email Sequence Enrollments ──────────────────────────────────────────────

CREATE TABLE email_sequence_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  sequence_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'unsubscribed')),
  current_step INT NOT NULL DEFAULT 0,
  enrolled_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  UNIQUE(sequence_id, lead_id)
);

ALTER TABLE email_sequence_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_sequence_enrollments_workspace" ON email_sequence_enrollments
  FOR ALL USING (
    workspace_id IN (SELECT workspace_id FROM users WHERE id = auth.uid())
  );

-- ── Leads: add unsubscribe fields ──────────────────────────────────────────

ALTER TABLE leads ADD COLUMN IF NOT EXISTS email_unsubscribed BOOLEAN DEFAULT false;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS email_unsubscribed_at TIMESTAMPTZ;

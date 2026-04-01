-- ============================================================================
-- Migration 008: Funnels module
-- ============================================================================

CREATE TABLE funnels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  domain_id UUID REFERENCES email_domains(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id, slug)
);

ALTER TABLE funnels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "funnels_workspace" ON funnels
  FOR ALL USING (
    workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid())
  );

CREATE TABLE funnel_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel_id UUID NOT NULL REFERENCES funnels(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  page_order INT NOT NULL DEFAULT 1,
  blocks JSONB NOT NULL DEFAULT '[]',
  seo_title TEXT,
  seo_description TEXT,
  favicon_url TEXT,
  redirect_url TEXT,
  is_published BOOLEAN DEFAULT false,
  views_count INT DEFAULT 0,
  submissions_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(funnel_id, slug)
);

ALTER TABLE funnel_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "funnel_pages_workspace" ON funnel_pages
  FOR ALL USING (
    workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid())
  );

CREATE TABLE funnel_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel_page_id UUID NOT NULL REFERENCES funnel_pages(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('view', 'form_submit', 'button_click', 'video_play')),
  visitor_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE funnel_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "funnel_events_workspace" ON funnel_events
  FOR ALL USING (
    workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid())
  );

CREATE INDEX idx_funnel_events_page ON funnel_events(funnel_page_id);
CREATE INDEX idx_funnel_events_visitor ON funnel_events(visitor_id);

-- Allow 'funnel' as lead source
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_source_check;
ALTER TABLE leads ADD CONSTRAINT leads_source_check
  CHECK (source IN ('facebook_ads', 'instagram_ads', 'formulaire', 'manuel', 'funnel'));

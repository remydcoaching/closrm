-- Migration 015: Add instagram_handle column to leads
ALTER TABLE leads ADD COLUMN instagram_handle TEXT;
CREATE INDEX idx_leads_instagram_handle ON leads(instagram_handle) WHERE instagram_handle IS NOT NULL;

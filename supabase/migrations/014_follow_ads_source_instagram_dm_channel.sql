-- ============================================================================
-- Migration 014: Follow Ads source + Instagram DM channel (A-007)
-- ============================================================================
-- Adds:
--   - 'follow_ads' as a valid lead source (for prospects acquired via Meta
--     awareness/follower campaigns — see T-025 follow ads classification)
--   - 'instagram_dm' as a valid follow-up channel (for relances via DMs IG)
-- ============================================================================

-- ─── Lead source: add 'follow_ads' ───────────────────────────────────────────
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_source_check;
ALTER TABLE leads ADD CONSTRAINT leads_source_check
  CHECK (source IN ('facebook_ads', 'instagram_ads', 'follow_ads', 'formulaire', 'manuel', 'funnel'));

-- ─── Follow-up channel: add 'instagram_dm' ───────────────────────────────────
ALTER TABLE follow_ups DROP CONSTRAINT IF EXISTS follow_ups_channel_check;
ALTER TABLE follow_ups ADD CONSTRAINT follow_ups_channel_check
  CHECK (channel IN ('whatsapp', 'email', 'instagram_dm', 'manuel'));

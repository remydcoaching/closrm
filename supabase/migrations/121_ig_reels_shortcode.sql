-- supabase/migrations/121_ig_reels_shortcode.sql
-- Reels synced from the official Meta API (ig_reels) carry Graph ids
-- (17…), while Hiker scans and interactions use Instagram's media pk. The
-- shortcode (instagram.com/reel/<shortcode>/) links both: it is stored here
-- so the Content page can show Meta's official figures (views, reach, saves,
-- shares) on the contents Hiker scanned, and list the ones it didn't.
alter table ig_reels add column if not exists shortcode text;
alter table ig_reels add column if not exists permalink text;
create index if not exists idx_ig_reels_shortcode on ig_reels(workspace_id, shortcode);

-- Comments read from the official Meta API feed the lead journey too.
alter table instagram_interactions drop constraint if exists instagram_interactions_source_provider_check;
alter table instagram_interactions add constraint instagram_interactions_source_provider_check
  check (source_provider in ('apify', 'hiker', 'desktop_session', 'meta'));

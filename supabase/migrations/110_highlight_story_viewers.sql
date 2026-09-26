-- supabase/migrations/110_highlight_story_viewers.sql
-- Highlight ("à la une") stories in the story-viewer history.
--  - story_view_stories: which highlight a story belongs to, Instagram's
--    like count, and whether its viewer list could be read on the last
--    attempt ('ok' even with 0 viewers; 'error' = not readable — never "0").
--  - story_viewers: is_private as reported in the owner's viewer list.
-- Timestamps stay observation times (first_seen_at = first time ClosRM saw
-- the viewer in the list); Instagram does not say when someone viewed.
-- NOTE: renumber after develop's migrations when rebasing (see 104).
alter table story_view_stories add column if not exists highlight_id text;
alter table story_view_stories add column if not exists highlight_title text;
alter table story_view_stories add column if not exists like_count int;
alter table story_view_stories add column if not exists fetch_status text check (fetch_status in ('ok', 'error'));
alter table story_view_stories add column if not exists fetch_error text;
alter table story_viewers add column if not exists is_private boolean;

create index if not exists idx_story_viewers_lead on story_viewers(workspace_id, matched_lead_id) where matched_lead_id is not null;

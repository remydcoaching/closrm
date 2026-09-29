-- supabase/migrations/105_instagram_content_view.sql
-- Aggregates instagram_interactions by (workspace_id, source_post_id) into a
-- read-only "content" view — no duplicated storage, just a projection over
-- data that already exists. This is what powers Instagram > Content (a
-- content-centric view of engagement) without inventing a new table of
-- truth alongside instagram_interactions.
--
-- Thumbnails are intentionally NOT part of this view: Hiker's
-- NormalizedContent drops thumbnail_url today (see normalizer.ts), and
-- Apify's apify_watched_posts is a different, unrelated shape. Adding a
-- thumbnail column here would require a separate decision (see
-- CLOSRM_DESKTOP_FINAL_VISION.md §4.3) — the UI must render a neutral
-- placeholder until that is resolved, never a fabricated image.

create or replace view instagram_content_summary as
select
  workspace_id,
  source_post_id,
  source_post_url,
  source_provider,
  count(distinct lead_id) as leads_count,
  count(*) filter (where interaction_type = 'like') as likes_count,
  count(*) filter (where interaction_type = 'comment') as comments_count,
  count(*) filter (where interaction_type = 'dm') as dm_count,
  count(*) filter (where interaction_type = 'mention') as mention_count,
  min(first_seen_at) as first_interaction_at,
  max(last_seen_at) as last_interaction_at
from instagram_interactions
where source_post_id is not null
group by workspace_id, source_post_id, source_post_url, source_provider;

comment on view instagram_content_summary is
  'Read-only aggregation over instagram_interactions, grouped per piece of content. likes_count/comments_count are counts of OBSERVED interaction rows, not Instagram''s own like/comment counters — never presented as exhaustive (Hiker likers/comments coverage is not guaranteed complete, see discovery.ts).';

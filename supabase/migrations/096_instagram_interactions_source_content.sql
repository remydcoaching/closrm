-- supabase/migrations/096_instagram_interactions_source_content.sql
-- Loosens instagram_interactions.source_post_id from a strict FK into
-- apify_watched_posts to a free-text content identifier.
--
-- Why: instagram_interactions was designed around Apify's model, where a
-- post/reel is pre-registered in apify_watched_posts before being scraped.
-- The Hiker discovery provider (src/lib/hiker/) has no such pre-registration
-- step — it resolves and scans any public account's content on demand, so a
-- Hiker-sourced interaction has no apify_watched_posts row to point to.
--
-- Reusing apify_watched_posts for Hiker content would be semantically wrong
-- (the table name and its columns — instagram_post_url, last_run_id,
-- likers_count — are Apify-run-specific) and would create an artificial
-- coupling between two independent providers. ig_reels (009_instagram_module)
-- was also considered and rejected: it models the *connected coach's own*
-- published content (editorial pillar, format, engagement_rate), not
-- third-party accounts scanned via discovery.
--
-- This migration keeps the existing Apify flow fully working (apify_runs,
-- apify_watched_posts, process-likers.ts all untouched) while unblocking a
-- second provider from writing into the same instagram_interactions table,
-- which stays the single source of truth for Instagram engagement as
-- required by the Hiker integration plan.

-- Drop the strict FK to apify_watched_posts; keep the column, now free text.
alter table instagram_interactions drop constraint if exists instagram_interactions_source_post_id_fkey;
alter table instagram_interactions alter column source_post_id type text using source_post_id::text;

comment on column instagram_interactions.source_post_id is
  'Free-text content identifier: an apify_watched_posts.id (as text) for Apify-sourced rows, or a Hiker media pk for Hiker-sourced rows. No FK — providers are independent.';

-- Track which provider produced a given interaction row (nullable: existing
-- Apify rows predate this column and are implicitly 'apify' by construction —
-- backfilled explicitly below rather than left ambiguous).
alter table instagram_interactions add column if not exists source_provider text
  check (source_provider in ('apify', 'hiker'));

update instagram_interactions set source_provider = 'apify' where source_provider is null;

create index if not exists idx_instagram_interactions_provider on instagram_interactions(workspace_id, source_provider);

-- The dedup unique index (092) already keys on (workspace_id, lead_id,
-- interaction_type, source_post_id, instagram_user_id/username) — unaffected
-- by the column type change (uuid -> text cast is dedup-stable) and does not
-- need to include source_provider, since a like/comment on the same content
-- by the same person is the same logical interaction regardless of which
-- provider observed it.

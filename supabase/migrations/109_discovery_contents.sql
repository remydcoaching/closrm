-- supabase/migrations/109_discovery_contents.sql
-- Persists per-content metadata from a Hiker discovery run — view count,
-- content type, publish date, thumbnail — none of which are stored today
-- (discoverInstagramAccount's NormalizedContent carries viewCount and
-- thumbnail_url, but persist.ts/persist-profiles.ts never write them
-- anywhere; they're discarded once the HTTP response completes). This is
-- what the "Content" page's engagement-vs-views scatter chart needs (see
-- CLOSRM_DESKTOP_FINAL_VISION.md §4.3, now resolved for Hiker sources).
--
-- Not merged into instagram_content_summary (099): that view aggregates
-- OBSERVED interaction rows across BOTH Hiker and Apify — this table is
-- Hiker-specific content metadata from ONE discovery run. A later join
-- (via source_post_id) lets the UI show views on top of the aggregated
-- interaction counts without conflating the two source shapes.

create table discovery_contents (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  discovery_run_id uuid not null references discovery_runs(id) on delete cascade,
  content_id text not null, -- matches instagram_interactions.source_post_id for this content
  content_type text not null check (content_type in ('media', 'clip')),
  content_url text,
  thumbnail_url text,
  published_at timestamptz,
  view_count int,
  -- Denormalized snapshot at scan time — instagram_content_summary (099)
  -- already computes these from instagram_interactions and stays the
  -- source of truth for OBSERVED counts; these are Hiker's own reported
  -- counters (like_count is documented unreliable, see normalizer.ts).
  reported_like_count int,
  reported_comment_count int,
  created_at timestamptz not null default now()
);

create unique index discovery_contents_run_content_uq on discovery_contents(discovery_run_id, content_id);
create index idx_discovery_contents_workspace on discovery_contents(workspace_id, content_id);

alter table discovery_contents enable row level security;

create policy "Workspace discovery_contents" on discovery_contents
  for all using (
    workspace_id in (select user_workspace_ids())
  );

comment on table discovery_contents is
  'Per-content metadata (views, type, thumbnail) captured at Hiker scan time — joins to instagram_content_summary.source_post_id to power the Content page''s engagement-vs-views chart. reported_like_count is Hiker''s own counter, documented unreliable (see src/lib/hiker/normalizer.ts) — never presented as authoritative.';

-- supabase/migrations/106_story_viewers.sql
-- Story viewers of the coach's OWN account, collected by ClosRM Desktop
-- from the coach's Instagram web session (the coach logs in inside the app;
-- the session never leaves their machine — only viewer identities are sent
-- here). Instagram only exposes who viewed a story while it is live (24h),
-- so the desktop collects periodically and history accumulates here —
-- this is what powers "lurkers sur vos 10 dernières stories" and the
-- per-profile "assiduité" (stories viewed out of stories collected).
--
-- NOTE: renumber after develop's migrations when rebasing (see 104).

create table if not exists story_view_stories (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  story_pk text not null,
  instagram_account_username text not null,
  taken_at timestamptz not null,
  expiring_at timestamptz,
  media_type text,
  thumbnail_url text,
  viewer_count int,
  viewers_collected int not null default 0,
  last_collected_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (workspace_id, story_pk)
);

create index if not exists idx_story_view_stories_taken on story_view_stories(workspace_id, taken_at desc);

create table if not exists story_viewers (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  story_pk text not null,
  instagram_user_id text not null,
  instagram_username text not null,
  full_name text,
  profile_pic_url text,
  is_verified boolean,
  matched_lead_id uuid references leads(id) on delete set null,
  first_seen_at timestamptz not null default now(),
  unique (workspace_id, story_pk, instagram_user_id)
);

create index if not exists idx_story_viewers_user on story_viewers(workspace_id, instagram_user_id);
create index if not exists idx_story_viewers_story on story_viewers(workspace_id, story_pk);

alter table story_view_stories enable row level security;
alter table story_viewers enable row level security;

drop policy if exists "Workspace story_view_stories" on story_view_stories;
create policy "Workspace story_view_stories" on story_view_stories
  for all using (workspace_id in (select user_workspace_ids()));

drop policy if exists "Workspace story_viewers" on story_viewers;
create policy "Workspace story_viewers" on story_viewers
  for all using (workspace_id in (select user_workspace_ids()));

-- A story view by a known lead is an engagement signal like a like: it
-- feeds instagram_interactions (score, lead timeline, audience segments).
alter table instagram_interactions drop constraint if exists instagram_interactions_interaction_type_check;
alter table instagram_interactions add constraint instagram_interactions_interaction_type_check
  check (interaction_type in ('like', 'comment', 'dm', 'mention', 'story_view'));

alter table instagram_interactions drop constraint if exists instagram_interactions_source_provider_check;
alter table instagram_interactions add constraint instagram_interactions_source_provider_check
  check (source_provider in ('apify', 'hiker', 'desktop_session'));

comment on table story_viewers is
  'Who viewed which story of the coach''s own account, collected by ClosRM Desktop from the coach''s Instagram session while the story was live. Observations only; matched_lead_id links a viewer to an existing lead.';

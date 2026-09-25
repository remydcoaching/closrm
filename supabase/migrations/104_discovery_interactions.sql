-- supabase/migrations/104_discovery_interactions.sql
-- Who liked / commented WHICH content during a Ciblage (Hiker) run.
--
-- discoverInstagramAccount already returns this per-content detail
-- (DiscoveryResult.interactions) but the Ciblage flow only persisted the
-- per-profile totals (discovery_profiles.likes_count / comments_count), so
-- the Content page could not show "165 likers et 7 commentaires identifiés"
-- nor the list of profiles behind a given reel. One row per
-- (run, content, profile, type) — same "each run is its own historical
-- record" rule as discovery_profiles (102).
--
-- NOTE: numbered 104 in this branch; renumber after 101 when rebasing on
-- develop (096–101 are taken there by the DM-session migrations).

create table discovery_interactions (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  discovery_run_id uuid not null references discovery_runs(id) on delete cascade,
  content_id text not null, -- discovery_contents.content_id / instagram_interactions.source_post_id
  instagram_user_id text,
  instagram_username text not null,
  full_name text,
  interaction_type text not null check (interaction_type in ('like', 'comment')),
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index discovery_interactions_uq
  on discovery_interactions(discovery_run_id, content_id, instagram_username, interaction_type);
create index idx_discovery_interactions_content on discovery_interactions(workspace_id, content_id);
create index idx_discovery_interactions_user on discovery_interactions(workspace_id, instagram_username);

alter table discovery_interactions enable row level security;

create policy "Workspace discovery_interactions" on discovery_interactions
  for all using (
    workspace_id in (select user_workspace_ids())
  );

comment on table discovery_interactions is
  'Per-content like/comment observed during a Ciblage run (Hiker). Powers the Content detail page (who reacted to this content) — observations only, never a lead.';

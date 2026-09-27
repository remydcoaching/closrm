-- supabase/migrations/108_discovery_profiles.sql
-- Renaming/reshaping "Instagram Discovery" into "Ciblage" per explicit
-- product feedback: scanning an Instagram account must NOT create a lead
-- for every profile that reacted to its content automatically. It must
-- only OBSERVE who liked/commented (with their like/comment counts,
-- whether they already follow the coach, whether they are already a lead),
-- and let the coach convert a specific profile into a lead on demand via a
-- "Cibler" action — one profile at a time, not a bulk import.
--
-- persistDiscoveryResult (src/lib/hiker/persist.ts) currently creates a
-- lead for EVERY observed profile — that behavior changes to write into
-- this new table instead, and lead creation moves to a new dedicated
-- "target" endpoint. This table is per discovery_run, not per lead: the
-- same real person can appear in multiple runs (re-analyzed later), each
-- appearance is its own row so historical analyses stay intact ("les
-- analyses sont gardées en backup").

create table discovery_profiles (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  discovery_run_id uuid not null references discovery_runs(id) on delete cascade,
  instagram_user_id text,
  instagram_username text not null,
  full_name text,
  profile_pic_url text,
  is_verified boolean,
  follows_target boolean not null default false,
  likes_count int not null default 0,
  comments_count int not null default 0,
  dm_count int not null default 0,
  -- Denormalized at write time from a leads lookup — see §4.1 note below on
  -- why this isn't just a live join.
  matched_lead_id uuid references leads(id) on delete set null,
  targeted_at timestamptz,
  targeted_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index idx_discovery_profiles_run on discovery_profiles(discovery_run_id);
create index idx_discovery_profiles_workspace on discovery_profiles(workspace_id, created_at desc);
create index idx_discovery_profiles_ig_user on discovery_profiles(workspace_id, instagram_user_id);

alter table discovery_profiles enable row level security;

create policy "Workspace discovery_profiles" on discovery_profiles
  for all using (
    workspace_id in (select user_workspace_ids())
  );

comment on table discovery_profiles is
  'One row per Instagram profile observed during a Ciblage (Discovery) run — NOT a lead. matched_lead_id is set if that profile was already a lead at scan time (pre-existing, matched by instagram_user_id/handle); targeted_at/targeted_by are set only once the coach explicitly clicks "Cibler" and a lead is created from this row (see POST /api/instagram/discovery/[runId]/profiles/[profileId]/target).';

-- supabase/migrations/097_hiker_discovery_runs.sql
-- Traceability table for Hiker discovery runs.
--
-- Why not reuse apify_runs (091): apify_runs models an ASYNC external job
-- (apify_run_id text not null unique — an Apify-side run identifier polled
-- later) with a mandatory watched_post_id FK into apify_watched_posts. A
-- Hiker discovery is a single SYNCHRONOUS call from ClosRM's own backend
-- (POST /api/instagram/discovery) with no external run id to poll, no
-- pre-registered watched post, and a richer status vocabulary the mission
-- requires (PARTIAL / INSUFFICIENT_FUNDS, not just pending/running/
-- succeeded/failed). Bending apify_runs to fit would mean making its Apify-
-- specific columns nullable and inventing a fake apify_run_id per Hiker run,
-- which is more confusing than a small dedicated table.

create table discovery_runs (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  provider text not null check (provider in ('hiker')),
  instagram_username text not null,
  instagram_user_id text,
  status text not null default 'RUNNING' check (status in ('RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED')),
  stopped_reason text check (stopped_reason in ('completed', 'insufficient_funds', 'auth_error')),
  contents_found int not null default 0,
  users_found int not null default 0,
  interactions_found int not null default 0,
  followers_found int not null default 0,
  http_calls int not null default 0,
  estimated_billed_requests int not null default 0,
  errors_count int not null default 0,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  metadata jsonb,
  triggered_by uuid references auth.users(id)
);

create index idx_discovery_runs_workspace on discovery_runs(workspace_id, started_at desc);
create index idx_discovery_runs_status on discovery_runs(status) where status = 'RUNNING';

alter table discovery_runs enable row level security;

create policy "Workspace discovery_runs" on discovery_runs
  for all using (
    workspace_id in (select user_workspace_ids())
  );

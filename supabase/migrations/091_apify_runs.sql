-- supabase/migrations/091_apify_runs.sql
-- Trace chaque run Apify lancé pour un post surveillé : permet l'idempotence
-- (un run_id Apify ne peut être traité qu'une fois) et le suivi de statut.

create table apify_runs (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  watched_post_id uuid references apify_watched_posts(id) on delete cascade,
  apify_run_id text not null unique,
  apify_dataset_id text,
  status text not null default 'pending' check (status in ('pending', 'running', 'succeeded', 'failed')),
  items_processed int not null default 0,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index idx_apify_runs_workspace on apify_runs(workspace_id);
create index idx_apify_runs_status on apify_runs(status) where status in ('pending', 'running');

alter table apify_runs enable row level security;

create policy "Workspace apify_runs" on apify_runs
  for all using (
    workspace_id in (select user_workspace_ids())
  );

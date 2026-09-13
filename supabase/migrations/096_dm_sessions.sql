-- supabase/migrations/096_dm_sessions.sql
-- Session DM : file de leads à relancer en une passe guidée, un lead à la
-- fois. Persistée pour survivre à la fermeture de l'app (spec: reprendre
-- une session en cours plutôt que la recommencer à zéro).

create table dm_sessions (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'completed', 'abandoned')),
  target_count integer not null check (target_count > 0),
  stale_threshold_days integer not null default 30 check (stale_threshold_days > 0),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index idx_dm_sessions_workspace_active
  on dm_sessions(workspace_id, status)
  where status = 'active';

create table dm_session_items (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references dm_sessions(id) on delete cascade,
  lead_id uuid not null references leads(id) on delete cascade,
  position integer not null,
  category text not null check (category in (
    'relance_en_retard', 'engagement_instagram', 'jamais_recontacte', 'premier_message'
  )),
  outcome text check (outcome in ('relaunched', 'archived', 'skipped')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, lead_id)
);

create index idx_dm_session_items_session_position
  on dm_session_items(session_id, position);

alter table dm_sessions enable row level security;
alter table dm_session_items enable row level security;

create policy "Workspace dm_sessions" on dm_sessions
  for all using (
    workspace_id in (select user_workspace_ids())
  );

create policy "Workspace dm_session_items" on dm_session_items
  for all using (
    session_id in (
      select id from dm_sessions
      where workspace_id in (select user_workspace_ids())
    )
  );

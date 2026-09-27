-- supabase/migrations/097_setting_processes.sql
-- Process de setting éditables en base : remplace progressivement les
-- templates statiques de src/lib/dm-sessions/templates.ts. Un process a des
-- étapes ordonnées (next_step_id = chemin par défaut) et des sorties
-- nommées optionnelles (setting_process_step_transitions) pour les
-- embranchements ("prospect a répondu" -> étape spécifique au lieu de la
-- suivante dans l'ordre).

create table setting_processes (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_setting_processes_workspace_active
  on setting_processes(workspace_id, status)
  where status = 'active';

create table setting_process_steps (
  id uuid primary key default uuid_generate_v4(),
  process_id uuid not null references setting_processes(id) on delete cascade,
  position integer not null,
  title text not null,
  step_type text not null default 'message' check (step_type in ('message', 'relance')),
  content text not null,
  delay_days integer check (delay_days is null or delay_days > 0),
  next_step_id uuid references setting_process_steps(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (process_id, position)
);

create index idx_setting_process_steps_process_position
  on setting_process_steps(process_id, position);

-- Sorties nommées : une étape peut avoir un chemin par défaut (next_step_id)
-- et des sorties alternatives (ex: "repondu" -> une étape spécifique) que le
-- setter choisit explicitement plutôt que de suivre l'ordre par défaut.
create table setting_process_step_transitions (
  id uuid primary key default uuid_generate_v4(),
  step_id uuid not null references setting_process_steps(id) on delete cascade,
  outcome_label text not null,
  target_step_id uuid not null references setting_process_steps(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (step_id, outcome_label)
);

create index idx_setting_process_step_transitions_step
  on setting_process_step_transitions(step_id);

alter table setting_processes enable row level security;
alter table setting_process_steps enable row level security;
alter table setting_process_step_transitions enable row level security;

create policy "Workspace setting_processes" on setting_processes
  for all using (
    workspace_id in (select user_workspace_ids())
  );

create policy "Workspace setting_process_steps" on setting_process_steps
  for all using (
    process_id in (
      select id from setting_processes
      where workspace_id in (select user_workspace_ids())
    )
  );

create policy "Workspace setting_process_step_transitions" on setting_process_step_transitions
  for all using (
    step_id in (
      select s.id from setting_process_steps s
      join setting_processes p on p.id = s.process_id
      where p.workspace_id in (select user_workspace_ids())
    )
  );

-- Conversation active suite à réponse Instagram détectée manuellement par le
-- setter : champ dédié plutôt que nouvelle valeur de leads.status, pour ne
-- pas mélanger l'état d'une conversation Instagram avec le pipeline
-- calls/closing (nouveau -> setting_planifie -> ... -> clos/dead). Un
-- timestamp non-null indique qu'une conversation est en cours et que les
-- relances programmées pour ce lead ne doivent plus être proposées en
-- session DM tant que la conversation reste active.
alter table leads add column dm_conversation_active_at timestamptz;

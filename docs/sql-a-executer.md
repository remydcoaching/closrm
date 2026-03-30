# SQL à exécuter dans Supabase — Pour Rémy

> **Instructions :** Va dans Supabase > SQL Editor > New Query, colle le SQL ci-dessous et clique Run.
> Projet : `hsnqmjsckekbmmwneybb`

---

## 1. Migration Workflows (remplace la table `automations`)

Crée 4 nouvelles tables pour le système d'automations/workflows.

```sql
-- Migration 001: Replace automations with workflows system

-- ─── Drop old automations table ──────────────────────────────────────────────
drop policy if exists "Workspace automations" on automations;
drop table if exists automations;

-- ─── Workflows ───────────────────────────────────────────────────────────────
create table workflows (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  description text,
  trigger_type text not null,
  trigger_config jsonb not null default '{}',
  status text not null default 'brouillon' check (status in ('brouillon', 'actif', 'inactif')),
  execution_count integer not null default 0,
  last_run_at timestamptz,
  template_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table workflows enable row level security;
create policy "Workspace workflows" on workflows
  for all using (
    workspace_id in (select id from workspaces where owner_id = auth.uid())
  );

create trigger workflows_updated_at
  before update on workflows
  for each row execute function update_updated_at();

-- ─── Workflow Steps ──────────────────────────────────────────────────────────
create table workflow_steps (
  id uuid primary key default uuid_generate_v4(),
  workflow_id uuid not null references workflows(id) on delete cascade,
  step_order integer not null,
  step_type text not null check (step_type in ('action', 'delay', 'condition')),
  action_type text,
  action_config jsonb not null default '{}',
  delay_value integer,
  delay_unit text check (delay_unit in ('minutes', 'hours', 'days')),
  condition_field text,
  condition_operator text check (condition_operator in ('equals', 'not_equals', 'contains', 'not_contains')),
  condition_value text,
  on_true_step integer,
  on_false_step integer,
  created_at timestamptz default now()
);

alter table workflow_steps enable row level security;
create policy "Workspace workflow_steps" on workflow_steps
  for all using (
    workflow_id in (
      select id from workflows where workspace_id in (
        select id from workspaces where owner_id = auth.uid()
      )
    )
  );

-- ─── Workflow Executions ─────────────────────────────────────────────────────
create table workflow_executions (
  id uuid primary key default uuid_generate_v4(),
  workflow_id uuid not null references workflows(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  lead_id uuid references leads(id) on delete set null,
  trigger_data jsonb not null default '{}',
  status text not null default 'running' check (status in ('running', 'completed', 'failed', 'waiting')),
  current_step integer not null default 1,
  error_message text,
  started_at timestamptz default now(),
  completed_at timestamptz,
  resume_at timestamptz
);

alter table workflow_executions enable row level security;
create policy "Workspace workflow_executions" on workflow_executions
  for all using (
    workspace_id in (select id from workspaces where owner_id = auth.uid())
  );

-- ─── Workflow Execution Logs ─────────────────────────────────────────────────
create table workflow_execution_logs (
  id uuid primary key default uuid_generate_v4(),
  execution_id uuid not null references workflow_executions(id) on delete cascade,
  step_id uuid references workflow_steps(id) on delete set null,
  step_order integer not null,
  step_type text not null,
  action_type text,
  status text not null check (status in ('success', 'failed', 'skipped')),
  result jsonb default '{}',
  error_message text,
  executed_at timestamptz default now()
);

alter table workflow_execution_logs enable row level security;
create policy "Workspace execution_logs" on workflow_execution_logs
  for all using (
    execution_id in (
      select id from workflow_executions where workspace_id in (
        select id from workspaces where owner_id = auth.uid()
      )
    )
  );
```

---

## Vérification après exécution

Lance cette requête pour vérifier que tout est créé :

```sql
select table_name from information_schema.tables
where table_schema = 'public'
order by table_name;
```

Tu dois voir ces tables :
- `calls`
- `follow_ups`
- `integrations`
- `leads`
- `users`
- `workflow_execution_logs` ← nouveau
- `workflow_executions` ← nouveau
- `workflow_steps` ← nouveau
- `workflows` ← nouveau
- `workspaces`

(`automations` ne doit plus apparaître)

---

## 2. Migration Settings — T-018 (timezone + avatars)

Ajoute la colonne `timezone` aux workspaces et crée le bucket Storage pour les avatars.

```sql
-- T-018: Settings — timezone + avatar storage

-- Add timezone to workspaces
ALTER TABLE workspaces ADD COLUMN timezone TEXT NOT NULL DEFAULT 'Europe/Paris';

-- Storage bucket for avatars
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: user uploads to their own folder {user_id}/
CREATE POLICY "Users can upload their own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can update their own avatar"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete their own avatar"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Avatars are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');
```

### Vérification

```sql
-- Vérifier que timezone existe
SELECT column_name FROM information_schema.columns
WHERE table_name = 'workspaces' AND column_name = 'timezone';

-- Vérifier le bucket
SELECT id FROM storage.buckets WHERE id = 'avatars';
```

---

*Généré le 2026-03-30 — ClosRM*

-- ╔══════════════════════════════════════════════════════════════════════════════╗
-- ║  ClosRM — Migration complète à exécuter en une seule fois                  ║
-- ║  Supabase > SQL Editor > New Query > Coller > Run                          ║
-- ╚══════════════════════════════════════════════════════════════════════════════╝

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. WORKFLOWS (remplace la table automations)
-- ═══════════════════════════════════════════════════════════════════════════════

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

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. SETTINGS — timezone + avatars (T-018)
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE workspaces ADD COLUMN timezone TEXT NOT NULL DEFAULT 'Europe/Paris';

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

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

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. BOOKING CALENDARS & BOOKINGS (T-agenda)
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── Workspace Slugs (for public booking URLs) ──────────────────────────────
create table workspace_slugs (
  workspace_id uuid primary key references workspaces(id) on delete cascade,
  slug text not null unique
);

alter table workspace_slugs enable row level security;
create policy "Workspace slugs" on workspace_slugs
  for all using (
    workspace_id in (select id from workspaces where owner_id = auth.uid())
  );

-- ─── Booking Calendars ──────────────────────────────────────────────────────
create table booking_calendars (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  duration_minutes integer not null default 60,
  location text,
  color text not null default '#3b82f6',
  form_fields jsonb not null default '[
    {"key":"first_name","label":"Prénom","type":"text","required":true},
    {"key":"last_name","label":"Nom","type":"text","required":true},
    {"key":"phone","label":"Téléphone","type":"tel","required":true},
    {"key":"email","label":"Email","type":"email","required":true}
  ]',
  availability jsonb not null default '{}',
  buffer_minutes integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(workspace_id, slug)
);

alter table booking_calendars enable row level security;
create policy "Workspace booking_calendars" on booking_calendars
  for all using (
    workspace_id in (select id from workspaces where owner_id = auth.uid())
  );

create trigger booking_calendars_updated_at
  before update on booking_calendars
  for each row execute function update_updated_at();

-- ─── Bookings ────────────────────────────────────────────────────────────────
create table bookings (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  calendar_id uuid references booking_calendars(id) on delete set null,
  lead_id uuid references leads(id) on delete set null,
  call_id uuid references calls(id) on delete set null,
  title text not null,
  scheduled_at timestamptz not null,
  duration_minutes integer not null,
  status text not null default 'confirmed'
    check (status in ('confirmed', 'cancelled', 'no_show', 'completed')),
  source text not null default 'manual'
    check (source in ('booking_page', 'manual', 'google_sync')),
  form_data jsonb default '{}',
  notes text,
  google_event_id text,
  is_personal boolean not null default false,
  created_at timestamptz default now()
);

alter table bookings enable row level security;
create policy "Workspace bookings" on bookings
  for all using (
    workspace_id in (select id from workspaces where owner_id = auth.uid())
  );

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. BRANDING — accent color + logo workspace (T-020)
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE workspaces
  ADD COLUMN accent_color text NOT NULL DEFAULT '#00C853',
  ADD COLUMN logo_url text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('workspace-logos', 'workspace-logos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "workspace_logos_owner_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'workspace-logos'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM workspaces WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "workspace_logos_owner_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'workspace-logos'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM workspaces WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "workspace_logos_owner_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'workspace-logos'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM workspaces WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "workspace_logos_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'workspace-logos');

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. BOOKING LOCATIONS (migration location text → location_ids)
-- ═══════════════════════════════════════════════════════════════════════════════

create table booking_locations (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  address text,
  is_active boolean not null default true,
  created_at timestamptz default now()
);

alter table booking_locations enable row level security;
create policy "Workspace booking_locations" on booking_locations
  for all using (
    workspace_id in (select id from workspaces where owner_id = auth.uid())
  );

alter table booking_calendars add column location_ids uuid[] not null default '{}';
alter table booking_calendars drop column if exists location;

alter table bookings add column location_id uuid references booking_locations(id) on delete set null;

-- ═══════════════════════════════════════════════════════════════════════════════
-- VERIFICATION FINALE
-- ═══════════════════════════════════════════════════════════════════════════════

-- Décommente et lance séparément pour vérifier :
--
-- select table_name from information_schema.tables
-- where table_schema = 'public'
-- order by table_name;
--
-- Tables attendues :
--   booking_calendars, booking_locations, bookings, calls, follow_ups,
--   integrations, leads, users, workflow_execution_logs, workflow_executions,
--   workflow_steps, workflows, workspace_slugs, workspaces
--
-- (automations ne doit plus apparaître)

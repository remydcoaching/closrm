-- ClosRM — Schéma Supabase
-- À exécuter dans Supabase > SQL Editor

-- Extensions
create extension if not exists "uuid-ossp";

-- ─── Workspaces ───────────────────────────────────────────────────────────────
create table workspaces (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);

alter table workspaces enable row level security;
create policy "Owner access" on workspaces
  for all using (owner_id = auth.uid());

-- ─── Users (profils) ──────────────────────────────────────────────────────────
create table users (
  id uuid primary key references auth.users(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  email text not null,
  role text not null default 'coach' check (role in ('coach', 'setter', 'closer')),
  full_name text not null default '',
  avatar_url text,
  created_at timestamptz default now()
);

alter table users enable row level security;
create policy "Workspace members" on users
  for all using (
    workspace_id in (
      select id from workspaces where owner_id = auth.uid()
    )
  );

-- ─── Leads ────────────────────────────────────────────────────────────────────
create table leads (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  first_name text not null,
  last_name text not null default '',
  phone text not null default '',
  email text,
  status text not null default 'nouveau' check (status in (
    'nouveau', 'setting_planifie', 'no_show_setting',
    'closing_planifie', 'no_show_closing', 'clos', 'dead'
  )),
  source text not null default 'manuel' check (source in (
    'facebook_ads', 'instagram_ads', 'follow_ads', 'formulaire', 'manuel'
  )),
  tags text[] default '{}',
  call_attempts integer not null default 0,
  reached boolean not null default false,
  notes text,
  meta_campaign_id text,
  meta_adset_id text,
  meta_ad_id text,
  instagram_handle text,
  last_activity_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
  -- import_batch_id uuid added by migration 023_lead_import_batches.sql
);

alter table leads enable row level security;
create policy "Workspace leads" on leads
  for all using (
    workspace_id in (
      select id from workspaces where owner_id = auth.uid()
    )
  );

-- Trigger updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger leads_updated_at
  before update on leads
  for each row execute function update_updated_at();

-- ─── Calls ────────────────────────────────────────────────────────────────────
create table calls (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  lead_id uuid not null references leads(id) on delete cascade,
  type text not null check (type in ('setting', 'closing')),
  scheduled_at timestamptz not null,
  outcome text not null default 'pending' check (outcome in ('pending', 'done', 'cancelled', 'no_show')),
  notes text,
  attempt_number integer not null default 1,
  reached boolean not null default false,
  duration_seconds integer,
  closer_id uuid references users(id),
  created_at timestamptz default now()
);

alter table calls enable row level security;
create policy "Workspace calls" on calls
  for all using (
    workspace_id in (
      select id from workspaces where owner_id = auth.uid()
    )
  );

-- ─── Follow-ups ───────────────────────────────────────────────────────────────
create table follow_ups (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  lead_id uuid not null references leads(id) on delete cascade,
  reason text not null,
  scheduled_at timestamptz not null,
  channel text not null default 'manuel' check (channel in ('whatsapp', 'email', 'instagram_dm', 'manuel')),
  status text not null default 'en_attente' check (status in ('en_attente', 'fait', 'annule')),
  notes text,
  created_at timestamptz default now()
);

alter table follow_ups enable row level security;
create policy "Workspace follow_ups" on follow_ups
  for all using (
    workspace_id in (
      select id from workspaces where owner_id = auth.uid()
    )
  );

-- ─── Automations ──────────────────────────────────────────────────────────────
create table automations (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  trigger_type text not null,
  trigger_config jsonb not null default '{}',
  action_type text not null,
  action_config jsonb not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz default now()
);

alter table automations enable row level security;
create policy "Workspace automations" on automations
  for all using (
    workspace_id in (
      select id from workspaces where owner_id = auth.uid()
    )
  );

-- ─── Integrations ─────────────────────────────────────────────────────────────
create table integrations (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  type text not null check (type in ('google_calendar', 'meta', 'whatsapp', 'stripe', 'telegram')),
  credentials_encrypted text,
  meta_page_id text,           -- Pour Meta : ID de la page Facebook, utilisé par le webhook
  connected_at timestamptz,
  is_active boolean not null default false,
  unique(workspace_id, type)
);

alter table integrations enable row level security;
create policy "Workspace integrations" on integrations
  for all using (
    workspace_id in (
      select id from workspaces where owner_id = auth.uid()
    )
  );

-- ─── Fonction : création automatique du workspace à l'inscription ─────────────
create or replace function handle_new_user()
returns trigger as $$
declare
  new_workspace_id uuid;
begin
  -- Créer le workspace
  insert into workspaces (name, owner_id)
  values (
    coalesce(new.raw_user_meta_data->>'full_name', 'Mon workspace') || ' — Workspace',
    new.id
  )
  returning id into new_workspace_id;

  -- Créer le profil utilisateur
  insert into users (id, workspace_id, email, role, full_name)
  values (
    new.id,
    new_workspace_id,
    new.email,
    'coach',
    coalesce(new.raw_user_meta_data->>'full_name', '')
  );

  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ─── Lead Import Batches ──────────────────────────────────────────────────────
-- Tracks each CSV import batch (status, counts, errors, config).
-- Column import_batch_id on leads links imported leads to their batch.
-- Added by migration 023_lead_import_batches.sql
create table lead_import_batches (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  file_name     text not null,
  status        text not null default 'pending'
                check (status in ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  total_rows    int not null default 0,
  created_count int not null default 0,
  updated_count int not null default 0,
  skipped_count int not null default 0,
  error_count   int not null default 0,
  errors        jsonb default '[]'::jsonb,
  config        jsonb not null default '{}'::jsonb,
  created_by    uuid references auth.users(id),
  created_at    timestamptz default now(),
  completed_at  timestamptz
);

alter table lead_import_batches enable row level security;

create policy "Users can view their workspace import batches"
  on lead_import_batches for select
  using (workspace_id in (
    select workspace_id from users where id = auth.uid()
  ));

create policy "Users can insert import batches in their workspace"
  on lead_import_batches for insert
  with check (workspace_id in (
    select workspace_id from users where id = auth.uid()
  ));

create policy "Users can update their workspace import batches"
  on lead_import_batches for update
  using (workspace_id in (
    select workspace_id from users where id = auth.uid()
  ));

create policy "Users can delete their workspace import batches"
  on lead_import_batches for delete
  using (workspace_id in (
    select workspace_id from users where id = auth.uid()
  ));

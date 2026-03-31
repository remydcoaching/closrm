-- Migration 005: Planning templates

create table planning_templates (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  description text,
  blocks jsonb not null default '[]',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table planning_templates enable row level security;
create policy "Workspace planning_templates" on planning_templates
  for all using (
    workspace_id in (select id from workspaces where owner_id = auth.uid())
  );

create trigger planning_templates_updated_at
  before update on planning_templates
  for each row execute function update_updated_at();

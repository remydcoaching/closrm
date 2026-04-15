-- 023_lead_import_batches.sql

-- Table to track import batches
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

-- RLS for lead_import_batches
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

-- Add import_batch_id to leads
alter table leads add column import_batch_id uuid references lead_import_batches(id);

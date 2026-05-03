-- Cache des briefs IA générés avant call (économie crédits)
create table if not exists ai_call_briefs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  lead_id uuid not null references leads(id) on delete cascade,
  booking_id uuid references bookings(id) on delete set null,
  brief_content jsonb not null,
  generated_at timestamptz not null default now(),
  generated_by uuid references users(id),
  unique (lead_id, booking_id)
);

create index if not exists ai_call_briefs_lead_idx
  on ai_call_briefs(lead_id, generated_at desc);

create index if not exists ai_call_briefs_workspace_idx
  on ai_call_briefs(workspace_id);

alter table ai_call_briefs enable row level security;

create policy "ai_call_briefs_workspace_select"
  on ai_call_briefs for select
  using (workspace_id in (
    select workspace_id from workspace_members
    where user_id = auth.uid() and status = 'active'
  ));

create policy "ai_call_briefs_workspace_insert"
  on ai_call_briefs for insert
  with check (workspace_id in (
    select workspace_id from workspace_members
    where user_id = auth.uid() and status = 'active'
  ));

create policy "ai_call_briefs_workspace_update"
  on ai_call_briefs for update
  using (workspace_id in (
    select workspace_id from workspace_members
    where user_id = auth.uid() and status = 'active'
  ));

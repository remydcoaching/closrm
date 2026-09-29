-- supabase/migrations/106_lead_status_history.sql
-- Audit trail for leads.status changes, needed so the unified lead timeline
-- (CLOSRM_DESKTOP_FINAL_VISION.md §8) can show status transitions alongside
-- calls/follow-ups/Instagram interactions. leads.status today is a mutable
-- column with no history — this closes that gap with a trigger rather than
-- relying on fireTriggersForEvent('lead_status_changed', ...), which fires
-- workflow automations (side effects) and is not a durable log by itself.

create table lead_status_history (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  lead_id uuid not null references leads(id) on delete cascade,
  from_status text,
  to_status text not null,
  changed_at timestamptz not null default now()
);

create index idx_lead_status_history_lead on lead_status_history(lead_id, changed_at desc);
create index idx_lead_status_history_workspace on lead_status_history(workspace_id, changed_at desc);

alter table lead_status_history enable row level security;

create policy "Workspace lead_status_history" on lead_status_history
  for all using (
    workspace_id in (select user_workspace_ids())
  );

create or replace function log_lead_status_change()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status then
    insert into lead_status_history (workspace_id, lead_id, from_status, to_status)
    values (new.workspace_id, new.id, old.status, new.status);
  end if;
  return new;
end;
$$;

create trigger trg_lead_status_history
  after update on leads
  for each row
  execute function log_lead_status_change();

comment on table lead_status_history is
  'Append-only audit log of leads.status transitions, written by a trigger — not by application code, so it captures every status change regardless of which route performed the PATCH.';

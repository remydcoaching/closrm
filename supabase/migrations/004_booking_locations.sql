-- Migration 004: Booking locations + calendar location_ids + booking location_id

-- ─── Booking Locations ───────────────────────────────────────────────────────
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

-- ─── Migrate booking_calendars: location text → location_ids uuid[] ─────────
alter table booking_calendars add column location_ids uuid[] not null default '{}';
alter table booking_calendars drop column if exists location;

-- ─── Add location_id to bookings ────────────────────────────────────────────
alter table bookings add column location_id uuid references booking_locations(id) on delete set null;

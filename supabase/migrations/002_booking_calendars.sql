-- Migration 002: Booking calendars & bookings system
-- Run in Supabase > SQL Editor

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

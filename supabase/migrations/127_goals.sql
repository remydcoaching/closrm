-- 127_goals.sql — Objectifs (horizons façon Timestripe)
-- inbox  => period_start IS NULL
-- autres => period_start = premier jour de la période (lundi pour week, 1er du mois/trimestre/année)

create table if not exists public.goals (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  parent_id     uuid references public.goals(id) on delete cascade,
  title         text not null check (char_length(btrim(title)) between 1 and 500),
  description   text,
  horizon       text not null check (horizon in ('day', 'week', 'month', 'quarter', 'year', 'inbox')),
  period_start  date,
  position      double precision not null default 1024,
  done_at       timestamptz,
  color         text check (color in ('yellow', 'pink', 'green', 'blue', 'purple', 'orange')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint goals_inbox_has_no_date check ((horizon = 'inbox') = (period_start is null)),
  constraint goals_not_own_parent check (parent_id is null or parent_id <> id),
  constraint goals_period_aligned check (
    period_start is null
    or (horizon = 'day')
    or (horizon = 'week'    and extract(isodow from period_start) = 1)
    or (horizon = 'month'   and extract(day from period_start) = 1)
    or (horizon = 'quarter' and extract(day from period_start) = 1 and extract(month from period_start) in (1, 4, 7, 10))
    or (horizon = 'year'    and extract(day from period_start) = 1 and extract(month from period_start) = 1)
  )
);

create index if not exists goals_workspace_horizon_period_idx
  on public.goals (workspace_id, horizon, period_start);
create index if not exists goals_parent_idx
  on public.goals (parent_id) where parent_id is not null;

create or replace function public.goals_set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists goals_set_updated_at on public.goals;
create trigger goals_set_updated_at
  before update on public.goals
  for each row execute function public.goals_set_updated_at();

alter table public.goals enable row level security;

drop policy if exists goals_workspace_access on public.goals;
create policy goals_workspace_access on public.goals
  for all
  using (workspace_id in (select user_workspace_ids()))
  with check (workspace_id in (select user_workspace_ids()));

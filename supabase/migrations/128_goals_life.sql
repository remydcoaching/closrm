-- 128_goals_life.sql — Objectifs : horizon « Vie » (sans date, comme l'Inbox)

alter table public.goals drop constraint if exists goals_horizon_check;
alter table public.goals add constraint goals_horizon_check
  check (horizon in ('day', 'week', 'month', 'quarter', 'year', 'life', 'inbox'));

alter table public.goals drop constraint if exists goals_inbox_has_no_date;
alter table public.goals add constraint goals_inbox_has_no_date
  check ((horizon in ('inbox', 'life')) = (period_start is null));

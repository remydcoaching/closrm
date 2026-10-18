-- 131_goals_schedule.sql — Objectifs du jour placés dans l'Agenda
-- scheduled_at     : heure à laquelle l'objectif est placé (NULL = dans le bandeau « Objectifs » du jour)
-- duration_minutes : durée du bloc dans l'Agenda

alter table public.goals add column if not exists scheduled_at timestamptz;
alter table public.goals add column if not exists duration_minutes integer check (duration_minutes is null or duration_minutes between 5 and 1440);

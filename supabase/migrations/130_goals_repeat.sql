-- 130_goals_repeat.sql — Objectifs récurrents (« Poster 10 contenus » chaque semaine)
-- repeats   : cette occurrence se répète à la période suivante de son horizon (jour, semaine, mois)
-- series_id : identifiant commun à toutes les occurrences d'une même répétition
-- target    : nombre visé par période (NULL = simple case à cocher)
-- progress  : avancement de cette occurrence (0/10…)

alter table public.goals add column if not exists repeats boolean not null default false;
alter table public.goals add column if not exists series_id uuid;
alter table public.goals add column if not exists target integer check (target is null or target between 1 and 100000);
alter table public.goals add column if not exists progress integer not null default 0 check (progress >= 0);

-- One occurrence per series and period, even if the page is opened twice at once.
create unique index if not exists goals_series_period_key on public.goals (series_id, period_start);

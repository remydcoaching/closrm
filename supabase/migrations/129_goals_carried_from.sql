-- 129_goals_carried_from.sql — Objectifs : report automatique des objectifs non faits
-- carried_from = la période d'origine d'un objectif reporté (affiché « Reporté du … »),
-- NULL tant qu'il n'a jamais été reporté ou après une replanification à la main.

alter table public.goals add column if not exists carried_from date;

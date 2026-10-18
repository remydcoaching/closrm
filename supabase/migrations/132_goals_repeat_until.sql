-- 132_goals_repeat_until.sql — Objectifs récurrents : durée (« 4 posts par semaine pendant 8 semaines »)
-- repeat_until : dernier jour couvert par la répétition (NULL = sans fin)

alter table public.goals add column if not exists repeat_until date;

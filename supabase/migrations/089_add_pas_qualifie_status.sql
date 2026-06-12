-- 089_add_pas_qualifie_status.sql
-- Étend la contrainte CHECK sur leads.status pour autoriser 'pas_qualifie'.
-- Sans ça, toute mise à jour d'un lead vers ce statut est rejetée par
-- Postgres (« new row violates check constraint leads_status_check »).
--
-- 'pas_qualifie' = profil hors cible (mauvais avatar, hors zone, pas le
-- budget) — différent de 'dead' qui couvre les ghosts et abandons.

alter table public.leads drop constraint if exists leads_status_check;

alter table public.leads add constraint leads_status_check
  check (status in (
    'nouveau',
    'scripte',
    'setting_planifie',
    'no_show_setting',
    'closing_planifie',
    'no_show_closing',
    'clos',
    'pas_qualifie',
    'dead'
  ));

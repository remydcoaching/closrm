-- supabase/migrations/098_dm_session_items_replied_outcome.sql
-- Ajoute 'replied' au check constraint de dm_session_items.outcome : aucune
-- des 3 valeurs existantes (relaunched/archived/skipped) ne représente "le
-- prospect a répondu pendant la session" — nécessaire pour que le mobile
-- puisse enregistrer une transition de process nommée (ex: "repondu") sans
-- bloquer l'item indéfiniment en statut non-traité.

alter table dm_session_items drop constraint if exists dm_session_items_outcome_check;

alter table dm_session_items add constraint dm_session_items_outcome_check
  check (outcome in ('relaunched', 'archived', 'skipped', 'replied'));

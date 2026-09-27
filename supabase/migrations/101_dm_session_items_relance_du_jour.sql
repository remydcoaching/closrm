-- supabase/migrations/101_dm_session_items_relance_du_jour.sql
-- Sépare "relance du jour" (prévue aujourd'hui) de "relance en retard"
-- (prévue avant aujourd'hui) : ce sont deux catégories distinctes côté
-- priorisation (src/lib/dm-sessions/priority.ts), la relance du jour passant
-- désormais en tête de file devant la relance en retard. Nécessaire pour que
-- l'insert de dm_session_items n'échoue plus dès qu'un lead de cette
-- nouvelle catégorie apparaît dans la file.

alter table dm_session_items drop constraint if exists dm_session_items_category_check;

alter table dm_session_items add constraint dm_session_items_category_check
  check (category in (
    'relance_du_jour', 'relance_en_retard', 'engagement_instagram', 'jamais_recontacte', 'premier_message'
  ));

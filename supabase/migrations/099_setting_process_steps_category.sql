-- supabase/migrations/099_setting_process_steps_category.sql
-- Ajoute un lien explicite entre une étape et la catégorie de lead
-- (dm-sessions/priority.ts::PriorityCategory) qu'elle sert, plutôt que de
-- déduire ça implicitement de la position de l'étape parmi les "relance".
--
-- Pourquoi : templates.ts distingue 3 messages réels selon la situation du
-- lead — premier contact (premier_message + engagement_instagram),
-- relance normale (relance_en_retard), et reprise après longue absence
-- (jamais_recontacte). Un mapping basé sur "la Nème étape de type relance"
-- casse silencieusement dès que l'admin réordonne ses étapes (via le drag &
-- drop de l'éditeur) ou en ajoute une nouvelle. La catégorie explicite rend
-- resolveSessionStep() robuste à l'ordre des étapes.
--
-- 'any' = l'étape sert de fallback pour toute catégorie de relance qui n'a
-- pas d'étape dédiée (comportement actuel de pickTemplate quand aucune
-- branche spécifique ne matche).
alter table setting_process_steps
  add column applies_to_category text
  check (applies_to_category is null or applies_to_category in (
    'premier_contact', 'relance_en_retard', 'jamais_recontacte', 'any'
  ));

comment on column setting_process_steps.applies_to_category is
  'Catégorie de lead (regroupée) que cette étape sert quand step_type=relance ou message. NULL/any = fallback générique.';

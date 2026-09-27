-- supabase/migrations/100_backfill_setting_processes.sql
-- Backfill idempotent : crée un process de setting initial pour chaque
-- workspace qui n'en a encore aucun, reproduisant fidèlement le comportement
-- de src/lib/dm-sessions/templates.ts::pickTemplate() :
--   - premier_message / engagement_instagram -> "Premier message"
--   - relance_en_retard                       -> "Relance" générique
--   - jamais_recontacte                       -> "Reprise après une absence"
-- Chaque étape porte sa catégorie explicitement (applies_to_category,
-- migration 099) — resolveSessionStep() choisit ainsi la bonne étape sans
-- dépendre de la position, contrairement à un mapping implicite par ordre.
--
-- IDEMPOTENT : la clause `where not exists (select 1 from setting_processes
-- where workspace_id = w.id)` garantit qu'exécuter cette migration deux fois
-- ne crée aucun doublon — un workspace qui a déjà au moins un process
-- (migré ou créé manuellement par l'admin) est ignoré intégralement.
--
-- NE SUPPRIME RIEN : templates.ts reste en place comme fallback (cf.
-- resolveSessionStep) pour tout workspace dont le process migré serait
-- désactivé ou vidé de ses étapes ensuite.
--
-- LIMITE CONNUE ET ASSUMÉE : le texte "Reprise après {{daysSinceLastContact}}
-- jours" de pickTemplate() calcule le nombre de jours dynamiquement à
-- l'exécution. Le moteur d'étapes ne supporte que le placeholder {{prenom}},
-- pas un compteur de jours dynamique — l'étape migrée pour cette catégorie
-- utilise donc un texte générique sans le nombre de jours exact. Le contenu
-- reste éditable librement par l'admin ensuite.
--
-- VÉRIFICATION MANUELLE (à exécuter contre la DB réelle, cette session n'a
-- pas d'accès Postgres/Docker local) :
--   -- Nombre de workspaces total :
--   select count(*) from workspaces;
--   -- Nombre de workspaces déjà couverts par un process avant la migration :
--   select count(distinct workspace_id) from setting_processes;
--   -- Après migration, tout workspace doit avoir au moins un process :
--   select w.id from workspaces w
--   left join setting_processes p on p.workspace_id = w.id
--   where p.id is null;
--   -- (doit retourner 0 ligne après exécution)
--   -- Détection de doublons (chaque workspace ne doit avoir qu'un seul
--   -- process nommé 'Process initial (migré)') :
--   select workspace_id, count(*) from setting_processes
--   where name = 'Process initial (migré)'
--   group by workspace_id having count(*) > 1;
--   -- (doit retourner 0 ligne, y compris après ré-exécution de cette migration)

do $$
declare
  w record;
  process_id uuid;
  step_premier_id uuid;
  step_relance_id uuid;
  step_reprise_id uuid;
begin
  for w in
    select id as workspace_id
    from workspaces
    where not exists (
      select 1 from setting_processes where workspace_id = workspaces.id
    )
  loop
    insert into setting_processes (workspace_id, name, description, status)
    values (
      w.workspace_id,
      'Process initial (migré)',
      'Créé automatiquement à partir des messages par défaut existants — modifiable librement.',
      'active'
    )
    returning id into process_id;

    insert into setting_process_steps (process_id, position, title, step_type, content, delay_days, applies_to_category)
    values (
      process_id,
      0,
      'Premier message',
      'message',
      'Salut {{prenom}} ! J''ai vu ton profil, je me permets de venir vers toi.',
      null,
      'premier_contact'
    )
    returning id into step_premier_id;

    insert into setting_process_steps (process_id, position, title, step_type, content, delay_days, applies_to_category)
    values (
      process_id,
      1,
      'Relance',
      'relance',
      'Salut {{prenom}}, je reviens vers toi — toujours partant(e) ?',
      3,
      'relance_en_retard'
    )
    returning id into step_relance_id;

    insert into setting_process_steps (process_id, position, title, step_type, content, delay_days, applies_to_category)
    values (
      process_id,
      2,
      'Reprise après une longue absence',
      'relance',
      'Salut {{prenom}}, ça fait un moment ! Je voulais savoir où tu en étais.',
      30,
      'jamais_recontacte'
    )
    returning id into step_reprise_id;

    update setting_process_steps set next_step_id = step_relance_id where id = step_premier_id;
    update setting_process_steps set next_step_id = step_reprise_id where id = step_relance_id;
  end loop;
end $$;

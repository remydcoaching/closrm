-- supabase/migrations/124_internal_tables_rls.sql
-- Tables internes (kanban projet, sprints) créées sans RLS (053, 081) :
-- lisibles ET modifiables par n'importe qui avec la clé anon publique
-- (présente dans le site et l'app). Elles ne sont lues que par le serveur
-- avec la clé service (src/lib/pm, src/lib/sprint, cron pm-archive), qui
-- ignore la RLS : l'activer sans politique ferme l'accès public sans rien casser.
alter table if exists pm_boards enable row level security;
alter table if exists pm_tasks enable row level security;
alter table if exists sprint_weeks enable row level security;
alter table if exists sprint_day_kpis enable row level security;

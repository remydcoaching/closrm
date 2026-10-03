-- supabase/migrations/126_secret_columns.sql
-- Secrets hors de portée des membres du workspace (setter, closer…) :
-- jusqu'ici la RLS par workspace laissait lire, via l'API Supabase, les jetons
-- Meta (ig_accounts.access_token / page_access_token) et la clé IA du coach
-- (ai_coach_briefs.api_key). Le serveur les lit avec la clé service (qui
-- ignore ces droits) ; les clients n'ont accès qu'aux autres colonnes.
-- Toute nouvelle colonne non secrète de ces tables doit être ajoutée au grant.

revoke select on ig_accounts from anon, authenticated;
grant select (
  id, workspace_id, ig_user_id, ig_username, page_id, is_connected, token_expires_at,
  starting_followers, starting_date, starting_monthly_views, starting_engagement, starting_best_reel, created_at
) on ig_accounts to authenticated;

revoke select on ai_coach_briefs from anon, authenticated;
grant select (
  id, workspace_id, offer_description, target_audience, tone, approach, example_messages,
  goal, generated_brief, wins_analyzed, created_at, updated_at
) on ai_coach_briefs to authenticated;

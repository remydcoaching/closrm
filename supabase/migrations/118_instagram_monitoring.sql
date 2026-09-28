-- supabase/migrations/118_instagram_monitoring.sql
-- Suivi des publications (modèle Insyder) : HikerAPI relit périodiquement
-- les likers et commentaires des publications récentes du coach ; chaque
-- geste apparu entre deux passages est enregistré avec l'intervalle où il
-- est apparu (Instagram ne date pas un j'aime ; un commentaire a sa date).
--   instagram_monitor_settings      : activé ou non (NON par défaut : payant), budget
--   instagram_monitored_contents    : état de scan par publication (cache incrémental)
--   instagram_engagement_observations : toutes les personnes observées (lead ou non)
--   instagram_monitor_runs          : journal des passages (coût, résultats, arrêt)
-- Les gestes des leads connus alimentent aussi instagram_interactions
-- (score, parcours, audience) — comme les vues de stories (112).

create table if not exists instagram_monitor_settings (
  workspace_id uuid primary key references workspaces(id) on delete cascade,
  enabled boolean not null default false,
  instagram_username text,
  instagram_user_id text,
  -- Plafond de requêtes HikerAPI facturées par jour (≈ 0,001 $ l'une).
  max_requests_per_day int not null default 300 check (max_requests_per_day between 10 and 5000),
  updated_at timestamptz not null default now()
);

create table if not exists instagram_monitored_contents (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  content_id text not null,
  content_type text not null check (content_type in ('media', 'clip')),
  content_url text,
  thumbnail_url text,
  caption text,
  published_at timestamptz,
  reported_like_count int,
  reported_comment_count int,
  -- Compteur de commentaires lors de la dernière lecture des commentaires :
  -- inchangé → les commentaires ne sont pas relus (88 % du coût chez Insyder).
  comments_read_at_count int,
  likers_seen int not null default 0,
  comments_seen int not null default 0,
  last_scanned_at timestamptz,
  next_scan_at timestamptz not null default now(),
  -- 'ok' = lu (même vide) ; 'error' = illisible au dernier passage (jamais « 0 ») ;
  -- 'not_found' = supprimé / indisponible chez Instagram.
  last_status text check (last_status in ('ok', 'error', 'not_found')),
  last_error text,
  created_at timestamptz not null default now(),
  unique (workspace_id, content_id)
);

create index if not exists idx_monitored_contents_due on instagram_monitored_contents(workspace_id, next_scan_at);

create table if not exists instagram_engagement_observations (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  content_id text not null,
  interaction_type text not null check (interaction_type in ('like', 'comment')),
  instagram_user_id text not null,
  instagram_username text not null,
  full_name text,
  profile_pic_url text,
  -- '' pour un j'aime ; l'id du commentaire pour un commentaire (une
  -- personne peut commenter plusieurs fois).
  dedup_key text not null default '',
  comment_text text,
  -- Date exacte donnée par Instagram (commentaires seulement).
  commented_at timestamptz,
  -- Quand ClosRM l'a vu pour la première fois, et le passage précédent :
  -- le geste a eu lieu entre les deux. previous_scan_at null = vu au premier
  -- passage sur cette publication (antérieur, non daté).
  first_observed_at timestamptz not null default now(),
  previous_scan_at timestamptz,
  matched_lead_id uuid references leads(id) on delete set null,
  unique (workspace_id, content_id, interaction_type, instagram_user_id, dedup_key)
);

create index if not exists idx_engagement_obs_recent on instagram_engagement_observations(workspace_id, first_observed_at desc);
create index if not exists idx_engagement_obs_user on instagram_engagement_observations(workspace_id, instagram_user_id);
create index if not exists idx_engagement_obs_lead on instagram_engagement_observations(workspace_id, matched_lead_id) where matched_lead_id is not null;

create table if not exists instagram_monitor_runs (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  trigger text not null check (trigger in ('cron', 'manual')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'RUNNING' check (status in ('RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED', 'SKIPPED')),
  requests int not null default 0,
  contents_listed int not null default 0,
  contents_scanned int not null default 0,
  new_likes int not null default 0,
  new_comments int not null default 0,
  leads_matched int not null default 0,
  stopped_reason text,
  -- Résultat brut gardé si l'enregistrement échoue (requêtes payées, cf. leçon 2026-09-25).
  metadata jsonb
);

create index if not exists idx_monitor_runs_ws on instagram_monitor_runs(workspace_id, started_at desc);

alter table instagram_monitor_settings enable row level security;
alter table instagram_monitored_contents enable row level security;
alter table instagram_engagement_observations enable row level security;
alter table instagram_monitor_runs enable row level security;

drop policy if exists "Workspace instagram_monitor_settings" on instagram_monitor_settings;
create policy "Workspace instagram_monitor_settings" on instagram_monitor_settings
  for all using (workspace_id in (select user_workspace_ids()));
drop policy if exists "Workspace instagram_monitored_contents" on instagram_monitored_contents;
create policy "Workspace instagram_monitored_contents" on instagram_monitored_contents
  for all using (workspace_id in (select user_workspace_ids()));
drop policy if exists "Workspace instagram_engagement_observations" on instagram_engagement_observations;
create policy "Workspace instagram_engagement_observations" on instagram_engagement_observations
  for all using (workspace_id in (select user_workspace_ids()));
drop policy if exists "Workspace instagram_monitor_runs" on instagram_monitor_runs;
create policy "Workspace instagram_monitor_runs" on instagram_monitor_runs
  for all using (workspace_id in (select user_workspace_ids()));

-- Passage horaire (pg_cron → Vercel, cf. 059). Ne fait rien pour les
-- workspaces où le suivi est désactivé. Même paramètres app.url /
-- app.cron_secret que 059.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('instagram-monitor-tick')
where exists (select 1 from cron.job where jobname = 'instagram-monitor-tick');

select cron.schedule(
  'instagram-monitor-tick',
  '17 * * * *',
  $$
  select net.http_get(
    url := current_setting('app.url', true) || '/api/cron/instagram-monitor',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.cron_secret', true)),
    timeout_milliseconds := 30000
  );
  $$
);

-- Leçon 2026-09-27 : tout cron s'accompagne d'une purge de ses journaux.
select cron.unschedule('purge-cron-logs')
where exists (select 1 from cron.job where jobname = 'purge-cron-logs');

select cron.schedule(
  'purge-cron-logs',
  '30 3 * * *',
  $$
  delete from cron.job_run_details where end_time < now() - interval '3 days';
  delete from net._http_response where created < now() - interval '1 day';
  $$
);

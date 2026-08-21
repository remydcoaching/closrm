-- supabase/migrations/090_apify_watched_posts.sql
-- Table des posts/reels Instagram surveillés pour le tracking d'engagement via Apify.
-- ClosRM ne scrape jamais Instagram lui-même : cette table stocke uniquement les URLs
-- à surveiller, le scraping réel est délégué à l'API Apify (voir 091_apify_runs.sql).

create table apify_watched_posts (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  instagram_post_url text not null,
  instagram_post_code text,
  label text,
  is_active boolean not null default true,
  last_checked_at timestamptz,
  last_run_id text,
  likers_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_apify_watched_posts_workspace on apify_watched_posts(workspace_id);
create index idx_apify_watched_posts_active on apify_watched_posts(workspace_id, is_active) where is_active = true;

alter table apify_watched_posts enable row level security;

create policy "Workspace apify_watched_posts" on apify_watched_posts
  for all using (
    workspace_id in (
      select id from workspaces where owner_id = auth.uid()
    )
  );

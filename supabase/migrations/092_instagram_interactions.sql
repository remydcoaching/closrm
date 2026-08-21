-- supabase/migrations/092_instagram_interactions.sql
-- Événements d'interaction Instagram par lead (likes/commentaires/DMs/mentions),
-- alimentés par le traitement des datasets Apify. Table séparée de funnel_events
-- car funnel_page_id y est NOT NULL (couplage fort au flow web) — inadapté ici.

create table instagram_interactions (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  lead_id uuid not null references leads(id) on delete cascade,
  interaction_type text not null check (interaction_type in ('like', 'comment', 'dm', 'mention')),
  instagram_user_id text,
  instagram_username text not null,
  full_name text,
  profile_url text,
  source_post_id uuid references apify_watched_posts(id),
  source_post_url text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index idx_instagram_interactions_workspace on instagram_interactions(workspace_id);
create index idx_instagram_interactions_lead on instagram_interactions(lead_id);
create index idx_instagram_interactions_last_seen on instagram_interactions(workspace_id, last_seen_at desc);

create unique index instagram_interactions_dedup_uq on instagram_interactions (
  workspace_id,
  lead_id,
  interaction_type,
  coalesce(source_post_id::text, ''),
  coalesce(instagram_user_id, instagram_username)
);

alter table instagram_interactions enable row level security;

create policy "Workspace instagram_interactions" on instagram_interactions
  for all using (
    workspace_id in (select user_workspace_ids())
  );

-- Matching lead <-> compte Instagram : ajoute la colonne id numérique Apify
-- (leads.instagram_handle existe déjà en texte libre, non unique, insuffisant seul)
alter table leads add column instagram_user_id text;

create unique index leads_workspace_ig_user_id_uq
  on leads(workspace_id, instagram_user_id)
  where instagram_user_id is not null;

-- supabase/migrations/093_engagement_scoring_and_source.sql
-- Ajoute 'instagram_engagement' comme source de lead valide, et une table
-- de scoring configurable par workspace (poids par type d'interaction).

alter table leads drop constraint if exists leads_source_check;

alter table leads add constraint leads_source_check
  check (source in (
    'facebook_ads',
    'instagram_ads',
    'follow_ads',
    'formulaire',
    'manuel',
    'funnel',
    'instagram_engagement'
  ));

create table engagement_scoring_rules (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  interaction_type text not null,
  points int not null default 1,
  unique (workspace_id, interaction_type)
);

alter table engagement_scoring_rules enable row level security;

create policy "Workspace engagement_scoring_rules" on engagement_scoring_rules
  for all using (
    workspace_id in (select user_workspace_ids())
  );

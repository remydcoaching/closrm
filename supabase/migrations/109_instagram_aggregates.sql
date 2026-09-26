-- supabase/migrations/109_instagram_aggregates.sql
-- Server-side aggregates for the Instagram pages (Audience, Leads cards,
-- Contenu). The API used to page every instagram_interactions /
-- discovery_interactions row into Node to group them — expensive on a small
-- instance (the database went unresponsive on 2026-09-26 while these pages
-- were in use). Grouping happens in Postgres now, one row per lead/content.
--
-- security invoker: RLS still applies (workspace_id in user_workspace_ids()),
-- the explicit p_workspace filter only narrows further.
-- NOTE: renumber after develop's migrations when rebasing (see 104).

-- One row per engaged lead: last interaction and interaction count.
create or replace function instagram_engaged_leads(p_workspace uuid)
returns table (lead_id uuid, last_seen_at timestamptz, interactions_count bigint)
language sql
stable
security invoker
as $$
  select lead_id, max(last_seen_at), count(*)
  from instagram_interactions
  where workspace_id = p_workspace
  group by lead_id
$$;

-- Observed likers / commenters / known leads per (run, content).
create or replace function discovery_content_observed(p_workspace uuid, p_run_ids uuid[])
returns table (discovery_run_id uuid, content_id text, likers bigint, commenters bigint, leads bigint)
language sql
stable
security invoker
as $$
  select
    di.discovery_run_id,
    di.content_id,
    count(distinct di.instagram_username) filter (where di.interaction_type = 'like'),
    count(distinct di.instagram_username) filter (where di.interaction_type = 'comment'),
    count(distinct dp.matched_lead_id)
  from discovery_interactions di
  left join discovery_profiles dp
    on dp.discovery_run_id = di.discovery_run_id
   and dp.instagram_username = di.instagram_username
   and dp.matched_lead_id is not null
  where di.workspace_id = p_workspace
    and di.discovery_run_id = any (p_run_ids)
  group by di.discovery_run_id, di.content_id
$$;

create index if not exists idx_instagram_interactions_ws_lead on instagram_interactions(workspace_id, lead_id);
create index if not exists idx_discovery_profiles_run_username on discovery_profiles(discovery_run_id, instagram_username);

-- Distinct (content, lead) pairs: leads reached by each content, from
-- Ciblage observations (latest runs passed in) and from instagram_interactions.
-- Powers the Contenu page's "Niveau de confiance" filter.
create or replace function instagram_content_leads(p_workspace uuid, p_run_ids uuid[])
returns table (content_id text, lead_id uuid)
language sql
stable
security invoker
as $$
  select distinct di.content_id, dp.matched_lead_id
  from discovery_interactions di
  join discovery_profiles dp
    on dp.discovery_run_id = di.discovery_run_id
   and dp.instagram_username = di.instagram_username
  where di.workspace_id = p_workspace
    and di.discovery_run_id = any (p_run_ids)
    and dp.matched_lead_id is not null
  union
  select distinct ii.source_post_id::text, ii.lead_id
  from instagram_interactions ii
  where ii.workspace_id = p_workspace
    and ii.source_post_id is not null
$$;

-- Caption of each scanned content (shown as its title in Contenu).
alter table discovery_contents add column if not exists caption text;

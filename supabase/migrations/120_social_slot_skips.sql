-- supabase/migrations/120_social_slot_skips.sql
-- Créneaux de la trame supprimés par le coach dans le calendrier éditorial.
-- La génération (POST /api/social/trame/generate) évite les doublons en
-- regardant les créneaux existants : un créneau supprimé revenait donc à la
-- génération suivante. On mémorise sa clé (date, type, position, pilier)
-- pour que la génération le saute. Supprimer une ligne ici le fait revenir.

create table if not exists social_slot_skips (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  plan_date date not null,
  content_kind text not null,
  slot_index int not null,
  -- '' quand le créneau n'a pas de pilier (contrainte unique simple, ciblable par PostgREST).
  pillar_id text not null default '',
  created_at timestamptz not null default now(),
  unique (workspace_id, plan_date, content_kind, slot_index, pillar_id)
);

create index if not exists idx_social_slot_skips_dates on social_slot_skips(workspace_id, plan_date);

alter table social_slot_skips enable row level security;

drop policy if exists "Workspace social_slot_skips" on social_slot_skips;
create policy "Workspace social_slot_skips" on social_slot_skips
  for all using (workspace_id in (select user_workspace_ids()));

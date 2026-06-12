-- 088_ads_health_thresholds.sql
-- Per-workspace configurable health thresholds for the Publicités KPIs.
-- Replaces the hardcoded values in src/.../health-thresholds.ts. Each
-- coach can tune the green/orange/red cutoffs for the KPIs that matter
-- to their business model.
--
-- One row per workspace, all thresholds in a single JSONB blob so we can
-- evolve the shape without migrations. Default values are applied at
-- read time by the frontend if a key is missing.

create table if not exists public.ads_health_thresholds (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  thresholds jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.ads_health_thresholds enable row level security;

create policy "ads_health_thresholds_workspace"
  on public.ads_health_thresholds
  for all
  using (
    workspace_id in (select id from public.workspaces where owner_id = auth.uid())
  );

comment on table public.ads_health_thresholds is
  'Per-workspace configurable health thresholds for the Publicités KPIs (CPL, ROAS, CTR, CR1/2/3, etc.). One row per workspace.';
comment on column public.ads_health_thresholds.thresholds is
  'JSONB shape: { [kpiKey]: { green: { op: "<"|">", value: number }, orange: { min: number, max: number } } }. Reds derived as "the rest". See src/.../health-thresholds.ts for defaults.';

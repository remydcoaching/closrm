-- 086_integrations_meta_pixel_id.sql
-- Workspace-level fallback Meta Pixel for non-funnel flows: a coach whose
-- prospect arrives via Meta Lead Form and then clicks the direct calendar
-- link (/book/<workspace>/<calendar>) — that page has no funnel, hence no
-- funnel.meta_pixel_id to use. This column is the fallback used by the
-- CAPI resolver and by the direct booking page's browser pixel script.

alter table public.integrations
  add column if not exists meta_pixel_id text;

comment on column public.integrations.meta_pixel_id is
  'Workspace-level fallback Meta Pixel ID. Used by /book/<ws>/<cal> direct booking pages (no funnel) and by CAPI when the lead has no funnel attribution.';

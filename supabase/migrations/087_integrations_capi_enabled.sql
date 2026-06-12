-- 087_integrations_capi_enabled.sql
-- Single workspace-level toggle that gates ALL server-side CAPI events
-- (Schedule on bookings, Lead on qualification, Purchase on close).
-- When off, the browser pixel still fires — only the server-to-server
-- relay stops. Useful for coaches who don't want their lead status
-- changes mirrored to Meta automatically.

alter table public.integrations
  add column if not exists capi_enabled boolean default true;

comment on column public.integrations.capi_enabled is
  'When false, the server-side Conversions API relay is disabled for this workspace. Browser pixel is unaffected. Default true.';

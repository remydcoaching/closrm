-- 085_funnel_page_meta_event.sql
-- Per-page configurable Meta Pixel event fired in addition to the default
-- PageView. Used for the "lead qualifié quand il arrive sur la page" use
-- case (e.g., the page that visitors reach after passing a pre-filter).
--
-- Stored as a small JSONB so the friendly choice ('lead', 'registration',
-- 'custom' + name…) survives roundtrips with the funnel-events catalog.

alter table public.funnel_pages
  add column if not exists meta_event jsonb;

comment on column public.funnel_pages.meta_event is
  'Optional Meta Pixel event fired on page view (in addition to the auto PageView). Shape: { type: MetaEventChoice, customName?: string }. NULL = no extra event.';

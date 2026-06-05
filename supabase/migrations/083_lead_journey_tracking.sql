-- 083_lead_journey_tracking.sql
-- Lead journey: attribution + form answers + visitor link.
--
-- Adds:
--   leads.visitor_id     — cookie ID set on funnel pages, used to join with funnel_events
--   leads.form_answers   — JSONB blob of full Meta Lead Form answers (custom questions)
-- Plus an index on visitor_id so the journey lookup is cheap.

alter table public.leads
  add column if not exists visitor_id text,
  add column if not exists form_answers jsonb default '{}'::jsonb;

create index if not exists idx_leads_visitor_id
  on public.leads (visitor_id)
  where visitor_id is not null;

comment on column public.leads.visitor_id is
  'Anonymous cookie ID (_closrm_vid) captured at funnel form submission. Used to join funnel_events for the lead journey timeline.';

comment on column public.leads.form_answers is
  'Full answers to Meta Lead Form custom questions (key → value). Standard fields (first_name, last_name, email, phone) are duplicated here for completeness.';

ALTER TABLE sprint_day_kpis
  ADD COLUMN focus_theme        text,
  ADD COLUMN focus_emoji        text,
  ADD COLUMN focus_description  text,
  ADD COLUMN schedule_blocks    jsonb;

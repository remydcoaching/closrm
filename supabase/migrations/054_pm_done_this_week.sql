-- Migration 054: Add "done_this_week" status to PM kanban
-- Tasks marked done go to "done_this_week" first.
-- Every Monday at 08:00, a cron moves them to "done".

-- Drop ALL existing check constraints on pm_tasks.status
-- (the inline CHECK from 053 has an auto-generated name we can't predict)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    WHERE rel.relname = 'pm_tasks'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) LIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.pm_tasks DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.pm_tasks ADD CONSTRAINT pm_tasks_status_check
  CHECK (status IN ('todo', 'in_progress', 'done', 'done_this_week', 'blocked'));

-- Update trigger to handle done_this_week
CREATE OR REPLACE FUNCTION public.pm_set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  IF NEW.status IN ('done', 'done_this_week') AND OLD.status NOT IN ('done', 'done_this_week') THEN
    NEW.completed_at = now();
  ELSIF NEW.status NOT IN ('done', 'done_this_week') THEN
    NEW.completed_at = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

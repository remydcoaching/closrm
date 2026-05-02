-- Schedule booking reminders processing every minute via pg_cron + pg_net.
-- This bypasses the Vercel Hobby cron limitation (max 1x/day) by triggering
-- the Vercel endpoint from Postgres itself.
--
-- BEFORE the cron will actually fire, you MUST set two database parameters
-- (one-time, via the Supabase SQL editor or psql):
--
--   ALTER DATABASE postgres SET app.url = 'https://closrm.fr';
--   ALTER DATABASE postgres SET app.cron_secret = '<value of CRON_SECRET env var>';
--
-- These are read at cron-fire time via current_setting(). They cannot live in
-- this migration because they are environment-specific secrets.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Drop any pre-existing schedule with the same name (safe to re-run)
SELECT cron.unschedule('booking-reminders-tick')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'booking-reminders-tick');

-- Schedule the cron — every minute
SELECT cron.schedule(
  'booking-reminders-tick',
  '* * * * *',
  $$
  SELECT net.http_get(
    url := current_setting('app.url', true) || '/api/cron/booking-reminders',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.cron_secret', true)
    ),
    timeout_milliseconds := 30000
  );
  $$
);

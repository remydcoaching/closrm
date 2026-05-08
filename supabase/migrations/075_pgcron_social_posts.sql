-- Schedule social posts publication via pg_cron + pg_net.
-- Bypass Vercel Hobby cron limitation (max 1x/day) by triggering the
-- Vercel endpoint /api/cron/social-posts from Postgres every 5 minutes.
--
-- Same pattern as 059_pgcron_booking_reminders.sql — reuses the
-- app.url + app.cron_secret database settings already configured.
--
-- If those settings are not yet set on this DB:
--   ALTER DATABASE postgres SET app.url = 'https://closrm.fr';
--   ALTER DATABASE postgres SET app.cron_secret = '<value of CRON_SECRET env var>';

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Drop any pre-existing schedule with the same name (safe to re-run)
SELECT cron.unschedule('social-posts-tick')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'social-posts-tick');

-- Schedule the cron — every 5 minutes
-- (publication latency = max 5 min après l'heure programmée)
SELECT cron.schedule(
  'social-posts-tick',
  '*/5 * * * *',
  $$
  SELECT net.http_get(
    url := current_setting('app.url', true) || '/api/cron/social-posts',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.cron_secret', true)
    ),
    timeout_milliseconds := 300000
  );
  $$
);

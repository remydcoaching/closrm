-- Planifie le lancement des runs Apify (toutes les 30 min) et le polling des
-- résultats (toutes les 5 min) via les endpoints cron correspondants.
--
-- Reuses the app.url + app.cron_secret database settings already configured
-- in prior migrations (059_pgcron_booking_reminders.sql, 075_pgcron_social_posts.sql).
--
-- If those settings are not yet set on this DB:
--   ALTER DATABASE postgres SET app.url = 'https://closrm.fr';
--   ALTER DATABASE postgres SET app.cron_secret = '<value of CRON_SECRET env var>';

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Drop any pre-existing schedule with the same name (safe to re-run)
SELECT cron.unschedule('apify-launch-runs')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'apify-launch-runs');

-- Schedule Apify run launch — every 30 minutes
SELECT cron.schedule(
  'apify-launch-runs',
  '*/30 * * * *',
  $$
  SELECT net.http_get(
    url := current_setting('app.url', true) || '/api/cron/apify-instagram-likes',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.cron_secret', true)
    ),
    timeout_milliseconds := 30000
  );
  $$
);

-- Drop any pre-existing schedule with the same name (safe to re-run)
SELECT cron.unschedule('apify-poll-results')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'apify-poll-results');

-- Schedule Apify result polling — every 5 minutes
SELECT cron.schedule(
  'apify-poll-results',
  '*/5 * * * *',
  $$
  SELECT net.http_get(
    url := current_setting('app.url', true) || '/api/cron/apify-poll-results',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.cron_secret', true)
    ),
    timeout_milliseconds := 60000
  );
  $$
);

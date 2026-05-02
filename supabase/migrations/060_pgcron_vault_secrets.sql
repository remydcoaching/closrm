-- Replace the booking-reminders cron (from migration 059) so it reads its
-- secrets from Supabase Vault instead of current_setting/ALTER DATABASE,
-- which is locked down on hosted Supabase.
--
-- BEFORE the cron will fire, you MUST insert two secrets into Vault
-- (one-time, via the Supabase SQL editor):
--
--   SELECT vault.create_secret('https://closrm.fr', 'app_url');
--   SELECT vault.create_secret('<value of CRON_SECRET>', 'app_cron_secret');

-- Drop previous schedule (no-op if missing)
SELECT cron.unschedule('booking-reminders-tick')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'booking-reminders-tick');

-- Re-schedule using Vault-backed secrets
SELECT cron.schedule(
  'booking-reminders-tick',
  '* * * * *',
  $$
  SELECT net.http_get(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'app_url' LIMIT 1) || '/api/cron/booking-reminders',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'app_cron_secret' LIMIT 1)
    ),
    timeout_milliseconds := 30000
  );
  $$
);

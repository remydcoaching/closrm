-- ═════════════════════════════════════════════════════════
-- pg_cron trigger for /api/cron/social-posts every minute
-- ═════════════════════════════════════════════════════════
-- Prérequis : extensions pg_cron + pg_net activées dans Supabase
-- (Database → Extensions → pg_cron + pg_net)
--
-- Variables à substituer AVANT d'exécuter ce fichier :
--   :app_url          → ex 'https://closrm.vercel.app'
--   :cron_secret      → la valeur de CRON_SECRET (meme que Vercel)
--
-- Exécution :
--   psql "$DATABASE_URL" \
--     -v app_url="'https://closrm.vercel.app'" \
--     -v cron_secret="'XXX'" \
--     -f 035_pg_cron_social_posts.sql
--
-- Ou directement dans Supabase Studio SQL editor en remplaçant les :vars
-- ═════════════════════════════════════════════════════════

-- 1. Unschedule old job if it exists (ig_drafts legacy cron)
DO $$
BEGIN
  PERFORM cron.unschedule('ig-scheduled-posts-every-minute');
EXCEPTION WHEN OTHERS THEN
  -- job doesn't exist, ignore
  NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('social-posts-every-minute');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- 2. Schedule new job hitting /api/cron/social-posts every minute
SELECT cron.schedule(
  'social-posts-every-minute',
  '* * * * *',
  format(
    $cmd$
    SELECT net.http_get(
      url := %L,
      headers := jsonb_build_object(
        'Authorization', %L,
        'Content-Type', 'application/json'
      ),
      timeout_milliseconds := 60000
    );
    $cmd$,
    :app_url || '/api/cron/social-posts',
    'Bearer ' || :cron_secret
  )
);

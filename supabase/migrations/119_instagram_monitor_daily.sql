-- supabase/migrations/119_instagram_monitor_daily.sql
-- Le suivi des publications (118) passe d'un passage par heure à un par
-- jour (6 h 17 UTC) : Insyder relit toutes les heures, mais au tarif
-- HikerAPI une fois par jour divise le coût par ~24. Les publications de
-- moins de 60 jours sont relues à chaque passage, les plus anciennes une
-- fois par semaine (src/lib/instagram/monitor/policy.ts).
select cron.unschedule('instagram-monitor-tick')
where exists (select 1 from cron.job where jobname = 'instagram-monitor-tick');

select cron.schedule(
  'instagram-monitor-tick',
  '17 6 * * *',
  $$
  select net.http_get(
    url := current_setting('app.url', true) || '/api/cron/instagram-monitor',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.cron_secret', true)),
    timeout_milliseconds := 30000
  );
  $$
);

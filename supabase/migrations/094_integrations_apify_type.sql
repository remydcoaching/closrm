-- supabase/migrations/094_integrations_apify_type.sql
-- Ajoute 'apify' aux types d'intégration valides, pour stocker le token API
-- Apify chiffré (réutilise integrations.credentials_encrypted existant).

alter table integrations drop constraint if exists integrations_type_check;

alter table integrations add constraint integrations_type_check
  check (type in ('google_calendar', 'meta', 'whatsapp', 'stripe', 'telegram', 'youtube', 'apify'));

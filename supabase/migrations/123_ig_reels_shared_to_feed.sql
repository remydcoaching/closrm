-- supabase/migrations/123_ig_reels_shared_to_feed.sql
-- Réels d'essai : l'API Meta ne les signale pas directement, mais expose
-- is_shared_to_feed. false = le réel n'apparaît que dans l'onglet Réels,
-- pas sur la grille du profil (réel d'essai pas encore publié aux abonnés,
-- ou réel partagé dans l'onglet Réels uniquement). null = inconnu (pas
-- encore resynchronisé, ou publication qui n'est pas un réel).
alter table ig_reels add column if not exists is_shared_to_feed boolean;

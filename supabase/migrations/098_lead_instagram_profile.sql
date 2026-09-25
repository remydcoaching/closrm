-- supabase/migrations/098_lead_instagram_profile.sql
-- Persists the Instagram profile fields Hiker already returns from
-- getUserByUsername (HikerUserProfile) but that persistDiscoveryResult
-- currently discards after the HTTP call completes. Today these fields
-- exist only in memory for the duration of one discovery request.
--
-- All columns nullable, no backfill required, no existing route broken —
-- this is additive only. `instagram_profile_synced_at` lets the UI show
-- "last synced" instead of implying a live value (Hiker data is a
-- point-in-time snapshot, never real-time — see HIKER_POC_REPORT.md).

alter table leads add column if not exists instagram_followers_count integer;
alter table leads add column if not exists instagram_following_count integer;
alter table leads add column if not exists instagram_is_verified boolean;
alter table leads add column if not exists instagram_is_private boolean;
alter table leads add column if not exists instagram_profile_pic_url text;
alter table leads add column if not exists instagram_bio text;
alter table leads add column if not exists instagram_profile_synced_at timestamptz;

comment on column leads.instagram_profile_synced_at is
  'Timestamp of the last Hiker discovery that refreshed this lead''s Instagram profile fields. NULL means these fields have never been populated — never presented as live/real-time data in the UI.';

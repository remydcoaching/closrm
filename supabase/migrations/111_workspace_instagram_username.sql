-- supabase/migrations/111_workspace_instagram_username.sql
-- The coach's own Instagram account (handle) — asked once after login in
-- ClosRM Desktop and used by every Hiker-powered feature (Ciblage of the
-- coach's account, Audience, Contenu, Monitoring). Independent from the
-- Meta OAuth connection (ig_accounts), which Hiker does not need.
--
alter table workspaces add column if not exists instagram_username text;

comment on column workspaces.instagram_username is
  'Instagram handle (without @) of the coach account analysed through Hiker. Set from the desktop onboarding / header.';

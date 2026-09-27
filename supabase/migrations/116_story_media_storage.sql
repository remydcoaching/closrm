-- supabase/migrations/116_story_media_storage.sql
-- Copies of the coach's own story media (image + video) taken while the
-- Instagram CDN links are still valid (they expire after a few days), so
-- collected stories stay viewable in ClosRM. Paths are random per story.
insert into storage.buckets (id, name, public)
values ('story-media', 'story-media', true)
on conflict (id) do nothing;

alter table story_view_stories add column if not exists image_url text;
alter table story_view_stories add column if not exists video_url text;

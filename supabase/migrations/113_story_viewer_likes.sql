-- supabase/migrations/113_story_viewer_likes.sql
-- Whether a story viewer also liked the story (heart reaction), as reported
-- by Instagram's viewer list for the account owner. Powers the "Réactions"
-- figure and the gesture icons on a story's page.
alter table story_viewers add column if not exists has_liked boolean;

-- supabase/migrations/122_monitor_likes_read.sql
-- Publication monitor driven by Meta's like counter: Meta gives the exact
-- like count of every reel for free each night; HikerAPI (paid) re-reads a
-- reel's likers only when that count went up since the last read.
alter table instagram_monitored_contents add column if not exists likes_read_at_count int;

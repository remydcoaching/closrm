-- ═════════════════════════════════════════════════════════════════════
-- 070 — Bump content-drafts bucket file size limit to 250 MB
--
-- Default Supabase bucket limit was 50 MB, trop court pour les Reels HD
-- (60s 1080p ~120 MB, 90s ~180 MB).
-- 250 MB couvre 95% des cas Instagram (Reels jusqu'a 90s en 1080p 60fps).
-- ═════════════════════════════════════════════════════════════════════

UPDATE storage.buckets
   SET file_size_limit = 262144000  -- 250 MB en bytes
 WHERE id = 'content-drafts';

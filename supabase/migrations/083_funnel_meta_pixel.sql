-- supabase/migrations/083_funnel_meta_pixel.sql
ALTER TABLE funnels ADD COLUMN meta_pixel_id TEXT;

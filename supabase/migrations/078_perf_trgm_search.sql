-- Index trigram (pg_trgm + GIN) sur les colonnes recherchées en `ilike '%q%'`.
-- Sans ça, le search dans /leads et /base-de-donnees fait un seq scan sur toute
-- la table à chaque keystroke. Avec un GIN trigram, c'est en O(log n).
-- L'extension pg_trgm est dispo nativement sur Supabase.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Leads : recherche par prénom, nom, email, téléphone, instagram_handle
CREATE INDEX IF NOT EXISTS idx_leads_first_name_trgm
  ON public.leads USING gin (first_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_leads_last_name_trgm
  ON public.leads USING gin (last_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_leads_email_trgm
  ON public.leads USING gin (email gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_leads_phone_trgm
  ON public.leads USING gin (phone gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_leads_instagram_handle_trgm
  ON public.leads USING gin (instagram_handle gin_trgm_ops);

-- yt_videos : recherche dans le titre
CREATE INDEX IF NOT EXISTS idx_yt_videos_title_trgm
  ON public.yt_videos USING gin (title gin_trgm_ops);

-- Index composite supplémentaire : leads filtrés par assigned_to (cas team)
CREATE INDEX IF NOT EXISTS idx_leads_workspace_assigned_to
  ON public.leads(workspace_id, assigned_to)
  WHERE assigned_to IS NOT NULL;

-- bookings : index sur status pour les filtres rapides
CREATE INDEX IF NOT EXISTS idx_bookings_workspace_status
  ON public.bookings(workspace_id, status);

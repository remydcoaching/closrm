-- ═════════════════════════════════════════════════════════════════════
-- 074 — Montage final versioning + deadline
--
-- 1) final_versions JSONB[] : historise chaque livraison du monteur
--    [{version: 1, url: '...', uploaded_at: '...', uploaded_by: <uuid>},
--     {version: 2, url: '...', uploaded_at: '...', uploaded_by: <uuid>}]
--    final_url reste = derniere version (pour compat lecteur + auto-fill
--    media_urls a la validation).
--
-- 2) montage_deadline TIMESTAMPTZ : delai donne au monteur. Vide = pas
--    de pression. Le monteur voit un badge urgence sur sa kanban.
-- ═════════════════════════════════════════════════════════════════════

ALTER TABLE social_posts
  ADD COLUMN IF NOT EXISTS final_versions JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS montage_deadline TIMESTAMPTZ;

-- Trigger: quand final_url change (non-null → non-null nouveau ou
-- null → non-null), append une nouvelle entree a final_versions.
-- N'append PAS quand final_url passe de X a NULL (= suppression).
-- N'append PAS si la nouvelle URL existe deja dans le tableau (idempotent).
CREATE OR REPLACE FUNCTION append_final_version()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  next_version INT;
  url_exists BOOLEAN;
BEGIN
  -- Skip si pas de nouveau final_url ou si null
  IF NEW.final_url IS NULL OR NEW.final_url = '' THEN
    RETURN NEW;
  END IF;
  -- Skip si pas de changement
  IF OLD.final_url IS NOT DISTINCT FROM NEW.final_url THEN
    RETURN NEW;
  END IF;
  -- Skip si l'URL existe deja dans le tableau (re-set du meme path)
  SELECT EXISTS (
    SELECT 1 FROM jsonb_array_elements(NEW.final_versions) v
    WHERE v->>'url' = NEW.final_url
  ) INTO url_exists;
  IF url_exists THEN
    RETURN NEW;
  END IF;
  -- Calcule le prochain numero de version
  next_version := COALESCE(jsonb_array_length(NEW.final_versions), 0) + 1;
  -- Append
  NEW.final_versions := COALESCE(NEW.final_versions, '[]'::jsonb)
    || jsonb_build_object(
      'version', next_version,
      'url', NEW.final_url,
      'uploaded_at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'uploaded_by', auth.uid()
    );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS append_final_version_trigger ON social_posts;
CREATE TRIGGER append_final_version_trigger
  BEFORE INSERT OR UPDATE OF final_url ON social_posts
  FOR EACH ROW EXECUTE FUNCTION append_final_version();

-- Backfill : pour les slots existants qui ont deja un final_url mais pas
-- de final_versions, on cree une V1 retroactive.
UPDATE social_posts
SET final_versions = jsonb_build_array(
  jsonb_build_object(
    'version', 1,
    'url', final_url,
    'uploaded_at', to_char(COALESCE(updated_at, created_at) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'uploaded_by', NULL
  )
)
WHERE final_url IS NOT NULL
  AND final_url != ''
  AND (final_versions IS NULL OR jsonb_array_length(final_versions) = 0);

-- Empeche le monteur de modifier final_versions ou montage_deadline.
-- Etend prevent_monteur_unsafe_update pour les nouveaux champs.
CREATE OR REPLACE FUNCTION prevent_monteur_unsafe_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF is_monteur_in_workspace(OLD.workspace_id) THEN
    IF NEW.production_status NOT IN ('filmed', 'edited') THEN
      RAISE EXCEPTION 'Le monteur ne peut transitionner qu''entre filmed et edited (tenté: %)', NEW.production_status;
    END IF;
    IF NEW.workspace_id IS DISTINCT FROM OLD.workspace_id
       OR NEW.created_by IS DISTINCT FROM OLD.created_by
       OR NEW.monteur_id IS DISTINCT FROM OLD.monteur_id
       OR NEW.hook IS DISTINCT FROM OLD.hook
       OR NEW.script IS DISTINCT FROM OLD.script
       OR NEW.rush_url IS DISTINCT FROM OLD.rush_url
       OR NEW.title IS DISTINCT FROM OLD.title
       OR NEW.caption IS DISTINCT FROM OLD.caption
       OR NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at
       OR NEW.references_urls IS DISTINCT FROM OLD.references_urls
       OR NEW.notes IS DISTINCT FROM OLD.notes
       OR NEW.content_kind IS DISTINCT FROM OLD.content_kind
       OR NEW.montage_deadline IS DISTINCT FROM OLD.montage_deadline
    THEN
      RAISE EXCEPTION 'Le monteur ne peut modifier que le statut, le lien final, les notes éditeur et les media';
    END IF;
  END IF;
  IF NEW.production_status = 'filmed'
     AND OLD.production_status IN ('edited', 'ready') THEN
    NEW.coach_notified_at := NULL;
  END IF;
  IF NEW.monteur_id IS DISTINCT FROM OLD.monteur_id
     OR (NEW.production_status = 'filmed' AND OLD.production_status IN ('edited', 'ready')) THEN
    NEW.monteur_notified_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

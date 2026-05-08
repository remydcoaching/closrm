-- ═════════════════════════════════════════════════════════════════════
-- 073 — Etend le trigger monteur_guard pour reset les flags de notif
--       aussi quand on revient depuis 'ready' (= retouches demandees apres
--       validation).
--
-- Bug avant: trigger reset coach_notified_at + monteur_notified_at uniquement
-- sur edited→filmed. Donc le cycle ready→filmed→edited→ready ne re-notifiait
-- jamais le coach (coach_notified_at restait set de la 1ere boucle).
-- ═════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION prevent_monteur_unsafe_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Si l'updater est un monteur (pas le owner), bloquer toute modif hors
  -- (production_status filmed↔edited, final_url, editor_notes, media_urls).
  IF is_monteur_in_workspace(OLD.workspace_id) THEN
    -- Block toute transition de production_status hors filmed↔edited
    IF NEW.production_status NOT IN ('filmed', 'edited') THEN
      RAISE EXCEPTION 'Le monteur ne peut transitionner qu''entre filmed et edited (tenté: %)', NEW.production_status;
    END IF;
    -- Block tout changement hors champs autorisés
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
    THEN
      RAISE EXCEPTION 'Le monteur ne peut modifier que le statut, le lien final, les notes éditeur et les media';
    END IF;
  END IF;
  -- Reset coach_notified_at si le coach repasse a filmed depuis edited OU ready
  -- (= demande de retouches, le monteur va remontrer une nouvelle version)
  IF NEW.production_status = 'filmed'
     AND OLD.production_status IN ('edited', 'ready') THEN
    NEW.coach_notified_at := NULL;
  END IF;
  -- Reset monteur_notified_at si le coach change le monteur (réassignation)
  -- ou repasse en filmed depuis edited/ready (re-montage). Le monteur recoit
  -- l'email de retouches demandees (notifyMonteurRevisionRequested).
  IF NEW.monteur_id IS DISTINCT FROM OLD.monteur_id
     OR (NEW.production_status = 'filmed' AND OLD.production_status IN ('edited', 'ready')) THEN
    NEW.monteur_notified_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

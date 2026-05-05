-- ═════════════════════════════════════════════════════════════════════
-- 065 — Monteur role + assignment fields on social_posts
--
-- 1) Étend l'enum role de workspace_members avec 'monteur'
-- 2) Ajoute monteur_id, rush_url, final_url, editor_notes,
--    monteur_notified_at, coach_notified_at sur social_posts
-- 3) RLS spécifique monteur :
--    - Voit/modifie UNIQUEMENT ses slots assignés en filmed/edited/ready
--    - Ne peut PAS passer un slot edited → ready (réservé au coach)
--    - Ne peut PAS modifier hook/script/pillar_id/plan_date/monteur_id
-- ═════════════════════════════════════════════════════════════════════

-- ─── 1) Role enum élargi ─────────────────────────────────────────────
ALTER TABLE workspace_members DROP CONSTRAINT IF EXISTS workspace_members_role_check;
ALTER TABLE workspace_members ADD CONSTRAINT workspace_members_role_check
  CHECK (role IN ('admin', 'setter', 'closer', 'monteur'));

-- ─── 2) Colonnes sur social_posts ────────────────────────────────────
ALTER TABLE social_posts
  ADD COLUMN IF NOT EXISTS monteur_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rush_url TEXT,
  ADD COLUMN IF NOT EXISTS final_url TEXT,
  ADD COLUMN IF NOT EXISTS editor_notes TEXT,
  ADD COLUMN IF NOT EXISTS monteur_notified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS coach_notified_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_social_posts_monteur_workspace
  ON social_posts(workspace_id, monteur_id, production_status)
  WHERE monteur_id IS NOT NULL;

-- ─── 3) RLS — policies monteur ───────────────────────────────────────
-- Helper : true si l'utilisateur courant est un monteur du workspace
CREATE OR REPLACE FUNCTION is_monteur_in_workspace(target_workspace UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = target_workspace
      AND user_id = auth.uid()
      AND role = 'monteur'
      AND status = 'active'
  );
$$;

-- SELECT : monteur ne voit QUE ses slots filmed/edited/ready
DROP POLICY IF EXISTS "social_posts_select" ON social_posts;
CREATE POLICY "social_posts_select" ON social_posts FOR SELECT
  USING (
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND status = 'active')
    AND (
      NOT is_monteur_in_workspace(workspace_id)
      OR (
        monteur_id = auth.uid()
        AND production_status IN ('filmed', 'edited', 'ready')
      )
    )
  );

-- UPDATE : monteur peut update SEULEMENT ses slots filmed↔edited
DROP POLICY IF EXISTS "social_posts_update" ON social_posts;
CREATE POLICY "social_posts_update" ON social_posts FOR UPDATE
  USING (
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND status = 'active')
    AND (
      NOT is_monteur_in_workspace(workspace_id)
      OR (
        monteur_id = auth.uid()
        AND production_status IN ('filmed', 'edited')
      )
    )
  );

-- INSERT/DELETE : monteur ne peut pas créer ni supprimer (sauf admin/setter/closer)
DROP POLICY IF EXISTS "social_posts_insert" ON social_posts;
CREATE POLICY "social_posts_insert" ON social_posts FOR INSERT
  WITH CHECK (
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND status = 'active')
    AND NOT is_monteur_in_workspace(workspace_id)
  );

DROP POLICY IF EXISTS "social_posts_delete" ON social_posts;
CREATE POLICY "social_posts_delete" ON social_posts FOR DELETE
  USING (
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND status = 'active')
    AND NOT is_monteur_in_workspace(workspace_id)
  );

-- ─── 4) Trigger : empêche le monteur de modifier hors-périmètre ──────
-- Le monteur ne peut modifier que : production_status (filmed↔edited),
-- final_url, editor_notes, media_urls. Tout autre champ levé.
CREATE OR REPLACE FUNCTION prevent_monteur_unsafe_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF is_monteur_in_workspace(NEW.workspace_id) THEN
    -- Block edited → ready (réservé au coach)
    IF OLD.production_status = 'edited' AND NEW.production_status = 'ready' THEN
      RAISE EXCEPTION 'Le monteur ne peut pas valider un slot — réservé au coach';
    END IF;
    -- Block modification du brief / assignation
    IF NEW.hook IS DISTINCT FROM OLD.hook
       OR NEW.script IS DISTINCT FROM OLD.script
       OR NEW.pillar_id IS DISTINCT FROM OLD.pillar_id
       OR NEW.plan_date IS DISTINCT FROM OLD.plan_date
       OR NEW.monteur_id IS DISTINCT FROM OLD.monteur_id
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
  -- Reset coach_notified_at si le coach repasse à filmed (re-montage demandé)
  IF OLD.production_status = 'edited' AND NEW.production_status = 'filmed' THEN
    NEW.coach_notified_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS social_posts_monteur_guard ON social_posts;
CREATE TRIGGER social_posts_monteur_guard
  BEFORE UPDATE ON social_posts
  FOR EACH ROW
  EXECUTE FUNCTION prevent_monteur_unsafe_update();

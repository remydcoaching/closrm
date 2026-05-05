-- ═════════════════════════════════════════════════════════════════════
-- 067 — Facturation monteurs
--
-- Permet au coach de :
-- 1) Créer des prestations (pricing tiers) personnalisées par monteur :
--    "Reel premium 80€", "Reel classique 50€", "Vlog 120€", etc.
-- 2) Choisir une prestation en assignant un slot → le coût est calculé.
-- 3) Marquer les slots payés / non payés au monteur.
--
-- Le monteur peut lire ses propres pricing_tiers + voir les paid_at de
-- ses slots (consultatif). Il ne peut PAS créer/modifier/supprimer.
-- ═════════════════════════════════════════════════════════════════════

-- ─── 1) Table monteur_pricing_tiers ──────────────────────────────────
CREATE TABLE IF NOT EXISTS monteur_pricing_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  monteur_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pricing_tiers_workspace
  ON monteur_pricing_tiers(workspace_id, monteur_id)
  WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pricing_tiers_monteur
  ON monteur_pricing_tiers(monteur_id)
  WHERE archived_at IS NULL;

-- ─── 2) Colonnes sur social_posts ────────────────────────────────────
ALTER TABLE social_posts
  ADD COLUMN IF NOT EXISTS pricing_tier_id UUID REFERENCES monteur_pricing_tiers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_social_posts_billing
  ON social_posts(workspace_id, monteur_id, paid_at)
  WHERE monteur_id IS NOT NULL AND pricing_tier_id IS NOT NULL;

-- ─── 3) RLS sur monteur_pricing_tiers ────────────────────────────────
ALTER TABLE monteur_pricing_tiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pricing_tiers_select" ON monteur_pricing_tiers;
CREATE POLICY "pricing_tiers_select" ON monteur_pricing_tiers FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
    AND (
      -- Les non-monteurs voient tout (coach gère les prix)
      NOT is_monteur_in_workspace(workspace_id)
      -- Le monteur ne voit que ses propres prestations
      OR monteur_id = auth.uid()
    )
  );

-- INSERT/UPDATE/DELETE : seulement non-monteur (coach/admin)
DROP POLICY IF EXISTS "pricing_tiers_insert" ON monteur_pricing_tiers;
CREATE POLICY "pricing_tiers_insert" ON monteur_pricing_tiers FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
    AND NOT is_monteur_in_workspace(workspace_id)
  );

DROP POLICY IF EXISTS "pricing_tiers_update" ON monteur_pricing_tiers;
CREATE POLICY "pricing_tiers_update" ON monteur_pricing_tiers FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
    AND NOT is_monteur_in_workspace(workspace_id)
  );

DROP POLICY IF EXISTS "pricing_tiers_delete" ON monteur_pricing_tiers;
CREATE POLICY "pricing_tiers_delete" ON monteur_pricing_tiers FOR DELETE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
    AND NOT is_monteur_in_workspace(workspace_id)
  );

-- ─── 4) Trigger : empêche le monteur de modifier paid_at, pricing_tier_id ──
-- Le monteur peut voir ces champs mais pas les changer.
-- On étend le trigger existant prevent_monteur_unsafe_update.
CREATE OR REPLACE FUNCTION prevent_monteur_unsafe_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF is_monteur_in_workspace(NEW.workspace_id) THEN
    -- Block toute transition de production_status hors filmed↔edited
    IF NEW.production_status NOT IN ('filmed', 'edited') THEN
      RAISE EXCEPTION 'Le monteur ne peut transitionner qu''entre filmed et edited (tenté: %)', NEW.production_status;
    END IF;
    -- Block modification du brief / assignation / facturation
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
       OR NEW.pricing_tier_id IS DISTINCT FROM OLD.pricing_tier_id
       OR NEW.paid_at IS DISTINCT FROM OLD.paid_at
    THEN
      RAISE EXCEPTION 'Le monteur ne peut modifier que le statut, le lien final, les notes éditeur et les media';
    END IF;
  END IF;
  -- Reset coach_notified_at si le coach repasse à filmed (re-montage demandé)
  IF OLD.production_status = 'edited' AND NEW.production_status = 'filmed' THEN
    NEW.coach_notified_at := NULL;
  END IF;
  -- Reset monteur_notified_at si le coach change le monteur
  IF NEW.monteur_id IS DISTINCT FROM OLD.monteur_id
     OR (OLD.production_status = 'edited' AND NEW.production_status = 'filmed') THEN
    NEW.monteur_notified_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- ─── 5) Updated_at trigger sur monteur_pricing_tiers ─────────────────
CREATE OR REPLACE FUNCTION set_pricing_tier_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pricing_tiers_set_updated_at ON monteur_pricing_tiers;
CREATE TRIGGER pricing_tiers_set_updated_at
  BEFORE UPDATE ON monteur_pricing_tiers
  FOR EACH ROW
  EXECUTE FUNCTION set_pricing_tier_updated_at();

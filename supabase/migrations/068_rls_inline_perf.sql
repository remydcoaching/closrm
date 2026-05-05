-- ═════════════════════════════════════════════════════════════════════
-- 068 — Optimisation RLS social_posts (perf)
--
-- La fonction is_monteur_in_workspace() est SECURITY DEFINER + STABLE,
-- ce qui empêche Postgres de l'inliner dans la policy. Résultat : pour
-- 200 rows retournés, la fonction est appelée 200×, soit 40-100 ms
-- d'overhead inutile pour les coachs (qui ne sont pas monteurs).
--
-- On la remplace par un EXISTS inline que le planner peut hoister.
-- Comportement identique côté autorisations.
-- ═════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "social_posts_select" ON social_posts;
CREATE POLICY "social_posts_select" ON social_posts FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
    AND (
      -- Coach / setter / closer : voient tout
      NOT EXISTS (
        SELECT 1 FROM workspace_members
        WHERE workspace_id = social_posts.workspace_id
          AND user_id = auth.uid()
          AND role = 'monteur'
          AND status = 'active'
      )
      -- Monteur : seulement ses slots assignés en filmed/edited/ready
      OR (
        monteur_id = auth.uid()
        AND production_status IN ('filmed', 'edited', 'ready')
      )
    )
  );

DROP POLICY IF EXISTS "social_posts_update" ON social_posts;
CREATE POLICY "social_posts_update" ON social_posts FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
    AND (
      NOT EXISTS (
        SELECT 1 FROM workspace_members
        WHERE workspace_id = social_posts.workspace_id
          AND user_id = auth.uid()
          AND role = 'monteur'
          AND status = 'active'
      )
      OR (
        monteur_id = auth.uid()
        AND production_status IN ('filmed', 'edited')
      )
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
    AND (
      NOT EXISTS (
        SELECT 1 FROM workspace_members
        WHERE workspace_id = social_posts.workspace_id
          AND user_id = auth.uid()
          AND role = 'monteur'
          AND status = 'active'
      )
      OR (
        monteur_id = auth.uid()
        AND production_status IN ('filmed', 'edited')
      )
    )
  );

DROP POLICY IF EXISTS "social_posts_insert" ON social_posts;
CREATE POLICY "social_posts_insert" ON social_posts FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
    AND NOT EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_id = social_posts.workspace_id
        AND user_id = auth.uid()
        AND role = 'monteur'
        AND status = 'active'
    )
  );

DROP POLICY IF EXISTS "social_posts_delete" ON social_posts;
CREATE POLICY "social_posts_delete" ON social_posts FOR DELETE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
    AND NOT EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_id = social_posts.workspace_id
        AND user_id = auth.uid()
        AND role = 'monteur'
        AND status = 'active'
    )
  );

-- Idem pour monteur_pricing_tiers (créée en 067)
DROP POLICY IF EXISTS "pricing_tiers_select" ON monteur_pricing_tiers;
CREATE POLICY "pricing_tiers_select" ON monteur_pricing_tiers FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
    AND (
      NOT EXISTS (
        SELECT 1 FROM workspace_members
        WHERE workspace_id = monteur_pricing_tiers.workspace_id
          AND user_id = auth.uid()
          AND role = 'monteur'
          AND status = 'active'
      )
      OR monteur_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "pricing_tiers_insert" ON monteur_pricing_tiers;
CREATE POLICY "pricing_tiers_insert" ON monteur_pricing_tiers FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
    AND NOT EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_id = monteur_pricing_tiers.workspace_id
        AND user_id = auth.uid()
        AND role = 'monteur'
        AND status = 'active'
    )
  );

DROP POLICY IF EXISTS "pricing_tiers_update" ON monteur_pricing_tiers;
CREATE POLICY "pricing_tiers_update" ON monteur_pricing_tiers FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
    AND NOT EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_id = monteur_pricing_tiers.workspace_id
        AND user_id = auth.uid()
        AND role = 'monteur'
        AND status = 'active'
    )
  );

DROP POLICY IF EXISTS "pricing_tiers_delete" ON monteur_pricing_tiers;
CREATE POLICY "pricing_tiers_delete" ON monteur_pricing_tiers FOR DELETE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
    AND NOT EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_id = monteur_pricing_tiers.workspace_id
        AND user_id = auth.uid()
        AND role = 'monteur'
        AND status = 'active'
    )
  );

-- Index utilité : workspace_members(user_id, status, role) pour accélérer
-- les EXISTS dans les policies.
CREATE INDEX IF NOT EXISTS idx_workspace_members_user_status_role
  ON workspace_members(user_id, status, role);

-- ============================================================================
-- Migration 038: Workspace Billing Columns
-- Ajoute les colonnes de billing sur workspaces (plan, Stripe, trial, seats,
-- flag is_internal).
-- Dépend de migration 037 (billing_plans).
-- ============================================================================

ALTER TABLE workspaces
  ADD COLUMN plan_id TEXT REFERENCES billing_plans(id),
  ADD COLUMN stripe_customer_id TEXT UNIQUE,
  ADD COLUMN stripe_subscription_id TEXT UNIQUE,
  ADD COLUMN subscription_status TEXT CHECK (subscription_status IN (
    'trial','active','past_due','canceled','suspended','internal'
  )),
  ADD COLUMN trial_ends_at TIMESTAMPTZ,
  ADD COLUMN current_period_start TIMESTAMPTZ,
  ADD COLUMN current_period_end TIMESTAMPTZ,
  ADD COLUMN is_internal BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN seats_count INT NOT NULL DEFAULT 1 CHECK (seats_count >= 1);

CREATE INDEX idx_workspaces_plan_id ON workspaces(plan_id);
CREATE INDEX idx_workspaces_subscription_status ON workspaces(subscription_status);
CREATE INDEX idx_workspaces_trial_ends_at ON workspaces(trial_ends_at) WHERE trial_ends_at IS NOT NULL;
CREATE INDEX idx_workspaces_stripe_customer ON workspaces(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

-- ─── Backfill workspaces existants en trial 14j ─────────────────────────────
-- Tous les workspaces existants à cette date passent automatiquement en trial
-- de 14 jours à partir de maintenant. À revoir manuellement pour les comptes
-- co-fondateurs (Pierre + Rémy) après application : UPDATE workspaces
-- SET is_internal = true, plan_id = 'internal', subscription_status = 'internal'
-- WHERE id IN ('...');

UPDATE workspaces SET
  plan_id = 'trial',
  subscription_status = 'trial',
  trial_ends_at = now() + interval '14 days',
  current_period_start = now(),
  current_period_end = now() + interval '14 days'
WHERE plan_id IS NULL;

-- ─── Modifier le trigger handle_new_user pour initialiser trial automatiquement
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_workspace_id uuid;
BEGIN
  -- Create workspace avec plan trial par défaut
  INSERT INTO workspaces (
    name, owner_id,
    plan_id, subscription_status,
    trial_ends_at, current_period_start, current_period_end
  )
  VALUES (
    COALESCE(new.raw_user_meta_data->>'full_name', 'Mon workspace') || ' — Workspace',
    new.id,
    'trial',
    'trial',
    now() + interval '14 days',
    now(),
    now() + interval '14 days'
  )
  RETURNING id INTO new_workspace_id;

  -- Create user profile
  INSERT INTO users (id, workspace_id, email, role, full_name)
  VALUES (
    new.id,
    new_workspace_id,
    new.email,
    'coach',
    COALESCE(new.raw_user_meta_data->>'full_name', '')
  );

  -- Create workspace_member as admin
  INSERT INTO workspace_members (workspace_id, user_id, role, status, activated_at)
  VALUES (new_workspace_id, new.id, 'admin', 'active', now());

  RETURN new;
END;
$$;

COMMENT ON COLUMN workspaces.plan_id IS 'FK vers billing_plans. Null pendant migration, forcé après backfill.';
COMMENT ON COLUMN workspaces.is_internal IS 'Flag co-fondateurs/beta-testeurs : bypass total du billing.';
COMMENT ON COLUMN workspaces.seats_count IS 'Nombre de sièges facturés (admin + autres membres actifs).';

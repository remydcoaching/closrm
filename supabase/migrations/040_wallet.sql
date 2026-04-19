-- ============================================================================
-- Migration 040: Wallet pré-payé
-- Colonnes wallet sur workspaces + table wallet_transactions (log des débits
-- et recharges Stripe).
-- Dépend de migrations 037, 038.
-- ============================================================================

-- ─── Colonnes wallet sur workspaces ─────────────────────────────────────────
ALTER TABLE workspaces
  ADD COLUMN wallet_balance_cents INT NOT NULL DEFAULT 0,
  ADD COLUMN wallet_auto_recharge_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN wallet_auto_recharge_amount_cents INT NOT NULL DEFAULT 1000
    CHECK (wallet_auto_recharge_amount_cents >= 500),
  ADD COLUMN wallet_auto_recharge_threshold_cents INT NOT NULL DEFAULT 200
    CHECK (wallet_auto_recharge_threshold_cents >= 0),
  ADD COLUMN stripe_default_payment_method_id TEXT;

COMMENT ON COLUMN workspaces.wallet_balance_cents IS 'Solde wallet en centimes euros. Jamais négatif.';
COMMENT ON COLUMN workspaces.wallet_auto_recharge_amount_cents IS 'Montant de recharge auto en cents. Min 500 (5€).';
COMMENT ON COLUMN workspaces.wallet_auto_recharge_threshold_cents IS 'Seuil déclenchement recharge auto en cents. Défaut 200 (2€).';

-- ─── Table wallet_transactions ──────────────────────────────────────────────
CREATE TABLE wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Type de transaction
  type TEXT NOT NULL CHECK (type IN ('recharge','debit','refund','adjustment')),

  -- Montant en cents (positif pour credit, négatif pour debit)
  amount_cents INT NOT NULL,
  balance_after_cents INT NOT NULL CHECK (balance_after_cents >= 0),

  -- Contexte (uniquement pour debit)
  resource_type TEXT CHECK (resource_type IN ('email','ai_tokens','whatsapp','sms')),
  quantity BIGINT,

  -- Contexte Stripe (uniquement pour recharge)
  stripe_payment_intent_id TEXT,
  stripe_invoice_id TEXT,

  -- Initiateur de la transaction
  initiated_by TEXT NOT NULL CHECK (initiated_by IN ('user','auto','admin','system')),

  notes TEXT,
  metadata JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_wallet_tx_workspace
  ON wallet_transactions(workspace_id, created_at DESC);

CREATE INDEX idx_wallet_tx_stripe_intent
  ON wallet_transactions(stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL;

-- RLS
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wallet_tx_select_workspace" ON wallet_transactions
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Pas de policy INSERT/UPDATE côté client — tout passe par service role.

COMMENT ON TABLE wallet_transactions IS 'Journal des transactions wallet (recharges Stripe + débits consommation).';

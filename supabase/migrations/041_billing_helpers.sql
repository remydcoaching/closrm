-- ============================================================================
-- Migration 041: Billing Helpers + Drop AI API key
-- - Drop de la colonne ai_coach_briefs.api_key (refonte proxy IA).
-- - Fonctions RPC atomiques pour débit wallet et consommation.
-- Dépend de 037, 038, 039, 040.
-- ============================================================================

-- ─── Drop clé API IA (refonte en proxy backend) ─────────────────────────────
ALTER TABLE ai_coach_briefs DROP COLUMN IF EXISTS api_key;

-- ─── Fonction atomique : débit wallet + log transaction ─────────────────────
-- Décrémente wallet_balance_cents et insère une ligne wallet_transactions
-- en une seule transaction SQL pour éviter les race conditions.
CREATE OR REPLACE FUNCTION debit_wallet(
  p_workspace_id UUID,
  p_amount_cents INT,
  p_resource_type TEXT,
  p_quantity BIGINT,
  p_initiated_by TEXT DEFAULT 'system'
)
RETURNS TABLE (
  success BOOLEAN,
  new_balance_cents INT,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance INT;
  v_new_balance INT;
BEGIN
  -- Lock la ligne workspace pour éviter race condition
  SELECT wallet_balance_cents INTO v_current_balance
  FROM workspaces
  WHERE id = p_workspace_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, 'Workspace not found';
    RETURN;
  END IF;

  IF v_current_balance < p_amount_cents THEN
    RETURN QUERY SELECT false, v_current_balance, 'Insufficient wallet balance';
    RETURN;
  END IF;

  v_new_balance := v_current_balance - p_amount_cents;

  UPDATE workspaces
  SET wallet_balance_cents = v_new_balance
  WHERE id = p_workspace_id;

  INSERT INTO wallet_transactions (
    workspace_id, type, amount_cents, balance_after_cents,
    resource_type, quantity, initiated_by
  ) VALUES (
    p_workspace_id, 'debit', -p_amount_cents, v_new_balance,
    p_resource_type, p_quantity, p_initiated_by
  );

  RETURN QUERY SELECT true, v_new_balance, NULL::TEXT;
END;
$$;

COMMENT ON FUNCTION debit_wallet IS 'Débite le wallet et log la transaction de manière atomique. Retourne success=false si solde insuffisant.';

-- ─── Fonction atomique : créditer wallet (recharge) ─────────────────────────
CREATE OR REPLACE FUNCTION credit_wallet(
  p_workspace_id UUID,
  p_amount_cents INT,
  p_stripe_payment_intent_id TEXT DEFAULT NULL,
  p_initiated_by TEXT DEFAULT 'user',
  p_notes TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  new_balance_cents INT,
  transaction_id UUID,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance INT;
  v_new_balance INT;
  v_tx_id UUID;
BEGIN
  IF p_amount_cents <= 0 THEN
    RETURN QUERY SELECT false, 0, NULL::UUID, 'Amount must be positive';
    RETURN;
  END IF;

  SELECT wallet_balance_cents INTO v_current_balance
  FROM workspaces
  WHERE id = p_workspace_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, NULL::UUID, 'Workspace not found';
    RETURN;
  END IF;

  v_new_balance := v_current_balance + p_amount_cents;

  UPDATE workspaces
  SET wallet_balance_cents = v_new_balance
  WHERE id = p_workspace_id;

  INSERT INTO wallet_transactions (
    workspace_id, type, amount_cents, balance_after_cents,
    stripe_payment_intent_id, initiated_by, notes
  ) VALUES (
    p_workspace_id, 'recharge', p_amount_cents, v_new_balance,
    p_stripe_payment_intent_id, p_initiated_by, p_notes
  )
  RETURNING id INTO v_tx_id;

  RETURN QUERY SELECT true, v_new_balance, v_tx_id, NULL::TEXT;
END;
$$;

COMMENT ON FUNCTION credit_wallet IS 'Crédite le wallet (recharge) et log la transaction.';

-- ─── Fonction : check + consume quota puis wallet ───────────────────────────
-- Logique :
--   1. Si workspace is_internal → bypass, log internal
--   2. Sinon calcule quota restant (quota plan - quota déjà consommé)
--   3. Si quota suffisant → log usage_event avec billed_from='quota'
--   4. Sinon débite wallet pour la portion dépassement
--   5. Retourne allowed + source
CREATE OR REPLACE FUNCTION consume_resource(
  p_workspace_id UUID,
  p_resource_type TEXT,
  p_quantity BIGINT,
  p_cost_cents_eur NUMERIC DEFAULT NULL,
  p_source TEXT DEFAULT 'unknown',
  p_metadata JSONB DEFAULT NULL
)
RETURNS TABLE (
  allowed BOOLEAN,
  billed_from TEXT,
  amount_cents_debited INT,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_internal BOOLEAN;
  v_plan_id TEXT;
  v_seats_count INT;
  v_period_start TIMESTAMPTZ;
  v_quota_base INT;
  v_quota_per_seat INT;
  v_quota_total BIGINT;
  v_quota_used BIGINT;
  v_quota_remaining BIGINT;
  v_overage_qty BIGINT;
  v_overage_price_cents_per_1k INT;
  v_overage_cost_cents INT;
  v_fair_use_cap INT;
  v_wallet_balance INT;
  v_debit_result RECORD;
BEGIN
  SELECT w.is_internal, w.plan_id, w.seats_count, w.current_period_start, w.wallet_balance_cents
  INTO v_is_internal, v_plan_id, v_seats_count, v_period_start, v_wallet_balance
  FROM workspaces w
  WHERE w.id = p_workspace_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::TEXT, 0, 'Workspace not found';
    RETURN;
  END IF;

  -- Cas 1 : workspace interne → bypass
  IF v_is_internal THEN
    INSERT INTO usage_events (
      workspace_id, resource_type, quantity, cost_cents_eur, source,
      billed_from, amount_cents_debited, billing_period_start, metadata
    ) VALUES (
      p_workspace_id, p_resource_type, p_quantity, p_cost_cents_eur, p_source,
      'internal', 0, v_period_start, p_metadata
    );
    RETURN QUERY SELECT true, 'internal', 0, NULL::TEXT;
    RETURN;
  END IF;

  -- Récup quotas du plan
  IF p_resource_type = 'email' THEN
    SELECT bp.quota_emails, bp.quota_emails_per_seat,
           bp.overage_email_price_cents_per_1k, bp.fair_use_emails_cap
    INTO v_quota_base, v_quota_per_seat, v_overage_price_cents_per_1k, v_fair_use_cap
    FROM billing_plans bp WHERE bp.id = v_plan_id;
  ELSIF p_resource_type = 'ai_tokens' THEN
    SELECT bp.quota_ai_tokens::INT, bp.quota_ai_tokens_per_seat::INT,
           bp.overage_ai_tokens_price_cents_per_1k, NULL
    INTO v_quota_base, v_quota_per_seat, v_overage_price_cents_per_1k, v_fair_use_cap
    FROM billing_plans bp WHERE bp.id = v_plan_id;
  ELSIF p_resource_type = 'whatsapp' THEN
    SELECT bp.quota_whatsapp, bp.quota_whatsapp_per_seat,
           bp.overage_whatsapp_price_cents_per_1k, NULL
    INTO v_quota_base, v_quota_per_seat, v_overage_price_cents_per_1k, v_fair_use_cap
    FROM billing_plans bp WHERE bp.id = v_plan_id;
  ELSE
    RETURN QUERY SELECT false, NULL::TEXT, 0, 'Unknown resource type';
    RETURN;
  END IF;

  v_quota_total := COALESCE(v_quota_base, 0)::BIGINT + COALESCE(v_quota_per_seat, 0)::BIGINT * GREATEST(v_seats_count - 1, 0);

  SELECT COALESCE(SUM(ue.quantity), 0)
  INTO v_quota_used
  FROM usage_events ue
  WHERE ue.workspace_id = p_workspace_id
    AND ue.resource_type = p_resource_type
    AND ue.billing_period_start = v_period_start
    AND ue.billed_from = 'quota';

  v_quota_remaining := v_quota_total - v_quota_used;

  -- Cas 2 : quota couvre tout
  IF v_quota_remaining >= p_quantity THEN
    INSERT INTO usage_events (
      workspace_id, resource_type, quantity, cost_cents_eur, source,
      billed_from, amount_cents_debited, billing_period_start, metadata
    ) VALUES (
      p_workspace_id, p_resource_type, p_quantity, p_cost_cents_eur, p_source,
      'quota', 0, v_period_start, p_metadata
    );
    RETURN QUERY SELECT true, 'quota', 0, NULL::TEXT;
    RETURN;
  END IF;

  -- Fair-use cap check (uniquement email)
  IF p_resource_type = 'email' AND v_fair_use_cap IS NOT NULL THEN
    IF v_quota_used + p_quantity > v_fair_use_cap THEN
      RETURN QUERY SELECT false, NULL::TEXT, 0,
        'Fair-use cap exceeded. Upgrade to Scale plan or contact support.';
      RETURN;
    END IF;
  END IF;

  -- Cas 3 : overage sur wallet
  v_overage_qty := p_quantity - GREATEST(v_quota_remaining, 0);
  v_overage_cost_cents := CEIL(v_overage_qty::NUMERIC * v_overage_price_cents_per_1k::NUMERIC / 1000);

  IF v_wallet_balance < v_overage_cost_cents THEN
    RETURN QUERY SELECT false, NULL::TEXT, 0,
      'Insufficient wallet balance. Please recharge.';
    RETURN;
  END IF;

  -- Débit wallet (atomique)
  SELECT * FROM debit_wallet(
    p_workspace_id, v_overage_cost_cents, p_resource_type, v_overage_qty, 'system'
  ) INTO v_debit_result;

  IF NOT v_debit_result.success THEN
    RETURN QUERY SELECT false, NULL::TEXT, 0, v_debit_result.error_message;
    RETURN;
  END IF;

  -- Log usage_event : partie quota (si reste) + partie wallet
  IF v_quota_remaining > 0 THEN
    INSERT INTO usage_events (
      workspace_id, resource_type, quantity, source,
      billed_from, amount_cents_debited, billing_period_start, metadata
    ) VALUES (
      p_workspace_id, p_resource_type, v_quota_remaining, p_source,
      'quota', 0, v_period_start, p_metadata
    );
  END IF;

  INSERT INTO usage_events (
    workspace_id, resource_type, quantity, cost_cents_eur, source,
    billed_from, amount_cents_debited, billing_period_start, metadata
  ) VALUES (
    p_workspace_id, p_resource_type, v_overage_qty, p_cost_cents_eur, p_source,
    'wallet', v_overage_cost_cents, v_period_start, p_metadata
  );

  RETURN QUERY SELECT true, 'wallet', v_overage_cost_cents, NULL::TEXT;
END;
$$;

COMMENT ON FUNCTION consume_resource IS 'Consume une ressource : check quota plan puis wallet, débite et log atomiquement.';

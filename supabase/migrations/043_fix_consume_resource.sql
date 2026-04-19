-- ============================================================================
-- Migration 043: Fix consume_resource bugs détectés en code review
-- Bugs corrigés :
--   #1 cost_cents_eur dupliqué sur la portion wallet en cas de straddling quota/wallet
--   #10 NULL crash si plan a un overage_price NULL
--   #17 Message d'erreur fair-use cap mentionne "Scale" même pour Trial → message dynamique
-- ============================================================================

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
  v_quota_cost_cents NUMERIC;
  v_wallet_cost_cents NUMERIC;
  v_upgrade_target TEXT;
BEGIN
  SELECT w.is_internal, w.plan_id, w.seats_count, w.current_period_start, w.wallet_balance_cents
  INTO v_is_internal, v_plan_id, v_seats_count, v_period_start, v_wallet_balance
  FROM workspaces w WHERE w.id = p_workspace_id FOR UPDATE;

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
           COALESCE(bp.overage_email_price_cents_per_1k, 0), bp.fair_use_emails_cap
    INTO v_quota_base, v_quota_per_seat, v_overage_price_cents_per_1k, v_fair_use_cap
    FROM billing_plans bp WHERE bp.id = v_plan_id;
  ELSIF p_resource_type = 'ai_tokens' THEN
    SELECT bp.quota_ai_tokens::INT, bp.quota_ai_tokens_per_seat::INT,
           COALESCE(bp.overage_ai_tokens_price_cents_per_1k, 0), NULL
    INTO v_quota_base, v_quota_per_seat, v_overage_price_cents_per_1k, v_fair_use_cap
    FROM billing_plans bp WHERE bp.id = v_plan_id;
  ELSIF p_resource_type = 'whatsapp' THEN
    SELECT bp.quota_whatsapp, bp.quota_whatsapp_per_seat,
           COALESCE(bp.overage_whatsapp_price_cents_per_1k, 0), NULL
    INTO v_quota_base, v_quota_per_seat, v_overage_price_cents_per_1k, v_fair_use_cap
    FROM billing_plans bp WHERE bp.id = v_plan_id;
  ELSE
    RETURN QUERY SELECT false, NULL::TEXT, 0, 'Unknown resource type';
    RETURN;
  END IF;

  v_quota_total := COALESCE(v_quota_base, 0)::BIGINT
                 + COALESCE(v_quota_per_seat, 0)::BIGINT * GREATEST(v_seats_count - 1, 0);

  SELECT COALESCE(SUM(ue.quantity), 0) INTO v_quota_used
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

  -- Fair-use cap check (uniquement email) : message dynamique selon plan
  IF p_resource_type = 'email' AND v_fair_use_cap IS NOT NULL THEN
    IF v_quota_used + p_quantity > v_fair_use_cap THEN
      v_upgrade_target := CASE
        WHEN v_plan_id = 'trial' THEN 'Pro'
        WHEN v_plan_id = 'starter' THEN 'Pro'
        WHEN v_plan_id = 'pro' THEN 'Scale'
        ELSE 'Scale'
      END;
      RETURN QUERY SELECT false, NULL::TEXT, 0,
        format('Fair-use cap atteint (%s emails/mois). Passez en %s ou contactez le support.',
          v_fair_use_cap, v_upgrade_target);
      RETURN;
    END IF;
  END IF;

  -- Cas 3 : overage sur wallet
  v_overage_qty := p_quantity - GREATEST(v_quota_remaining, 0);
  v_overage_cost_cents := CEIL(v_overage_qty::NUMERIC * v_overage_price_cents_per_1k::NUMERIC / 1000)::INT;

  IF v_wallet_balance < v_overage_cost_cents THEN
    RETURN QUERY SELECT false, NULL::TEXT, 0,
      'Solde wallet insuffisant. Rechargez votre wallet ou upgradez votre plan.';
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

  -- Split du cost provider proportionnellement entre quota et wallet
  -- (fix bug #1 : avant on attribuait p_cost_cents_eur entier au row wallet,
  -- ce qui doublait la conso provider en margin reporting)
  IF p_cost_cents_eur IS NOT NULL AND p_quantity > 0 THEN
    v_quota_cost_cents := p_cost_cents_eur * GREATEST(v_quota_remaining, 0) / p_quantity;
    v_wallet_cost_cents := p_cost_cents_eur * v_overage_qty / p_quantity;
  ELSE
    v_quota_cost_cents := NULL;
    v_wallet_cost_cents := NULL;
  END IF;

  -- Log usage_event : portion quota (si reste)
  IF v_quota_remaining > 0 THEN
    INSERT INTO usage_events (
      workspace_id, resource_type, quantity, cost_cents_eur, source,
      billed_from, amount_cents_debited, billing_period_start, metadata
    ) VALUES (
      p_workspace_id, p_resource_type, v_quota_remaining, v_quota_cost_cents, p_source,
      'quota', 0, v_period_start, p_metadata
    );
  END IF;

  -- Log usage_event : portion wallet
  INSERT INTO usage_events (
    workspace_id, resource_type, quantity, cost_cents_eur, source,
    billed_from, amount_cents_debited, billing_period_start, metadata
  ) VALUES (
    p_workspace_id, p_resource_type, v_overage_qty, v_wallet_cost_cents, p_source,
    'wallet', v_overage_cost_cents, v_period_start, p_metadata
  );

  RETURN QUERY SELECT true, 'wallet', v_overage_cost_cents, NULL::TEXT;
END;
$$;

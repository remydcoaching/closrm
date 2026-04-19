-- ============================================================================
-- Migration 039: Usage Tracking
-- Table usage_events : log chaque consommation (email, AI tokens, WhatsApp).
-- Vue workspace_current_usage : agrège l'usage de la période en cours.
-- Dépend de migrations 037, 038.
-- ============================================================================

CREATE TABLE usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('email','ai_tokens','whatsapp','sms')),
  quantity BIGINT NOT NULL CHECK (quantity > 0),

  -- Coût fournisseur estimé (pour margin reporting, en euros cents avec 4 décimales)
  cost_cents_eur NUMERIC(10,4),

  -- Contexte (workflow, manual, broadcast, ai_suggest, ai_brief, etc.)
  source TEXT NOT NULL,

  -- D'où vient le débit : quota inclus du plan, wallet overage, ou bypass internal
  billed_from TEXT NOT NULL CHECK (billed_from IN ('quota','wallet','internal')),
  amount_cents_debited INT NOT NULL DEFAULT 0,

  -- Période de facturation au moment de l'event (= workspaces.current_period_start)
  billing_period_start TIMESTAMPTZ NOT NULL,

  metadata JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_usage_events_workspace_period
  ON usage_events(workspace_id, billing_period_start, resource_type);

CREATE INDEX idx_usage_events_created
  ON usage_events(created_at DESC);

CREATE INDEX idx_usage_events_resource
  ON usage_events(resource_type, created_at DESC);

-- RLS
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usage_events_select_workspace" ON usage_events
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Pas de policy INSERT/UPDATE côté client — les inserts se font via service role
-- (côté serveur depuis billingService.consume()).

-- ─── Vue usage période en cours ─────────────────────────────────────────────
CREATE OR REPLACE VIEW workspace_current_usage AS
SELECT
  w.id AS workspace_id,
  w.plan_id,
  w.current_period_start,
  w.current_period_end,
  w.seats_count,
  COALESCE(SUM(ue.quantity) FILTER (WHERE ue.resource_type = 'email'), 0) AS emails_used,
  COALESCE(SUM(ue.quantity) FILTER (WHERE ue.resource_type = 'ai_tokens'), 0) AS ai_tokens_used,
  COALESCE(SUM(ue.quantity) FILTER (WHERE ue.resource_type = 'whatsapp'), 0) AS whatsapp_used,
  COALESCE(SUM(ue.quantity) FILTER (WHERE ue.resource_type = 'sms'), 0) AS sms_used,
  COALESCE(SUM(ue.amount_cents_debited), 0) AS wallet_debited_cents
FROM workspaces w
LEFT JOIN usage_events ue
  ON ue.workspace_id = w.id
  AND ue.billing_period_start = w.current_period_start
GROUP BY w.id, w.plan_id, w.current_period_start, w.current_period_end, w.seats_count;

COMMENT ON VIEW workspace_current_usage IS 'Agrégat de consommation pour la période en cours de chaque workspace.';

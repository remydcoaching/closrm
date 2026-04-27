-- supabase/migrations/036_deals_table.sql
-- Deals table: un lead peut être gagné plusieurs fois (renouvellement, upsell, etc.)
-- Permet de tracker setter/closer séparément et de calculer le MRR.

CREATE TABLE IF NOT EXISTS deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,

  -- Attribution
  setter_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  closer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Montant
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  cash_collected numeric(12,2) NOT NULL DEFAULT 0 CHECK (cash_collected >= 0),
  installments int NOT NULL DEFAULT 1 CHECK (installments >= 1 AND installments <= 24),

  -- Durée / récurrence (null = paiement one-shot, pas de contribution MRR)
  duration_months int CHECK (duration_months IS NULL OR duration_months > 0),

  -- Période couverte (pour calcul MRR et deals actifs)
  started_at timestamptz NOT NULL DEFAULT NOW(),
  ends_at timestamptz, -- calculé auto via trigger si duration_months set

  -- Statut
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'churned', 'refunded')),

  notes text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deals_workspace ON deals(workspace_id);
CREATE INDEX IF NOT EXISTS idx_deals_lead ON deals(lead_id);
CREATE INDEX IF NOT EXISTS idx_deals_closer ON deals(closer_id) WHERE closer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deals_setter ON deals(setter_id) WHERE setter_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deals_status ON deals(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_deals_started ON deals(workspace_id, started_at DESC);

-- Trigger: auto-calculate ends_at from started_at + duration_months
CREATE OR REPLACE FUNCTION deals_set_ends_at() RETURNS trigger AS $$
BEGIN
  IF NEW.duration_months IS NOT NULL THEN
    NEW.ends_at := NEW.started_at + (NEW.duration_months || ' months')::interval;
  ELSE
    NEW.ends_at := NULL;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_deals_ends_at ON deals;
CREATE TRIGGER trg_deals_ends_at BEFORE INSERT OR UPDATE ON deals
  FOR EACH ROW EXECUTE FUNCTION deals_set_ends_at();

-- RLS
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deals_select" ON deals;
CREATE POLICY "deals_select" ON deals FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "deals_insert" ON deals;
CREATE POLICY "deals_insert" ON deals FOR INSERT
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "deals_update" ON deals;
CREATE POLICY "deals_update" ON deals FOR UPDATE
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "deals_delete" ON deals;
CREATE POLICY "deals_delete" ON deals FOR DELETE
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

-- Backfill: chaque lead avec status='clos' et deal_amount > 0 devient un deal
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id, workspace_id, assigned_to, deal_amount, cash_collected, deal_installments, closed_at, created_at
           FROM leads
           WHERE status = 'clos' AND deal_amount IS NOT NULL AND deal_amount > 0
  LOOP
    INSERT INTO deals (
      workspace_id, lead_id,
      closer_id,
      amount, cash_collected, installments,
      started_at,
      status
    )
    SELECT r.workspace_id, r.id,
           r.assigned_to,
           r.deal_amount, COALESCE(r.cash_collected, 0), COALESCE(r.deal_installments, 1),
           COALESCE(r.closed_at, r.created_at, NOW()),
           'active'
    WHERE NOT EXISTS (
      SELECT 1 FROM deals d WHERE d.lead_id = r.id AND d.started_at = COALESCE(r.closed_at, r.created_at, NOW())
    );
  END LOOP;
END $$;

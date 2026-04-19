-- ============================================================================
-- Migration 037: Billing Plans
-- Table de référence des plans tarifaires (Trial/Starter/Pro/Scale/Internal)
-- avec quotas inclus de consommables.
-- ============================================================================

CREATE TABLE billing_plans (
  id TEXT PRIMARY KEY,
  stripe_price_id TEXT,
  stripe_seat_price_id TEXT,
  name TEXT NOT NULL,
  description TEXT,

  -- Tarification
  base_price_cents INT NOT NULL DEFAULT 0,
  additional_seat_price_cents INT NOT NULL DEFAULT 0,
  max_seats INT,

  -- Quotas mensuels inclus
  quota_emails INT NOT NULL DEFAULT 0,
  quota_emails_per_seat INT NOT NULL DEFAULT 0,
  quota_ai_tokens BIGINT NOT NULL DEFAULT 0,
  quota_ai_tokens_per_seat BIGINT NOT NULL DEFAULT 0,
  quota_whatsapp INT NOT NULL DEFAULT 0,
  quota_whatsapp_per_seat INT NOT NULL DEFAULT 0,

  -- Fair-use cap (bloque l'overage au-delà pour pousser upgrade)
  fair_use_emails_cap INT,

  -- Prix overage (cents par 1000 unités / 1000 tokens)
  overage_email_price_cents_per_1k INT NOT NULL DEFAULT 0,
  overage_ai_tokens_price_cents_per_1k INT NOT NULL DEFAULT 0,
  overage_whatsapp_price_cents_per_1k INT NOT NULL DEFAULT 0,

  -- Métadonnées
  features JSONB NOT NULL DEFAULT '{}'::jsonb,
  display_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_public BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed initial des 5 plans (décisions 2026-04-19, audit business pricing)
INSERT INTO billing_plans (
  id, name, description,
  base_price_cents, additional_seat_price_cents, max_seats,
  quota_emails, quota_emails_per_seat,
  quota_ai_tokens, quota_ai_tokens_per_seat,
  quota_whatsapp, quota_whatsapp_per_seat,
  fair_use_emails_cap,
  overage_email_price_cents_per_1k,
  overage_ai_tokens_price_cents_per_1k,
  overage_whatsapp_price_cents_per_1k,
  display_order, is_public
) VALUES
  -- Trial : 14 jours, quotas bas, pas d'overage possible (bloqué)
  ('trial', 'Essai 14 jours', 'Accès Pro complet pendant 14 jours',
   0, 0, 1,
   500, 0,
   50000, 0,
   50, 0,
   500, -- fair-use = quota (bloqué dès dépassement)
   0, 0, 0,
   0, true),

  -- Starter : coach solo débutant
  ('starter', 'Starter', 'Pour coach solo qui démarre',
   2900, 0, 1,
   5000, 0,
   500000, 0,
   300, 0,
   30000, -- fair-use cap 30k emails/mois
   100, -- 1€ / 1000 emails overage
   100, -- 1€ / 1000 tokens IA overage
   800, -- 8€ / 1000 WhatsApp (markup x2 vs ~4€ coût Meta)
   1, true),

  -- Pro : coach actif + petite équipe
  ('pro', 'Pro', 'Coach actif, équipe 1-3 personnes',
   5900, 2900, 3,
   10000, 3000,
   2000000, 500000,
   1500, 300,
   30000,
   100,
   100,
   800,
   2, true),

  -- Scale : cabinet / agence
  ('scale', 'Scale', 'Cabinet ou agence avec équipe',
   14900, 4900, NULL,
   50000, 5000,
   10000000, 1000000,
   8000, 500,
   NULL,
   100,
   100,
   800,
   3, true),

  -- Internal : bypass complet pour co-fondateurs et beta testeurs
  ('internal', 'Interne ClosRM', 'Bypass billing (co-fondateurs et beta testeurs)',
   0, 0, NULL,
   2147483647, 0,
   9223372036854775807, 0,
   2147483647, 0,
   NULL,
   0, 0, 0,
   99, false);

COMMENT ON TABLE billing_plans IS 'Plans tarifaires ClosRM. Mis à jour 2026-04-19 selon audits docs/audits/2026-04-19-*.';

-- ============================================================================
-- Migration 042: Restaure la colonne ai_coach_briefs.api_key
-- Annule la suppression faite par migration 041 : on revient au modèle
-- "chaque coach renseigne sa propre clé Anthropic" pour V1.
-- ============================================================================

ALTER TABLE ai_coach_briefs ADD COLUMN IF NOT EXISTS api_key TEXT;

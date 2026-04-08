-- ============================================================================
-- Migration 015: Funnels v2 — Direction artistique
-- ============================================================================
-- Ajoute les champs de design system à la table funnels :
--   - preset_id        : ID du preset de couleurs choisi (cf. src/lib/funnels/presets.ts)
--   - preset_override  : override custom JSON { primary?, heroBg?, sectionBg?, footerBg? }
--   - effects_config   : map JSON des effets toggleables { 'e1-shimmer': true, ... }
--
-- Cf. T-028a (livrée le 2026-04-07) qui définit les 20 presets et 15 effets,
-- et T-028c qui consomme ces nouveaux champs depuis le rendu public et le builder.
--
-- Backfill : les funnels existants prennent automatiquement les valeurs DEFAULT
-- (preset 'ocean' + effects_config vide → fallback côté front sur DEFAULT_EFFECTS).
-- ============================================================================

ALTER TABLE funnels
  ADD COLUMN IF NOT EXISTS preset_id TEXT NOT NULL DEFAULT 'ocean';

ALTER TABLE funnels
  ADD COLUMN IF NOT EXISTS preset_override JSONB;

ALTER TABLE funnels
  ADD COLUMN IF NOT EXISTS effects_config JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Pas de CHECK constraint sur preset_id : la liste évolue côté code (presets.ts),
-- on garde la flexibilité de l'ajouter/retirer sans migration. Le helper
-- getPresetByIdOrDefault() côté front retombe sur 'ocean' si l'ID ne matche pas.

COMMENT ON COLUMN funnels.preset_id IS
  'ID du preset de couleurs choisi par le coach. Voir src/lib/funnels/presets.ts pour la liste.';
COMMENT ON COLUMN funnels.preset_override IS
  'Override custom des couleurs du preset. Format: { primary?, heroBg?, sectionBg?, footerBg? } (tout en hex #RRGGBB).';
COMMENT ON COLUMN funnels.effects_config IS
  'Map des effets visuels toggleables { effectId: boolean }. Les effets forcés (E4/E5/E6) sont systématiquement actifs côté rendu, peu importe ce qui est stocké ici.';

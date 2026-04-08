/**
 * Configuration par défaut des effets visuels pour un nouveau funnel.
 *
 * - Effets forcés (E4, E5, E6) : toujours `true`, ne peuvent pas être désactivés
 * - Effets toggleables ON par défaut : E1, E2, E3, E7, E8, E12, E15
 * - Effets toggleables OFF par défaut : E9, E10, E11, E13, E14
 *
 * Cette config est utilisée :
 * - Comme valeur initiale dans la sandbox
 * - Comme valeur de backfill pour les funnels existants en T-028c
 * - Comme valeur initiale lors de la création d'un nouveau funnel en T-028b
 */

import type { FunnelEffectId, FunnelEffectMeta, FunnelEffectsConfig } from './design-types'

/**
 * T-028 Phase 9 — Configuration par défaut de TOUS les effets listés dans
 * `FunnelEffectId`. N'inclut plus E7, E9, E10, E11 (retirés du catalogue).
 *
 * Les effets "par bloc" (E1, E3) ont ici leur valeur "default global" pour
 * les cas legacy/sandbox où on active tout en bloc. À l'usage réel du
 * builder, ils sont gérés par `block.config.effects.*`, pas via cette map.
 */
export const DEFAULT_EFFECTS: Record<FunnelEffectId, boolean> = {
  // Forcés (toujours actifs)
  'e4-colored-shadow': true,
  'e5-badge-pulse': true,
  'e6-lightbox': true,
  // Effets par-bloc (defaults pour fallback legacy — gérés via block.config.effects au runtime)
  'e1-shimmer': true,
  'e3-button-shine': true,
  // Globaux toggleables ON par défaut
  'e2-hero-glow': true,
  'e8-reveal-scroll': true,
  'e12-noise': true,
  'e15-sticky-cta': true,
}

/**
 * Métadonnées d'affichage des effets pour la sidebar du builder.
 * L'ordre dans ce tableau est l'ordre d'affichage dans l'UI.
 *
 * T-028 Phase 9 — 3 catégories :
 * - `forced` : toujours actifs, grisés dans la sidebar globale
 * - `global` : toggles de la sidebar "Direction artistique" (s'applique à tout le funnel)
 * - `block`  : toggles de l'inspector de droite (s'applique au bloc sélectionné)
 */
export const EFFECT_META: readonly FunnelEffectMeta[] = [
  // ─── Forcés (toujours actifs, non cliquables) ────────────────────────
  { id: 'e4-colored-shadow', label: 'Ombre colorée', description: 'Ombre teintée par la couleur principale sur les boutons et cards', category: 'forced', defaultEnabled: true },
  { id: 'e5-badge-pulse', label: 'Badge pulsant', description: 'Animation de pulse sur les badges (point clignotant)', category: 'forced', defaultEnabled: true },
  { id: 'e6-lightbox', label: 'Lightbox images', description: 'Ouverture en grand des images de témoignages au clic', category: 'forced', defaultEnabled: true },

  // ─── Globaux toggleables (sidebar Direction artistique) ──────────────
  { id: 'e2-hero-glow', label: 'Glow hero', description: 'Cercles lumineux flous derrière le hero (radial gradients)', category: 'global', defaultEnabled: true },
  { id: 'e8-reveal-scroll', label: 'Reveal au scroll', description: 'Les blocs apparaissent en fade-in au scroll', category: 'global', defaultEnabled: true },
  { id: 'e12-noise', label: 'Texture grain', description: 'Léger grain (noise) sur tout le funnel pour un rendu premium', category: 'global', defaultEnabled: true },
  { id: 'e15-sticky-cta', label: 'CTA sticky mobile', description: 'Bouton principal toujours visible en bas sur mobile', category: 'global', defaultEnabled: true },

  // ─── Par bloc (inspector de droite) ──────────────────────────────────
  { id: 'e1-shimmer', label: 'Shimmer texte', description: 'Animation de brillance sur les portions de texte mises en avant', category: 'block', defaultEnabled: true },
  { id: 'e3-button-shine', label: 'Shine bouton', description: 'Reflet blanc qui traverse le bouton toutes les 4-5s', category: 'block', defaultEnabled: true },
] as const

/**
 * Merge une config utilisateur partielle avec les defaults.
 * Les effets forcés sont systématiquement réécrits à `true`.
 * Les effets par-bloc (E1, E3) NE SONT PAS appliqués globalement à travers
 * cette map — ils sont gérés au niveau de chaque bloc via `block.config.effects`.
 */
export function mergeEffectsConfig(userConfig?: FunnelEffectsConfig): Record<FunnelEffectId, boolean> {
  return {
    ...DEFAULT_EFFECTS,
    ...userConfig,
    // Forcés non négociables
    'e4-colored-shadow': true,
    'e5-badge-pulse': true,
    'e6-lightbox': true,
    // Effets par-bloc désactivés au niveau global (ils ne s'appliquent que
    // via block.config.effects dans l'inspector)
    'e1-shimmer': false,
    'e3-button-shine': false,
  }
}

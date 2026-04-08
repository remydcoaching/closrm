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

export const DEFAULT_EFFECTS: Record<FunnelEffectId, boolean> = {
  // Forcés (toujours actifs)
  'e4-colored-shadow': true,
  'e5-badge-pulse': true,
  'e6-lightbox': true,
  // Toggleables ON par défaut
  'e1-shimmer': true,
  'e2-hero-glow': true,
  'e3-button-shine': true,
  'e7-count-up': true,
  'e8-reveal-scroll': true,
  'e12-noise': true,
  'e15-sticky-cta': true,
  // Toggleables OFF par défaut
  'e9-marquee': false,
  'e10-countdown': false,
  'e11-before-after': false,
  'e13-parallax': false,
  'e14-cursor-glow': false,
}

/**
 * Métadonnées d'affichage des effets pour la sidebar du builder.
 * L'ordre dans ce tableau est l'ordre d'affichage dans l'UI.
 */
export const EFFECT_META: readonly FunnelEffectMeta[] = [
  // Forcés en premier (grisés / non cliquables dans le builder)
  { id: 'e4-colored-shadow', label: 'Ombre colorée', description: 'Ombre teintée par la couleur principale sur les boutons et cards', category: 'forced', defaultEnabled: true },
  { id: 'e5-badge-pulse', label: 'Badge pulsant', description: 'Animation de pulse sur les badges (point clignotant)', category: 'forced', defaultEnabled: true },
  { id: 'e6-lightbox', label: 'Lightbox images', description: 'Ouverture en grand des images de témoignages au clic', category: 'forced', defaultEnabled: true },
  // Toggleables ON par défaut
  { id: 'e1-shimmer', label: 'Shimmer texte', description: 'Animation de brillance sur les portions de texte mises en avant', category: 'toggleable', defaultEnabled: true },
  { id: 'e2-hero-glow', label: 'Glow hero', description: 'Cercles lumineux flous derrière le hero (radial gradients)', category: 'toggleable', defaultEnabled: true },
  { id: 'e3-button-shine', label: 'Shine boutons', description: 'Reflet blanc qui traverse les boutons toutes les 4-5s', category: 'toggleable', defaultEnabled: true },
  { id: 'e7-count-up', label: 'Compteur animé', description: 'Les chiffres clés montent de 0 à leur valeur cible quand ils apparaissent', category: 'toggleable', defaultEnabled: true },
  { id: 'e8-reveal-scroll', label: 'Reveal au scroll', description: 'Les blocs apparaissent en fade-in au scroll', category: 'toggleable', defaultEnabled: true },
  { id: 'e12-noise', label: 'Texture grain', description: 'Léger grain (noise) sur tout le funnel pour un rendu premium', category: 'toggleable', defaultEnabled: true },
  { id: 'e15-sticky-cta', label: 'CTA sticky mobile', description: 'Bouton principal toujours visible en bas sur mobile', category: 'toggleable', defaultEnabled: true },
  // Toggleables OFF par défaut
  { id: 'e9-marquee', label: 'Bandeau logos défilant', description: 'Logos clients qui défilent en boucle (logo bar)', category: 'toggleable', defaultEnabled: false },
  { id: 'e10-countdown', label: 'Compte à rebours', description: 'Timer JJ:HH:MM:SS avant fin d\'offre, sticky au-dessus du CTA', category: 'toggleable', defaultEnabled: false },
  { id: 'e11-before-after', label: 'Slider avant/après', description: 'Image avec curseur draggable pour révéler avant/après', category: 'toggleable', defaultEnabled: false },
  { id: 'e13-parallax', label: 'Parallax hero', description: 'Le fond du hero se déplace légèrement avec le scroll', category: 'toggleable', defaultEnabled: false },
  { id: 'e14-cursor-glow', label: 'Halo curseur', description: 'Halo lumineux qui suit la souris sur le hero (desktop seulement)', category: 'toggleable', defaultEnabled: false },
] as const

/**
 * Merge une config utilisateur partielle avec les defaults.
 * Les effets forcés sont systématiquement réécrits à `true`.
 */
export function mergeEffectsConfig(userConfig?: FunnelEffectsConfig): Record<FunnelEffectId, boolean> {
  return {
    ...DEFAULT_EFFECTS,
    ...userConfig,
    // Forcés non négociables
    'e4-colored-shadow': true,
    'e5-badge-pulse': true,
    'e6-lightbox': true,
  }
}

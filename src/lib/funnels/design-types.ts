/**
 * Design system types pour Funnels v2 (T-028a).
 *
 * Ces types décrivent la couche "direction artistique" :
 * - Presets de couleurs (palettes prêtes à l'emploi)
 * - Effets visuels activables (forcés / toggleables)
 * - Override personnalisé d'un preset (couleur principale uniquement en V1)
 *
 * Ils sont volontairement séparés des types `FunnelBlockConfig` (src/types/index.ts)
 * qui décrivent la structure de contenu d'un bloc.
 */

export type FunnelPresetStyle = 'light' | 'dark'

export interface FunnelPreset {
  /** ID stable, utilisé en base et en URL. Format kebab-case. */
  id: string
  /** Nom affiché à l'utilisateur dans le sélecteur de preset. */
  name: string
  /** Détermine la couleur de texte par défaut (clair sur sombre / sombre sur clair). */
  style: FunnelPresetStyle
  /** Couleur principale en hex (#RRGGBB). Sert de base pour boutons, accents, glows. */
  primary: string
  /** Fond de la section hero (#RRGGBB). */
  heroBg: string
  /** Fond des sections de contenu (témoignages, pricing, etc.). */
  sectionBg: string
  /** Fond du footer. */
  footerBg: string
}

/**
 * Catalogue exhaustif des effets visuels du design system.
 * Chaque ID correspond à un fichier CSS sous src/styles/funnels/effects/.
 */
export type FunnelEffectId =
  | 'e1-shimmer'
  | 'e2-hero-glow'
  | 'e3-button-shine'
  | 'e4-colored-shadow'
  | 'e5-badge-pulse'
  | 'e6-lightbox'
  | 'e7-count-up'
  | 'e8-reveal-scroll'
  | 'e9-marquee'
  | 'e10-countdown'
  | 'e11-before-after'
  | 'e12-noise'
  | 'e13-parallax'
  | 'e14-cursor-glow'
  | 'e15-sticky-cta'

/**
 * Effets toujours actifs (font partie de l'ADN visuel des funnels v2).
 * Ne peuvent pas être désactivés par l'utilisateur via le builder.
 */
export const FORCED_EFFECTS: readonly FunnelEffectId[] = [
  'e4-colored-shadow',
  'e5-badge-pulse',
  'e6-lightbox',
] as const

/**
 * Effets toggleables — affichés comme switches dans la sidebar du builder.
 * Granularité globale au funnel (cf. T-028b).
 */
export const TOGGLEABLE_EFFECTS: readonly FunnelEffectId[] = [
  'e1-shimmer',
  'e2-hero-glow',
  'e3-button-shine',
  'e7-count-up',
  'e8-reveal-scroll',
  'e9-marquee',
  'e10-countdown',
  'e11-before-after',
  'e12-noise',
  'e13-parallax',
  'e14-cursor-glow',
  'e15-sticky-cta',
] as const

/**
 * Métadonnées d'affichage d'un effet (label, description, catégorie pour le tri).
 */
export interface FunnelEffectMeta {
  id: FunnelEffectId
  label: string
  description: string
  category: 'forced' | 'toggleable'
  defaultEnabled: boolean
}

/**
 * Configuration des effets pour un funnel donné.
 * Map effect-id → enabled. Les effets forcés sont toujours considérés comme `true`
 * côté rendu, peu importe ce qui est stocké ici.
 */
export type FunnelEffectsConfig = Partial<Record<FunnelEffectId, boolean>>

/**
 * Override d'un preset par l'utilisateur. Tous les champs sont optionnels :
 * un override absent retombe sur la valeur du preset de base.
 *
 * Note design : permettre d'override les 4 fonds + la couleur principale
 * crée beaucoup de combinaisons possibles (et donc de risques de mauvais
 * contrastes texte/fond). À documenter dans le builder T-028b avec un
 * preview live + un avertissement si le contraste calculé est trop faible.
 */
export interface FunnelPresetOverride {
  primary?: string
  heroBg?: string
  sectionBg?: string
  footerBg?: string
}

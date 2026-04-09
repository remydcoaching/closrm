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
 *
 * T-028 Phase 9 (refactor post-MVP) — 6 effets retirés du catalogue :
 * - E7 count-up, E9 marquee, E10 countdown, E11 before-after : en réalité
 *   des "types de contenu", pas des effets visuels. Seront implémentés
 *   comme des blocs dédiés en V2 (MarqueeBlock, StatsBlock, BeforeAfterBlock).
 *   Le CountdownBlock existe déjà (cf. src/components/funnels/blocks/).
 * - E13 parallax, E14 cursor glow : dépendaient de hooks React (useParallax,
 *   useCursorGlow) qui n'étaient appelés que dans la sandbox. Sans ces hooks,
 *   les CSS vars --fnl-parallax-y / --fnl-cursor-x ne sont jamais setées en
 *   production → ces effets ne fonctionnaient pas dans le vrai funnel.
 *   Retirés pour éviter d'exposer des effets cassés. À réimplémenter en V2
 *   avec une intégration directe dans FunnelBuilderV2 + rendu public si un
 *   coach en fait la demande.
 *
 * T-028 Phase 9 — E1 shimmer et E3 button-shine déplacés des effets globaux
 * vers les effets "par bloc" (activables sur Hero / CTA / Text via l'inspector).
 */
export type FunnelEffectId =
  | 'e1-shimmer'
  | 'e2-hero-glow'
  | 'e3-button-shine'
  | 'e4-colored-shadow'
  | 'e5-badge-pulse'
  | 'e6-lightbox'
  | 'e8-reveal-scroll'
  | 'e12-noise'
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
 * Effets toggleables GLOBAUX — affichés comme switches dans la sidebar
 * "Direction artistique". S'appliquent à tout le funnel en bloc.
 */
export const GLOBAL_TOGGLEABLE_EFFECTS: readonly FunnelEffectId[] = [
  'e2-hero-glow',
  'e8-reveal-scroll',
  'e12-noise',
  'e15-sticky-cta',
] as const

/**
 * Effets toggleables PAR BLOC — affichés uniquement dans l'inspector à droite
 * quand un bloc compatible est sélectionné (Hero, CTA, Text).
 * Ils sont stockés dans `block.config.effects` (cf. BlockEffectsJSON).
 */
export const BLOCK_TOGGLEABLE_EFFECTS: readonly FunnelEffectId[] = [
  'e1-shimmer',
  'e3-button-shine',
] as const

/**
 * @deprecated T-028 Phase 9 — Cette liste est gardée pour compat rétro avec
 * les anciennes sandboxes (`/dev/funnels-sandbox` et `/dev/funnels-blocks-matrix`)
 * qui testent encore tous les effets en un seul panneau. Les composants runtime
 * doivent utiliser `GLOBAL_TOGGLEABLE_EFFECTS` et `BLOCK_TOGGLEABLE_EFFECTS`.
 */
export const TOGGLEABLE_EFFECTS: readonly FunnelEffectId[] = [
  ...GLOBAL_TOGGLEABLE_EFFECTS,
  ...BLOCK_TOGGLEABLE_EFFECTS,
] as const

/**
 * Métadonnées d'affichage d'un effet (label, description, catégorie pour le tri).
 *
 * T-028 Phase 9 — Nouvelle catégorie `block` pour les effets qui ne
 * s'appliquent qu'à un bloc spécifique via l'inspector. La sidebar globale
 * ne montre que `forced` + `global`. L'inspector ne montre que `block`.
 */
export interface FunnelEffectMeta {
  id: FunnelEffectId
  label: string
  description: string
  category: 'forced' | 'global' | 'block'
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

/**
 * Helpers d'application d'un preset Funnels v2 sur le DOM.
 *
 * Deux usages :
 * 1. `getPresetCssVars(preset, override?)` → objet `{ '--fnl-primary': '#XXX', ... }`
 *    utilisable directement comme `style` React sur un container
 * 2. `applyPresetToElement(el, preset, override?)` → mute un HTMLElement existant
 *    (utile dans la sandbox quand on change le preset à la volée)
 */

import type { FunnelBlock, BlockEffectsJSON } from '@/types'
import type { FunnelPreset, FunnelPresetOverride } from './design-types'
import type { FunnelEffectId, FunnelEffectsConfig } from './design-types'
import { hexToRgb, lighten, darken } from './color-utils'
import { mergeEffectsConfig } from './effects-defaults'

/** Quantité de blanc/noir ajoutée pour les variantes claire/sombre. */
const VARIANT_AMOUNT = 30

/**
 * Construit le mapping CSS vars `--fnl-*` à appliquer sur un container `.fnl-root`.
 *
 * Le `style` React (camelCase) ne supporte pas les CSS custom properties typées,
 * donc on retourne un `Record<string, string>` que tu castes en `React.CSSProperties`
 * au moment de l'utiliser :
 *
 *   <div className="fnl-root" style={getPresetCssVars(preset) as React.CSSProperties}>
 */
export function getPresetCssVars(
  preset: FunnelPreset,
  override?: FunnelPresetOverride
): Record<string, string> {
  const primary = override?.primary ?? preset.primary
  const heroBg = override?.heroBg ?? preset.heroBg
  const sectionBg = override?.sectionBg ?? preset.sectionBg
  const footerBg = override?.footerBg ?? preset.footerBg

  return {
    '--fnl-primary': primary,
    '--fnl-primary-light': lighten(primary, VARIANT_AMOUNT),
    '--fnl-primary-dark': darken(primary, VARIANT_AMOUNT),
    '--fnl-primary-rgb': hexToRgb(primary),
    '--fnl-hero-bg': heroBg,
    '--fnl-section-bg': sectionBg,
    '--fnl-footer-bg': footerBg,
    '--fnl-text': preset.style === 'dark' ? '#FFFFFF' : '#2D2D2D',
    '--fnl-text-secondary': preset.style === 'dark' ? '#B0B0B0' : '#555555',
  }
}

/**
 * Applique un preset à un HTMLElement existant en mutant ses CSS vars inline.
 * Utile pour la sandbox où l'on change le preset sans rerender complet.
 */
export function applyPresetToElement(
  el: HTMLElement,
  preset: FunnelPreset,
  override?: FunnelPresetOverride
): void {
  const vars = getPresetCssVars(preset, override)
  for (const [key, value] of Object.entries(vars)) {
    el.style.setProperty(key, value)
  }
}

/**
 * Construit la liste des classes CSS à appliquer sur le container `.fnl-root`
 * pour activer les effets toggleables sélectionnés.
 *
 * T-028 Phase 9 — Ne retourne que les classes des effets **forcés + globaux**.
 * Les effets par-bloc (E1 shimmer, E3 button-shine) sont désormais appliqués
 * via `getBlockEffectsClasses(block)` sur un wrapper dédié, PAS sur `.fnl-root`.
 *
 * Convention : un effet `eX-foo` activé ajoute la classe `fx-eX-foo` au container.
 * Les effets forcés sont toujours inclus (peu importe la config user).
 */
export function getEffectsClassNames(userConfig?: FunnelEffectsConfig): string[] {
  const merged = mergeEffectsConfig(userConfig)
  const classes: string[] = []
  for (const [id, enabled] of Object.entries(merged)) {
    if (enabled) {
      classes.push(`fx-${id as FunnelEffectId}`)
    }
  }
  return classes
}

/**
 * T-028 Phase 9 — Retourne les classes CSS à appliquer sur un wrapper autour
 * d'un bloc précis, en fonction de sa config `effects` (stockée dans le JSONB
 * `blocks` de `funnel_pages`).
 *
 * Tous les types de blocs ne supportent pas tous les effets :
 * - `hero` : shimmer (titre) + buttonShine (CTA)
 * - `cta`  : buttonShine
 * - `text` : shimmer
 * - autres : aucun effet par-bloc (retourne `[]`)
 *
 * Appelée par le renderer pour décider si on wrap le bloc dans un `<div>`
 * avec les classes `fx-e1-shimmer fx-e3-button-shine`.
 */
export function getBlockEffectsClasses(block: FunnelBlock): string[] {
  const classes: string[] = []
  const effects = (block.config as { effects?: BlockEffectsJSON }).effects

  if (!effects) return classes

  // Shimmer — Hero + Text
  if (effects.shimmer && (block.type === 'hero' || block.type === 'text')) {
    classes.push('fx-e1-shimmer')
  }
  // Button shine — Hero + CTA
  if (effects.buttonShine && (block.type === 'hero' || block.type === 'cta')) {
    classes.push('fx-e3-button-shine')
  }

  return classes
}

/**
 * T-028 Phase 9 — Defaults per-block effects selon le type du bloc.
 * Utilisé au moment de créer un nouveau bloc dans le builder pour initialiser
 * `config.effects` avec des valeurs cohérentes (shimmer ON sur Hero par
 * défaut, button shine ON sur CTA par défaut, etc.).
 */
export function getDefaultBlockEffects(
  type: FunnelBlock['type'],
): BlockEffectsJSON | undefined {
  switch (type) {
    case 'hero':
      return { shimmer: true, buttonShine: true }
    case 'cta':
      return { buttonShine: true }
    case 'text':
      return { shimmer: false }
    default:
      return undefined
  }
}

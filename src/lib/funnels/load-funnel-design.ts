/**
 * T-028c — Helper de chargement du design system d'un funnel.
 *
 * Prend un objet `Funnel` (issu de la base) et retourne tout ce qu'il faut
 * pour wrapper son rendu dans un container `.fnl-root` correctement stylé :
 *   - les CSS custom properties (`--fnl-*`) à appliquer en `style`
 *   - la liste des classes `.fx-eX-*` à appliquer pour activer les effets
 *
 * Ce helper est l'unique point d'entrée appelé depuis :
 *   - `FunnelPagePreview.tsx` (preview admin du builder)
 *   - `app/(public)/f/[workspaceSlug]/[funnelSlug]/[pageSlug]/page.tsx` (rendu public)
 *
 * Il s'occupe aussi du fallback défensif : si un funnel a un `preset_id` inconnu
 * ou pas d'`effects_config`, on retombe proprement sur les valeurs par défaut au
 * lieu de crasher.
 */

import type { Funnel } from '@/types'
import { getPresetByIdOrDefault } from './presets'
import { getPresetCssVars, getEffectsClassNames } from './apply-preset'
import type { FunnelPresetOverride, FunnelEffectsConfig } from './design-types'

interface FunnelDesign {
  /** CSS vars à appliquer en `style` sur le container `.fnl-root`. */
  cssVars: React.CSSProperties
  /** Classes CSS à concaténer avec `fnl-root` (effets activés). */
  effectsClassName: string
  /** Le preset résolu (utile pour debug ou affichage du nom). */
  presetName: string
  presetId: string
}

/**
 * Charge le design d'un funnel à partir des champs en base.
 *
 * Tolère les funnels créés avant la migration 015 (preset_id null/undefined,
 * preset_override null, effects_config null) en retombant sur les defaults.
 */
export function loadFunnelDesign(
  funnel: Pick<Funnel, 'preset_id' | 'preset_override' | 'effects_config'>
): FunnelDesign {
  const preset = getPresetByIdOrDefault(funnel.preset_id)

  // preset_override est typé `FunnelPresetOverrideJSON | null` côté DB et
  // `FunnelPresetOverride` côté lib — même shape, on cast pour éviter le cycle d'imports.
  const override = (funnel.preset_override ?? undefined) as FunnelPresetOverride | undefined

  // effects_config peut être une map vide ou null sur les vieux funnels.
  // mergeEffectsConfig (appelé indirectement par getEffectsClassNames) gère le fallback.
  const effects = (funnel.effects_config ?? {}) as FunnelEffectsConfig

  const cssVars = getPresetCssVars(preset, override) as React.CSSProperties
  const effectsClasses = getEffectsClassNames(effects)

  return {
    cssVars,
    effectsClassName: effectsClasses.join(' '),
    presetName: preset.name,
    presetId: preset.id,
  }
}

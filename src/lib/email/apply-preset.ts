/**
 * Applique un preset + override pour produire la palette résolue utilisée
 * partout (compiler, preview, inspector). Équivalent léger de
 * `src/lib/funnels/apply-preset.ts`.
 */

import type { EmailPreset, EmailPresetOverride } from './design-types'
import { buttonShapeToRadius } from './design-types'

/**
 * Merge preset + override → preset final résolu. Les champs de l'override qui
 * sont `undefined` ou `null` sont ignorés (on garde la valeur du preset).
 */
export function mergePresetOverride(
  preset: EmailPreset,
  override?: EmailPresetOverride | null,
): EmailPreset {
  if (!override) return preset
  return {
    ...preset,
    primary: override.primary ?? preset.primary,
    background: override.background ?? preset.background,
    containerBg: override.containerBg ?? preset.containerBg,
    footerBg: override.footerBg ?? preset.footerBg,
    fontFamily: override.fontFamily ?? preset.fontFamily,
    headingFontFamily: override.headingFontFamily ?? preset.headingFontFamily,
    buttonShape: override.buttonShape ?? preset.buttonShape,
    buttonShadow: override.buttonShadow ?? preset.buttonShadow,
  }
}

/**
 * Retourne les tokens CSS prêts à être injectés dans un `<style>` d'email
 * (ex: `--email-primary: #E53E3E`). Note : la plupart des clients mail ne
 * supportent pas les CSS variables, donc le compiler v2 résout à la place
 * directement les valeurs inline. Cette fonction est surtout utilisée pour
 * la preview UI.
 */
export function getEmailPresetCssVars(preset: EmailPreset): Record<string, string> {
  return {
    '--email-primary': preset.primary,
    '--email-bg': preset.background,
    '--email-container-bg': preset.containerBg,
    '--email-footer-bg': preset.footerBg,
    '--email-text': preset.textColor,
    '--email-muted': preset.mutedColor,
    '--email-font': preset.fontFamily,
    '--email-heading-font': preset.headingFontFamily || preset.fontFamily,
    '--email-btn-radius': `${buttonShapeToRadius(preset.buttonShape)}px`,
    '--email-btn-shadow': preset.buttonShadow
      ? `0 2px 8px ${preset.primary}40`
      : 'none',
  }
}

/** Applique un style inline sur un bouton à partir du preset. */
export function getButtonInlineStyle(preset: EmailPreset): string {
  const radius = buttonShapeToRadius(preset.buttonShape)
  const shadow = preset.buttonShadow ? `box-shadow: 0 2px 8px ${preset.primary}40;` : ''
  return `display: inline-block; padding: 12px 28px; background-color: ${preset.primary}; color: #ffffff; text-decoration: none; border-radius: ${radius}px; font-weight: 600; font-size: 15px; font-family: ${preset.fontFamily}; ${shadow}`
}

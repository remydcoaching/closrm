/**
 * Types du design system email v2. Inspiré de `src/lib/funnels/design-types.ts`
 * mais adapté aux contraintes des clients mail (pas de JS, peu de CSS, pas
 * de variables CSS fiables → on résout les couleurs au compile time).
 */

export type EmailFontFamily =
  | "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
  | "Georgia, 'Times New Roman', serif"
  | "'Playfair Display', Georgia, serif"
  | "'JetBrains Mono', 'Courier New', monospace"
  | "'Lora', Georgia, serif"
  | "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif"
  | "'Source Serif 4', Georgia, serif"
  | "'Raleway', -apple-system, BlinkMacSystemFont, sans-serif"

export type EmailButtonShape = 'sharp' | 'rounded' | 'pill'

export interface EmailPreset {
  id: string
  name: string
  style: 'light' | 'dark'
  primary: string
  background: string      // body de la page (derrière la carte)
  containerBg: string     // la carte email
  footerBg: string
  textColor: string
  mutedColor: string
  fontFamily: EmailFontFamily
  headingFontFamily?: EmailFontFamily // fallback = fontFamily
  buttonShape: EmailButtonShape
  buttonShadow: boolean
}

export interface EmailPresetOverride {
  primary?: string
  background?: string
  containerBg?: string
  footerBg?: string
  fontFamily?: EmailFontFamily
  headingFontFamily?: EmailFontFamily
  buttonShape?: EmailButtonShape
  buttonShadow?: boolean
}

/** Convertit EmailButtonShape en pixel radius pour les boutons. */
export function buttonShapeToRadius(shape: EmailButtonShape): number {
  switch (shape) {
    case 'sharp':
      return 0
    case 'rounded':
      return 6
    case 'pill':
      return 999
  }
}

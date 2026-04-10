/**
 * Helpers de manipulation de couleurs hex.
 * Utilisés par apply-preset.ts pour générer les variantes (light, dark, rgb)
 * d'une couleur principale donnée par un preset.
 *
 * Tous les inputs doivent être au format `#RRGGBB` (6 chiffres hex avec ou sans #).
 */

function parseHex(hex: string): [number, number, number] {
  const cleaned = hex.replace('#', '')
  if (cleaned.length !== 6) {
    throw new Error(`Invalid hex color "${hex}" — expected #RRGGBB`)
  }
  const r = parseInt(cleaned.slice(0, 2), 16)
  const g = parseInt(cleaned.slice(2, 4), 16)
  const b = parseInt(cleaned.slice(4, 6), 16)
  return [r, g, b]
}

function toHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)))
  return (
    '#' +
    [clamp(r), clamp(g), clamp(b)]
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('')
  )
}

/** Convertit `#3B82F6` → `"59, 130, 246"` (utilisable dans `rgba(...)`). */
export function hexToRgb(hex: string): string {
  const [r, g, b] = parseHex(hex)
  return `${r}, ${g}, ${b}`
}

/** Éclaircit chaque composante RGB de `amount` (0-255). */
export function lighten(hex: string, amount: number): string {
  const [r, g, b] = parseHex(hex)
  return toHex(r + amount, g + amount, b + amount)
}

/** Assombrit chaque composante RGB de `amount` (0-255). */
export function darken(hex: string, amount: number): string {
  const [r, g, b] = parseHex(hex)
  return toHex(r - amount, g - amount, b - amount)
}

/**
 * Calcule la luminance perçue d'une couleur (formule WCAG simplifiée).
 * Retourne une valeur entre 0 (noir) et 1 (blanc).
 * Utile pour décider d'afficher du texte clair ou sombre par-dessus.
 */
export function luminance(hex: string): number {
  const [r, g, b] = parseHex(hex)
  // Approximation perceptive (sRGB linearization simplifiée)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}

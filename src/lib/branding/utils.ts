/**
 * Darken a hex color by a percentage.
 */
export function darkenHex(hex: string, percent: number): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex
  const factor = 1 - percent / 100
  const r = Math.round(rgb.r * factor)
  const g = Math.round(rgb.g * factor)
  const b = Math.round(rgb.b * factor)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

/**
 * Convert hex color to RGB components.
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const match = hex.replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)
  if (!match) return null
  return {
    r: parseInt(match[1], 16),
    g: parseInt(match[2], 16),
    b: parseInt(match[3], 16),
  }
}

/**
 * Validate that a string is a valid 6-digit hex color.
 */
export function isValidHex(hex: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(hex)
}

/**
 * Preset accent colors available in the color picker.
 */
export const ACCENT_PRESETS = [
  { name: 'Vert', hex: '#00C853' },
  { name: 'Rouge', hex: '#E53E3E' },
  { name: 'Bleu', hex: '#3B82F6' },
  { name: 'Violet', hex: '#8B5CF6' },
  { name: 'Ambre', hex: '#F59E0B' },
  { name: 'Rose', hex: '#EC4899' },
  { name: 'Cyan', hex: '#06B6D4' },
  { name: 'Orange', hex: '#F97316' },
  { name: 'Teal', hex: '#14B8A6' },
  { name: 'Indigo', hex: '#6366F1' },
  { name: 'Lime', hex: '#84CC16' },
  { name: 'Noir', hex: '#000000' },
] as const

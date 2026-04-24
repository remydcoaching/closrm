/**
 * 8 presets email ciblés. Chaque preset définit palette + typo + style bouton.
 * Utilisés par le builder v2 (design system) et le compiler v2 pour produire
 * du HTML inline-styled.
 */

import type { EmailPreset } from './design-types'

const FONT_SANS = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" as const
const FONT_SERIF = "Georgia, 'Times New Roman', serif" as const
const FONT_DISPLAY = "'Playfair Display', Georgia, serif" as const

export const EMAIL_PRESETS: EmailPreset[] = [
  {
    id: 'classique',
    name: 'Classique',
    style: 'light',
    primary: '#111111',
    background: '#f4f4f5',
    containerBg: '#ffffff',
    footerBg: '#f8f8f8',
    textColor: '#1a1a1a',
    mutedColor: '#6b7280',
    fontFamily: FONT_SERIF,
    headingFontFamily: FONT_SERIF,
    buttonShape: 'sharp',
    buttonShadow: false,
  },
  {
    id: 'impact',
    name: 'Impact',
    style: 'light',
    primary: '#E53E3E',
    background: '#ffffff',
    containerBg: '#ffffff',
    footerBg: '#1a1a1a',
    textColor: '#111111',
    mutedColor: '#6b7280',
    fontFamily: FONT_SANS,
    headingFontFamily: FONT_SANS,
    buttonShape: 'rounded',
    buttonShadow: true,
  },
  {
    id: 'ocean',
    name: 'Ocean',
    style: 'light',
    primary: '#0EA5E9',
    background: '#f0f9ff',
    containerBg: '#ffffff',
    footerBg: '#e0f2fe',
    textColor: '#0c4a6e',
    mutedColor: '#0369a1',
    fontFamily: FONT_SANS,
    headingFontFamily: FONT_SANS,
    buttonShape: 'rounded',
    buttonShadow: false,
  },
  {
    id: 'foret',
    name: 'Forêt',
    style: 'light',
    primary: '#16A34A',
    background: '#f7f5ef',
    containerBg: '#ffffff',
    footerBg: '#f0ebe0',
    textColor: '#1f2937',
    mutedColor: '#6b7280',
    fontFamily: FONT_SANS,
    headingFontFamily: FONT_SERIF,
    buttonShape: 'pill',
    buttonShadow: false,
  },
  {
    id: 'violet',
    name: 'Violet',
    style: 'light',
    primary: '#8B5CF6',
    background: '#faf8ff',
    containerBg: '#ffffff',
    footerBg: '#f3eeff',
    textColor: '#1f1b2e',
    mutedColor: '#6b7280',
    fontFamily: FONT_SANS,
    headingFontFamily: FONT_DISPLAY,
    buttonShape: 'rounded',
    buttonShadow: true,
  },
  {
    id: 'minimal',
    name: 'Minimal',
    style: 'light',
    primary: '#525252',
    background: '#ffffff',
    containerBg: '#ffffff',
    footerBg: '#fafafa',
    textColor: '#18181b',
    mutedColor: '#a1a1aa',
    fontFamily: FONT_SANS,
    headingFontFamily: FONT_SANS,
    buttonShape: 'sharp',
    buttonShadow: false,
  },
  {
    id: 'midnight',
    name: 'Midnight',
    style: 'dark',
    primary: '#FACC15',
    background: '#0a0a0a',
    containerBg: '#111111',
    footerBg: '#000000',
    textColor: '#f4f4f5',
    mutedColor: '#a1a1aa',
    fontFamily: FONT_SANS,
    headingFontFamily: FONT_SANS,
    buttonShape: 'rounded',
    buttonShadow: true,
  },
  {
    id: 'sunshine',
    name: 'Sunshine',
    style: 'light',
    primary: '#F59E0B',
    background: '#fffbeb',
    containerBg: '#ffffff',
    footerBg: '#fef3c7',
    textColor: '#1f2937',
    mutedColor: '#78716c',
    fontFamily: FONT_SANS,
    headingFontFamily: FONT_SANS,
    buttonShape: 'pill',
    buttonShadow: false,
  },
]

export const DEFAULT_EMAIL_PRESET_ID = 'classique' as const

export function getEmailPresetByIdOrDefault(id: string | null | undefined): EmailPreset {
  return EMAIL_PRESETS.find((p) => p.id === id) || EMAIL_PRESETS[0]
}

/** Featured presets affichés en premier dans la sidebar (4 sur 8). */
export const FEATURED_EMAIL_PRESET_IDS = ['classique', 'impact', 'ocean', 'foret'] as const

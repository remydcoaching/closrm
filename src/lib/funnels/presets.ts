/**
 * Catalogue des 20 presets de couleurs des Funnels v2.
 *
 * Chaque preset définit une palette cohérente (couleur principale + 3 fonds)
 * et un style (light/dark) qui détermine la couleur de texte par défaut.
 *
 * Source de vérité : `mockups/t028a-preview.html` lignes 374-395.
 *
 * Pour ajouter un nouveau preset :
 * 1. Ajouter une entrée dans `FUNNEL_PRESETS` ci-dessous
 * 2. Tester dans la sandbox `/dev/funnels-sandbox`
 * 3. Mettre à jour le mockup HTML pour cohérence
 */

import type { FunnelPreset } from './design-types'

export const FUNNEL_PRESETS: readonly FunnelPreset[] = [
  { id: 'ocean',      name: 'Ocean',      style: 'light', primary: '#3B82F6', heroBg: '#E0F2FE', sectionBg: '#FFFFFF', footerBg: '#0F172A' },
  { id: 'foret',      name: 'Forêt',      style: 'light', primary: '#10B981', heroBg: '#ECFDF5', sectionBg: '#FFFFFF', footerBg: '#064E3B' },
  { id: 'luxe',       name: 'Luxe',       style: 'dark',  primary: '#D4AF37', heroBg: '#0A0A0A', sectionBg: '#141414', footerBg: '#000000' },
  { id: 'violet',     name: 'Violet',     style: 'dark',  primary: '#A855F7', heroBg: '#1A0B2E', sectionBg: '#0F0817', footerBg: '#000000' },
  { id: 'minimal',    name: 'Minimal',    style: 'light', primary: '#171717', heroBg: '#FAFAFA', sectionBg: '#FFFFFF', footerBg: '#171717' },
  { id: 'energie',    name: 'Énergie',    style: 'light', primary: '#F97316', heroBg: '#FFF7ED', sectionBg: '#FFFFFF', footerBg: '#1C1917' },
  { id: 'rosegold',   name: 'Rose Gold',  style: 'light', primary: '#EC4899', heroBg: '#FFE4E6', sectionBg: '#FFFBFE', footerBg: '#831843' },
  { id: 'impact',     name: 'Impact',     style: 'dark',  primary: '#EF4444', heroBg: '#0F0F0F', sectionBg: '#1A1A1A', footerBg: '#000000' },
  { id: 'zen',        name: 'Zen',        style: 'light', primary: '#06B6D4', heroBg: '#F0FDFA', sectionBg: '#FFFFFF', footerBg: '#134E4A' },
  { id: 'bootcamp',   name: 'Bootcamp',   style: 'dark',  primary: '#84CC16', heroBg: '#0A0A0A', sectionBg: '#171717', footerBg: '#000000' },
  { id: 'prestige',   name: 'Prestige',   style: 'dark',  primary: '#1E40AF', heroBg: '#0C1222', sectionBg: '#0A0F1F', footerBg: '#000814' },
  { id: 'naturel',    name: 'Naturel',    style: 'light', primary: '#65A30D', heroBg: '#FEF7E6', sectionBg: '#FFFCF5', footerBg: '#3F2E1A' },
  { id: 'sunset',     name: 'Sunset',     style: 'light', primary: '#FB7185', heroBg: '#FFF1F2', sectionBg: '#FFFFFF', footerBg: '#7F1D1D' },
  { id: 'midnight',   name: 'Midnight',   style: 'dark',  primary: '#22D3EE', heroBg: '#020617', sectionBg: '#0F172A', footerBg: '#000000' },
  { id: 'bordeaux',   name: 'Bordeaux',   style: 'light', primary: '#9F1239', heroBg: '#FEF2F2', sectionBg: '#FFFFFF', footerBg: '#450A0A' },
  { id: 'terracotta', name: 'Terracotta', style: 'light', primary: '#C2410C', heroBg: '#FEF3C7', sectionBg: '#FFFBEB', footerBg: '#451A03' },
  { id: 'sunshine',   name: 'Sunshine',   style: 'light', primary: '#EAB308', heroBg: '#FEFCE8', sectionBg: '#FFFFFF', footerBg: '#422006' },
  { id: 'anthracite', name: 'Anthracite', style: 'dark',  primary: '#94A3B8', heroBg: '#1E293B', sectionBg: '#0F172A', footerBg: '#020617' },
  { id: 'tropical',   name: 'Tropical',   style: 'light', primary: '#14B8A6', heroBg: '#F0FDFA', sectionBg: '#FFFFFF', footerBg: '#134E4A' },
  { id: 'lavande',    name: 'Lavande',    style: 'light', primary: '#8B5CF6', heroBg: '#FAF5FF', sectionBg: '#FFFFFF', footerBg: '#4C1D95' },
] as const

/** Preset utilisé par défaut quand un funnel n'a pas encore été configuré. */
export const DEFAULT_PRESET_ID = 'ocean'

export function getPresetById(id: string): FunnelPreset | undefined {
  return FUNNEL_PRESETS.find((p) => p.id === id)
}

export function getPresetByIdOrDefault(id: string | null | undefined): FunnelPreset {
  if (id) {
    const found = getPresetById(id)
    if (found) return found
  }
  // Fallback : ocean est garanti dans le catalogue ci-dessus
  return FUNNEL_PRESETS[0]
}

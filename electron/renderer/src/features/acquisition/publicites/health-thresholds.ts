// Same defaults + same coloring logic as the web's
// src/app/(dashboard)/acquisition/publicites/health-thresholds.ts.
// Workspace overrides come from GET /api/ads-thresholds and are merged here.
import type { CampaignType, ThresholdOverrides } from './types'

export type HealthColor = 'green' | 'orange' | 'red'
export type Direction = 'higher_is_better' | 'lower_is_better'

export interface KpiThreshold {
  direction: Direction
  green: number
  orange: number
  red: number
  label: string
  unit: '€' | '%' | 'x' | ''
}

export const DEFAULT_THRESHOLDS: Record<string, KpiThreshold> = {
  cpm: { direction: 'lower_is_better', label: 'CPM (€ / 1 000 imp.)', green: 5, orange: 10, red: 20, unit: '€' },
  cpc: { direction: 'lower_is_better', label: 'CPC (€ par clic)', green: 0.5, orange: 1, red: 2, unit: '€' },
  ctr: { direction: 'higher_is_better', label: 'CTR (% clics / impressions)', green: 2, orange: 1, red: 0.5, unit: '%' },
  cpl: { direction: 'lower_is_better', label: 'CPL Meta (coût par lead brut)', green: 7.5, orange: 15, red: 30, unit: '€' },
  cpl_qualified: { direction: 'lower_is_better', label: 'CPL qualifié', green: 30, orange: 60, red: 100, unit: '€' },
  cr1: { direction: 'higher_is_better', label: 'CR1 (% clics → leads)', green: 8, orange: 4, red: 2, unit: '%' },
  cr2: { direction: 'higher_is_better', label: 'CR2 (% leads → joints)', green: 60, orange: 40, red: 20, unit: '%' },
  cr3: { direction: 'higher_is_better', label: 'CR3 (% joints → RDV)', green: 50, orange: 30, red: 15, unit: '%' },
  joignabilite: { direction: 'higher_is_better', label: '% Joignabilité', green: 60, orange: 40, red: 20, unit: '%' },
  no_show_rate: { direction: 'lower_is_better', label: '% No show', green: 15, orange: 30, red: 50, unit: '%' },
  cpsb: { direction: 'lower_is_better', label: 'CPSb (coût par RDV booké)', green: 80, orange: 150, red: 300, unit: '€' },
  cpsp: { direction: 'lower_is_better', label: 'CPSp (coût par RDV présenté)', green: 120, orange: 200, red: 400, unit: '€' },
  closing_rate: { direction: 'higher_is_better', label: '% Closing (RDV → vente)', green: 25, orange: 15, red: 5, unit: '%' },
  cpclose: { direction: 'lower_is_better', label: 'CPClose (coût par vente)', green: 300, orange: 600, red: 1200, unit: '€' },
  roas: { direction: 'higher_is_better', label: 'ROAS (CA / Dépense)', green: 3, orange: 1, red: 0.5, unit: 'x' },
}

export function evaluateHealthColor(kpiKey: string, value: number | null, overrides?: ThresholdOverrides | null): HealthColor | null {
  if (value === null || Number.isNaN(value)) return null
  const base = DEFAULT_THRESHOLDS[kpiKey]
  if (!base) return null

  const t: KpiThreshold = { ...base, ...(overrides?.[kpiKey] ?? {}) }
  const orderOK =
    t.direction === 'higher_is_better' ? t.green >= t.orange && t.orange >= t.red : t.green <= t.orange && t.orange <= t.red
  if (!orderOK) Object.assign(t, base)

  if (t.direction === 'higher_is_better') {
    if (value >= t.green) return 'green'
    if (value >= t.orange) return 'orange'
    if (value >= t.red) return 'orange'
    return 'red'
  }
  if (value <= t.green) return 'green'
  if (value <= t.orange) return 'orange'
  if (value <= t.red) return 'orange'
  return 'red'
}

export function classifyCampaignObjective(objective: string | undefined): CampaignType {
  switch (objective) {
    case 'OUTCOME_LEADS':
    case 'LEAD_GENERATION':
      return 'leadform'
    case 'OUTCOME_AWARENESS':
    case 'BRAND_AWARENESS':
    case 'REACH':
      return 'follow_ads'
    default:
      return 'other'
  }
}

export const HEALTH_LABEL: Record<HealthColor, string> = {
  green: 'Bon',
  orange: 'À surveiller',
  red: 'Critique',
}

/** Effective (override-merged) cutoffs for the config modal. */
export function effectiveThreshold(key: string, overrides: ThresholdOverrides): { green: number; orange: number; red: number } {
  const base = DEFAULT_THRESHOLDS[key]
  const o = overrides[key]
  return { green: o?.green ?? base.green, orange: o?.orange ?? base.orange, red: o?.red ?? base.red }
}

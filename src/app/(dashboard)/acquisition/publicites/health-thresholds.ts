// src/app/(dashboard)/acquisition/publicites/health-thresholds.ts
//
// Coloration verte / orange / rouge des KPIs de la page Publicités.
// Les seuils par défaut sont définis ici. Chaque workspace peut les
// surcharger via l'écran de config (table ads_health_thresholds).
// Le frontend appelle GET /api/ads-thresholds, merge avec les défauts,
// puis passe le résultat à getHealthColor().

export type HealthColor = 'green' | 'orange' | 'red'
export type CampaignType = 'leadform' | 'follow_ads' | 'other'
export type Direction = 'higher_is_better' | 'lower_is_better'

export interface KpiThreshold {
  /** Sens du KPI : "plus c'est haut mieux c'est" (CR1, ROAS, CTR…) ou
   *  l'inverse (CPL, CPM, % no show…). Pas modifiable par le coach. */
  direction: Direction
  /** Seuil vert. Pour higher_is_better : value >= green → vert.
   *  Pour lower_is_better : value <= green → vert. */
  green: number
  /** Seuil orange. Pour higher_is_better : value >= orange (et < green) → orange.
   *  Pour lower_is_better : value <= orange (et > green) → orange. */
  orange: number
  /** Seuil rouge. Pour higher_is_better : value < red → rouge.
   *  Pour lower_is_better : value > red → rouge. */
  red: number
  /** Libellé court affiché dans la modale de config. */
  label: string
  /** Unité affichée. */
  unit: '€' | '%' | 'x' | ''
}

/* ── Défauts ─────────────────────────────────────────────────────── */

export const DEFAULT_THRESHOLDS: Record<string, KpiThreshold> = {
  // Top of funnel Meta
  cpm: { direction: 'lower_is_better', label: 'CPM (€ / 1 000 imp.)', green: 5, orange: 10, red: 20, unit: '€' },
  cpc: { direction: 'lower_is_better', label: 'CPC (€ par clic)', green: 0.5, orange: 1, red: 2, unit: '€' },
  ctr: { direction: 'higher_is_better', label: 'CTR (% clics / impressions)', green: 2, orange: 1, red: 0.5, unit: '%' },
  // Lead acquisition
  cpl: { direction: 'lower_is_better', label: 'CPL Meta (coût par lead brut)', green: 7.5, orange: 15, red: 30, unit: '€' },
  cpl_qualified: { direction: 'lower_is_better', label: 'CPL qualifié', green: 30, orange: 60, red: 100, unit: '€' },
  // Funnel conversions (clic → lead → joint → RDV)
  cr1: { direction: 'higher_is_better', label: 'CR1 (% clics → leads)', green: 8, orange: 4, red: 2, unit: '%' },
  cr2: { direction: 'higher_is_better', label: 'CR2 (% leads → joints)', green: 60, orange: 40, red: 20, unit: '%' },
  cr3: { direction: 'higher_is_better', label: 'CR3 (% joints → RDV)', green: 50, orange: 30, red: 15, unit: '%' },
  joignabilite: { direction: 'higher_is_better', label: '% Joignabilité', green: 60, orange: 40, red: 20, unit: '%' },
  no_show_rate: { direction: 'lower_is_better', label: '% No show', green: 15, orange: 30, red: 50, unit: '%' },
  cpsb: { direction: 'lower_is_better', label: 'CPSb (coût par RDV booké)', green: 80, orange: 150, red: 300, unit: '€' },
  cpsp: { direction: 'lower_is_better', label: 'CPSp (coût par RDV présenté)', green: 120, orange: 200, red: 400, unit: '€' },
  // Closing
  closing_rate: { direction: 'higher_is_better', label: '% Closing (RDV → vente)', green: 25, orange: 15, red: 5, unit: '%' },
  cpclose: { direction: 'lower_is_better', label: 'CPClose (coût par vente)', green: 300, orange: 600, red: 1200, unit: '€' },
  // Financier
  roas: { direction: 'higher_is_better', label: 'ROAS (CA / Dépense)', green: 3, orange: 1, red: 0.5, unit: 'x' },
}

/* ── Logique de coloration ───────────────────────────────────────── */

/**
 * Détermine la couleur santé d'un KPI selon sa valeur. Surchargeable
 * par les overrides utilisateur (table ads_health_thresholds). Le sens
 * (higher_is_better / lower_is_better) reste figé côté code.
 */
export function evaluateHealthColor(
  kpiKey: string,
  value: number | null,
  overrides?: Record<string, Partial<Pick<KpiThreshold, 'green' | 'orange' | 'red'>>> | null,
): HealthColor | null {
  if (value === null || Number.isNaN(value)) return null
  const base = DEFAULT_THRESHOLDS[kpiKey]
  if (!base) return null

  const t: KpiThreshold = {
    ...base,
    ...(overrides?.[kpiKey] ?? {}),
  }
  // Sanity: if the user inverted the cutoffs (e.g. red > green for an
  // "higher is better" KPI), fall back to defaults so we never display
  // garbage. Expected ordering:
  //   higher_is_better:  green >= orange >= red
  //   lower_is_better:   green <= orange <= red
  const orderOK = t.direction === 'higher_is_better'
    ? (t.green >= t.orange && t.orange >= t.red)
    : (t.green <= t.orange && t.orange <= t.red)
  if (!orderOK) Object.assign(t, base)

  if (t.direction === 'higher_is_better') {
    if (value >= t.green) return 'green'
    if (value >= t.orange) return 'orange'
    if (value >= t.red) return 'orange' // between red and orange = warning
    return 'red'
  }
  if (value <= t.green) return 'green'
  if (value <= t.orange) return 'orange'
  if (value <= t.red) return 'orange'
  return 'red'
}

/* ── Compat couche existante ─────────────────────────────────────── */
// Ancienne signature `(campaignType, kpi, value)` utilisée par
// `ads-overview-tab.tsx` et `api/meta/insights/route.ts`. On l'ignore
// désormais : on délègue à evaluateHealthColor() qui n'a pas besoin du
// type de campagne (les seuils sont par-KPI, pas par-type-de-pub).

export function getHealthColor(
  _campaignType: CampaignType | string,
  kpi: string,
  value: number | null,
  overrides?: Record<string, Partial<Pick<KpiThreshold, 'green' | 'orange' | 'red'>>> | null,
): HealthColor | null {
  return evaluateHealthColor(kpi, value, overrides)
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

export const HEALTH_COLORS: Record<HealthColor, string> = {
  green: '#00C853',
  orange: '#D69E2E',
  red: '#E53E3E',
}

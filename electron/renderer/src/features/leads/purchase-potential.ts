// "Potentiel d'achat" — a deterministic, documented classification from
// REAL signals already on the lead (engagement score, pipeline status,
// recency of contact) — never an ML prediction, never a fabricated number.
// Mirrors the same honesty rule as funnel-stage.ts: a simple, adjustable
// rule the coach can understand at a glance, not a black box.
import type { EngagementScore } from './types'
import type { Lead } from './types'

export type PurchasePotential = 'faible' | 'moyen' | 'eleve'

export const PURCHASE_POTENTIAL_LABEL: Record<PurchasePotential, string> = {
  faible: 'Faible',
  moyen: 'Moyen',
  eleve: 'Élevé',
}

export const PURCHASE_POTENTIAL_COLOR: Record<PurchasePotential, string> = {
  faible: '#8a8e96',
  moyen: '#d9820b',
  eleve: '#1a7f4e',
}

/**
 * Signals used (all real, all already displayed elsewhere on the fiche —
 * this only combines them into one label):
 * - already in a late pipeline stage (closing_planifie/clos) → eleve
 * - high engagement score (>= 10, same threshold as ScoreGauge's "high")
 *   AND currently active in the pipeline (not dead/pas_qualifie) → eleve
 * - medium engagement score (>= 3) → moyen
 * - dead/pas_qualifie → faible regardless of score (already disqualified)
 * - everything else → faible
 */
export function purchasePotential(lead: Pick<Lead, 'status'>, score: EngagementScore | null): PurchasePotential {
  if (lead.status === 'dead' || lead.status === 'pas_qualifie') return 'faible'
  if (lead.status === 'clos' || lead.status === 'closing_planifie') return 'eleve'

  const s = score?.score ?? 0
  if (s >= 10) return 'eleve'
  if (s >= 3) return 'moyen'
  return 'faible'
}

// "Niveau de confiance" of a lead's engagement score — how much the score
// can be trusted to mean purchase intent. Derived only from the real
// engagement score (src/lib/leads/engagement-score.ts via /api/leads/:id/score)
// and the volume/recency of observed interactions behind it: a high score
// built on a single like is not "très élevé".
import type { EngagementScore } from './types'

export type ConfidenceLevel = 'insuffisant' | 'faible' | 'moyen' | 'eleve' | 'tres_eleve'

export const CONFIDENCE_LABEL: Record<ConfidenceLevel, string> = {
  insuffisant: 'Données insuffisantes',
  faible: 'Faible',
  moyen: 'Moyen',
  eleve: 'Élevé',
  tres_eleve: 'Très élevé',
}

const ORDER: ConfidenceLevel[] = ['faible', 'moyen', 'eleve', 'tres_eleve']

export function confidenceLevel(score: EngagementScore, now: Date = new Date()): ConfidenceLevel {
  if (score.totalInteractions === 0) return 'insuffisant'
  let level: ConfidenceLevel = score.score >= 80 ? 'tres_eleve' : score.score >= 60 ? 'eleve' : score.score >= 40 ? 'moyen' : 'faible'
  // Few data points or a single content touched cap the confidence.
  if (score.totalInteractions < 3 || score.distinctContentCount < 2) level = ORDER[Math.min(ORDER.indexOf(level), 1)]
  // Nothing in the last 60 days: intent may be stale.
  if (score.lastInteractionAt && now.getTime() - new Date(score.lastInteractionAt).getTime() > 60 * 86_400_000) {
    level = ORDER[Math.max(ORDER.indexOf(level) - 1, 0)]
  }
  return level
}

/** Observed interactions per week since the first one (null if < 1 day of history). */
export function weeklyFrequency(score: EngagementScore, now: Date = new Date()): number | null {
  if (!score.firstInteractionAt || score.totalInteractions === 0) return null
  const days = (now.getTime() - new Date(score.firstInteractionAt).getTime()) / 86_400_000
  if (days < 1) return null
  return (score.totalInteractions / days) * 7
}

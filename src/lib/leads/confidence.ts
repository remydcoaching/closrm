// "Niveau de confiance" of a lead's 0-100 engagement score — server copy of
// electron/renderer/src/features/leads/confidence.ts (same rules; the two
// apps don't share a package). A high score built on a single like is not
// "très élevé": few data points cap it, 60 days of silence lowers it.
export type ConfidenceLevel = 'insuffisant' | 'faible' | 'moyen' | 'eleve' | 'tres_eleve'

const ORDER: ConfidenceLevel[] = ['faible', 'moyen', 'eleve', 'tres_eleve']

export function confidenceLevel(
  s: { score: number; totalInteractions: number; distinctContentCount: number; lastInteractionAt: string | null },
  now: Date = new Date(),
): ConfidenceLevel {
  if (s.totalInteractions === 0) return 'insuffisant'
  let level: ConfidenceLevel = s.score >= 80 ? 'tres_eleve' : s.score >= 60 ? 'eleve' : s.score >= 40 ? 'moyen' : 'faible'
  if (s.totalInteractions < 3 || s.distinctContentCount < 2) level = ORDER[Math.min(ORDER.indexOf(level), 1)]
  if (s.lastInteractionAt && now.getTime() - new Date(s.lastInteractionAt).getTime() > 60 * 86_400_000) {
    level = ORDER[Math.max(ORDER.indexOf(level) - 1, 0)]
  }
  return level
}

// Renders a real engagement score (from GET /api/leads/:id/score — never a
// fabricated number) as a compact gauge + confidence label. The score itself
// is unbounded (sum of weighted interactions), so this maps it onto a
// 3-tier confidence label using thresholds documented here rather than
// hidden inside a component prop — "confidence" is a UI framing of a real
// number, not a second scoring system.
import './score-gauge.css'

export type ScoreLevel = 'low' | 'medium' | 'high'

// Thresholds are intentionally simple and documented: below the default
// "1 comment" (3 pts) is low, up to a sustained multi-interaction pattern
// (10 pts, e.g. ~3 comments or ~10 likes) is medium, above is high. Tuned
// against DEFAULT_SCORING in src/lib/leads/engagement-score.ts — revisit if
// that changes.
export function scoreLevel(score: number): ScoreLevel {
  if (score >= 10) return 'high'
  if (score >= 3) return 'medium'
  return 'low'
}

const LEVEL_LABEL: Record<ScoreLevel, string> = {
  low: 'Faible',
  medium: 'Moyen',
  high: 'Élevé',
}

export function ScoreGauge({ score }: { score: number }) {
  const level = scoreLevel(score)
  return (
    <div className={`ds-score-gauge ds-score-gauge--${level}`}>
      <span className="ds-score-gauge-value font-mono">{score}</span>
      <span className="ds-score-gauge-label">{LEVEL_LABEL[level]}</span>
    </div>
  )
}

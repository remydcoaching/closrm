// Classifies a piece of content into a funnel stage from its OWN engagement
// rate — not from the confidence level of leads it produced (ClosRM has no
// data linking a specific lead's score back to which content first reached
// them, so faking that link would violate the no-fabricated-data rule).
// This is a deliberate, documented proxy: a low engagement rate content
// tends to reach a broad, colder audience (top of funnel, awareness); a
// high engagement rate content tends to convert an already-warm audience
// (bottom of funnel, high intent). Thresholds are simple and adjustable —
// not a black box.
export type FunnelStage = 'haut' | 'milieu' | 'bas'

export function funnelStage(engagementRate: number): FunnelStage {
  if (engagementRate >= 0.04) return 'bas'
  if (engagementRate >= 0.015) return 'milieu'
  return 'haut'
}

export const FUNNEL_STAGE_LABEL: Record<FunnelStage, string> = {
  haut: 'Haut de tunnel',
  milieu: 'Milieu de tunnel',
  bas: 'Bas de tunnel',
}

export const FUNNEL_STAGE_COLOR: Record<FunnelStage, string> = {
  haut: '#c837ab', // magenta — matches the reference's "haut de tunnel" bubble color
  milieu: '#d9820b',
  bas: '#1a7f4e',
}

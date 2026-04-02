export const IG_SEQ_TYPES = {
  confiance:      { label: 'Confiance',      color: '#3b82f6' },
  peur:           { label: 'Peur',           color: '#ef4444' },
  preuve_sociale: { label: 'Preuve sociale', color: '#22c55e' },
  urgence:        { label: 'Urgence',        color: '#f97316' },
  autorite:       { label: 'Autorité',       color: '#8b5cf6' },
  storytelling:   { label: 'Storytelling',   color: '#ec4899' },
  offre:          { label: 'Offre',          color: '#eab308' },
  education:      { label: 'Éducation',      color: '#06b6d4' },
} as const

export type SeqTypeKey = keyof typeof IG_SEQ_TYPES

export const IG_CAPTION_CATEGORIES = [
  { value: 'general', label: 'Général' },
  { value: 'education', label: 'Éducation' },
  { value: 'storytelling', label: 'Storytelling' },
  { value: 'offre', label: 'Offre' },
  { value: 'preuve_sociale', label: 'Preuve sociale' },
  { value: 'motivation', label: 'Motivation' },
  { value: 'behind_the_scenes', label: 'Behind the scenes' },
] as const

export const IG_PERIODS = [
  { value: '7d', label: '7 jours' },
  { value: '30d', label: '30 jours' },
  { value: '90d', label: '90 jours' },
  { value: '6m', label: '6 mois' },
  { value: '1y', label: '1 an' },
] as const

export const IG_REEL_FORMATS = [
  { value: 'talking_head', label: 'Talking Head' },
  { value: 'text_overlay', label: 'Text Overlay' },
  { value: 'raw_documentary', label: 'Raw Documentary' },
] as const

export const IG_GOAL_METRICS = [
  { value: 'followers', label: 'Followers' },
  { value: 'monthly_views', label: 'Vues mensuelles' },
  { value: 'engagement_rate', label: "Taux d'engagement" },
  { value: 'weekly_output', label: 'Posts / semaine' },
  { value: 'dms_month', label: 'DMs / mois' },
  { value: 'viral_reels', label: 'Reels viraux' },
] as const

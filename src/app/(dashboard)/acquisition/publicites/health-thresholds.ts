// src/app/(dashboard)/acquisition/publicites/health-thresholds.ts

export type HealthColor = 'green' | 'orange' | 'red'
export type CampaignType = 'leadform' | 'follow_ads' | 'other'

interface ThresholdRule {
  green: (value: number) => boolean
  orange: (value: number) => boolean
}

const LEADFORM_THRESHOLDS: Record<string, ThresholdRule> = {
  cpl: {
    green: (v) => v < 7.5,
    orange: (v) => v >= 7.5 && v <= 15,
  },
  ctr: {
    green: (v) => v > 2,
    orange: (v) => v >= 1 && v <= 2,
  },
  roas: {
    green: (v) => v > 3,
    orange: (v) => v >= 1 && v <= 3,
  },
}

const FOLLOW_ADS_THRESHOLDS: Record<string, ThresholdRule> = {
  cpm: {
    green: (v) => v < 5,
    orange: (v) => v >= 5 && v <= 10,
  },
  cost_per_click: {
    green: (v) => v < 0.5,
    orange: (v) => v >= 0.5 && v <= 1,
  },
}

export function getHealthColor(
  campaignType: CampaignType,
  kpi: string,
  value: number | null
): HealthColor | null {
  if (value === null) return null

  const thresholds = campaignType === 'leadform'
    ? LEADFORM_THRESHOLDS
    : campaignType === 'follow_ads'
    ? FOLLOW_ADS_THRESHOLDS
    : null

  if (!thresholds) return null

  const rule = thresholds[kpi]
  if (!rule) return null

  if (rule.green(value)) return 'green'
  if (rule.orange(value)) return 'orange'
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

export const HEALTH_COLORS: Record<HealthColor, string> = {
  green: '#00C853',
  orange: '#D69E2E',
  red: '#E53E3E',
}

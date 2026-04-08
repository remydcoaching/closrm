export interface PerformanceInsight {
  id: string
  icon: string
  title: string
  status: 'action_required' | 'needs_optimization' | 'on_track'
  statusLabel: string
  currentValue: string
  targetValue: string
  description: string
  expectedImpact: string
  actionSteps: string[]
}

export interface FunnelData {
  profile_visits: number
  followers: number
  followers_total: number
  qualified_followers: number
  conversations: number
  appointments: number
  show_ups: number
  cash_collected: number | null
}

export const DEFAULT_TARGETS = {
  cost_per_follower: 4.00,
  cost_per_appointment: 120.00,
  conversation_to_appointment: 15,
  visit_to_follower: 20,
  show_up_rate: 80,
  qualification_rate: 50,
}

function safePercent(numerator: number, denominator: number): number {
  if (denominator === 0) return 0
  return (numerator / denominator) * 100
}

function safeDivide(numerator: number, denominator: number): number {
  if (denominator === 0) return 0
  return numerator / denominator
}

function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`
}

function formatCurrency(value: number): string {
  return `${value.toFixed(2)}€`
}

function statusFromThresholds(
  value: number,
  redBelow: number,
  orangeBelow: number
): 'action_required' | 'needs_optimization' | 'on_track' {
  if (value < redBelow) return 'action_required'
  if (value < orangeBelow) return 'needs_optimization'
  return 'on_track'
}

function statusFromThresholdsInverted(
  value: number,
  greenBelow: number,
  orangeBelow: number
): 'action_required' | 'needs_optimization' | 'on_track' {
  if (value <= greenBelow) return 'on_track'
  if (value <= orangeBelow) return 'needs_optimization'
  return 'action_required'
}

const STATUS_LABELS: Record<PerformanceInsight['status'], string> = {
  action_required: 'Action Required',
  needs_optimization: 'Needs Optimization',
  on_track: 'On Track',
}

// ─── Insight 1: Conversation-to-Appointment Gap ────────────────────────────

function conversationToAppointmentInsight(
  funnel: FunnelData,
): PerformanceInsight {
  const rate = safePercent(funnel.appointments, funnel.conversations)
  const target = DEFAULT_TARGETS.conversation_to_appointment
  const status = statusFromThresholds(rate, 10, target)

  const additionalAppointments =
    funnel.conversations > 0
      ? Math.max(0, Math.round((target / 100) * funnel.conversations) - funnel.appointments)
      : 0

  return {
    id: 'conversation-to-appointment',
    icon: 'MessageSquare',
    title: 'Conversation-to-Appointment Gap',
    status,
    statusLabel: STATUS_LABELS[status],
    currentValue: formatPercent(rate),
    targetValue: `${target}%+`,
    description:
      funnel.conversations === 0
        ? 'No conversations recorded yet. Start engaging with followers to generate appointments.'
        : `${formatPercent(rate)} of conversations convert to appointments (target: ${target}%+).`,
    expectedImpact:
      additionalAppointments > 0
        ? `+${additionalAppointments} additional appointment${additionalAppointments > 1 ? 's' : ''} per period if target is reached`
        : 'Conversion rate is at or above target',
    actionSteps: [
      'Set up auto-responder within 60 minutes',
      'Create 3 DM templates with clear CTAs',
      'Add urgency messaging and limited availability',
      'Follow up within 24hrs if no booking',
    ],
  }
}

// ─── Insight 2: Optimize Ad Spend Efficiency ────────────────────────────────

function adSpendEfficiencyInsight(
  funnel: FunnelData,
  adSpend: number,
  breakdownByType?: { type: string; count: number; spend: number }[],
): PerformanceInsight {
  if (!breakdownByType || breakdownByType.length < 2) {
    const cpf = safeDivide(adSpend, funnel.followers)
    return {
      id: 'ad-spend-efficiency',
      icon: 'TrendingUp',
      title: 'Optimize Ad Spend Efficiency',
      status: 'on_track',
      statusLabel: STATUS_LABELS.on_track,
      currentValue: funnel.followers > 0 ? formatCurrency(cpf) : 'N/A',
      targetValue: 'Compare sources',
      description:
        'Not enough data to compare sources. Connect multiple ad sources to unlock this insight.',
      expectedImpact: 'Add more ad sources to calculate potential savings',
      actionSteps: [
        'Ensure multiple ad sources are tracked',
        'Compare cost-per-follower across sources',
        'Reallocate budget toward the most efficient source',
        'Pause underperforming sources',
      ],
    }
  }

  const sourcesWithCPF = breakdownByType
    .filter((s) => s.count > 0)
    .map((s) => ({ ...s, cpf: s.spend / s.count }))

  if (sourcesWithCPF.length < 2) {
    return {
      id: 'ad-spend-efficiency',
      icon: 'TrendingUp',
      title: 'Optimize Ad Spend Efficiency',
      status: 'on_track',
      statusLabel: STATUS_LABELS.on_track,
      currentValue: 'N/A',
      targetValue: 'Compare sources',
      description:
        'Only one source has data. Need at least two sources with followers to compare efficiency.',
      expectedImpact: 'Add more sources to unlock optimization',
      actionSteps: [
        'Ensure multiple ad sources are tracked',
        'Compare cost-per-follower across sources',
        'Reallocate budget toward the most efficient source',
        'Pause underperforming sources',
      ],
    }
  }

  const sorted = [...sourcesWithCPF].sort((a, b) => a.cpf - b.cpf)
  const cheapest = sorted[0]
  const mostExpensive = sorted[sorted.length - 1]
  const ratio = safeDivide(mostExpensive.cpf, cheapest.cpf)

  let status: PerformanceInsight['status']
  if (ratio > 3) status = 'action_required'
  else if (ratio > 2) status = 'needs_optimization'
  else status = 'on_track'

  const monthlySavings =
    mostExpensive.spend > 0
      ? Math.round(mostExpensive.spend * 0.6 * (1 - cheapest.cpf / mostExpensive.cpf))
      : 0

  return {
    id: 'ad-spend-efficiency',
    icon: 'TrendingUp',
    title: 'Optimize Ad Spend Efficiency',
    status,
    statusLabel: STATUS_LABELS[status],
    currentValue: `${ratio.toFixed(1)}x gap`,
    targetValue: '<2x gap',
    description: `${mostExpensive.type} costs ${formatCurrency(mostExpensive.cpf)}/follower vs ${formatCurrency(cheapest.cpf)} for ${cheapest.type} (${ratio.toFixed(1)}x difference).`,
    expectedImpact:
      monthlySavings > 0
        ? `~${formatCurrency(monthlySavings)} savings/period by reallocating budget`
        : 'Sources are within acceptable efficiency range',
    actionSteps: [
      `Reduce budget on ${mostExpensive.type} by 60%`,
      `Reallocate to ${cheapest.type}`,
      'Create 10 new ad variations',
      `Pause ads with CPF > ${formatCurrency(mostExpensive.cpf)}`,
    ],
  }
}

// ─── Insight 3: Profile Conversion ──────────────────────────────────────────

function profileConversionInsight(funnel: FunnelData): PerformanceInsight {
  const rate = safePercent(funnel.followers, funnel.profile_visits)
  const target = DEFAULT_TARGETS.visit_to_follower
  const status = statusFromThresholds(rate, 10, target)

  return {
    id: 'profile-conversion',
    icon: 'UserPlus',
    title: 'Profile Conversion',
    status,
    statusLabel: STATUS_LABELS[status],
    currentValue: formatPercent(rate),
    targetValue: `${target}%+`,
    description:
      funnel.profile_visits === 0
        ? 'No profile visits recorded yet. Run ads to drive traffic to your profile.'
        : `${formatPercent(rate)} of profile visitors become followers (target: ${target}%+).`,
    expectedImpact:
      funnel.profile_visits > 0
        ? `+${Math.max(0, Math.round((target / 100) * funnel.profile_visits) - funnel.followers)} additional followers if target is reached`
        : 'Drive profile visits to measure conversion',
    actionSteps: [
      'Rewrite bio with clear value proposition',
      'Add direct CTA in bio',
      'Create 5 Instagram Highlights',
      'Pin 3 best-performing posts',
    ],
  }
}

// ─── Insight 4: Cost Per Follower ───────────────────────────────────────────

function costPerFollowerInsight(
  funnel: FunnelData,
  adSpend: number,
): PerformanceInsight {
  const cpf = safeDivide(adSpend, funnel.followers)
  const target = DEFAULT_TARGETS.cost_per_follower
  const status =
    funnel.followers === 0
      ? 'action_required'
      : statusFromThresholdsInverted(cpf, target, 8)

  return {
    id: 'cost-per-follower',
    icon: 'DollarSign',
    title: 'Cost Per Follower',
    status,
    statusLabel: STATUS_LABELS[status],
    currentValue: funnel.followers > 0 ? formatCurrency(cpf) : 'N/A',
    targetValue: `<${formatCurrency(target)}`,
    description:
      funnel.followers === 0
        ? 'No followers gained in this period. Check your ads are running and targeting is correct.'
        : `Each new follower costs ${formatCurrency(cpf)} (target: <${formatCurrency(target)}).`,
    expectedImpact:
      funnel.followers > 0 && cpf > target
        ? `${formatCurrency((cpf - target) * funnel.followers)} potential savings if target CPF is reached`
        : 'CPF is within target range',
    actionSteps: [
      'Run weekly creative A/B tests',
      `Pause ads with CPF > ${formatCurrency(5)}`,
      `Double budget on ads < ${formatCurrency(3.5)} CPF`,
      'Refresh creative every 7-10 days',
    ],
  }
}

// ─── Insight 5: Show-Up Rate ────────────────────────────────────────────────

function showUpRateInsight(funnel: FunnelData): PerformanceInsight {
  const rate = safePercent(funnel.show_ups, funnel.appointments)
  const target = DEFAULT_TARGETS.show_up_rate
  const status = statusFromThresholds(rate, 60, target)

  return {
    id: 'show-up-rate',
    icon: 'CalendarCheck',
    title: 'Show-Up Rate',
    status,
    statusLabel: STATUS_LABELS[status],
    currentValue: formatPercent(rate),
    targetValue: `${target}%+`,
    description:
      funnel.appointments === 0
        ? 'No appointments scheduled in this period.'
        : `${formatPercent(rate)} of booked appointments resulted in show-ups (target: ${target}%+).`,
    expectedImpact:
      funnel.appointments > 0
        ? `+${Math.max(0, Math.round((target / 100) * funnel.appointments) - funnel.show_ups)} additional show-ups if target is reached`
        : 'Schedule appointments to measure show-up rate',
    actionSteps: [
      'Document confirmation process',
      'Keep 24-hour and 2-hour reminders',
      'Add confirmation questions',
      'Train team on this process',
    ],
  }
}

// ─── Insight 6: Qualification Success ───────────────────────────────────────

function qualificationSuccessInsight(funnel: FunnelData): PerformanceInsight {
  const rate = safePercent(funnel.qualified_followers, funnel.followers_total)
  const target = DEFAULT_TARGETS.qualification_rate
  const status = statusFromThresholds(rate, 30, target)

  return {
    id: 'qualification-success',
    icon: 'Target',
    title: 'Qualification Success',
    status,
    statusLabel: STATUS_LABELS[status],
    currentValue: formatPercent(rate),
    targetValue: `${target}%+`,
    description:
      funnel.followers_total === 0
        ? 'No followers recorded. Build your audience to measure qualification rate.'
        : `${formatPercent(rate)} of total followers are qualified leads (target: ${target}%+).`,
    expectedImpact:
      funnel.followers_total > 0
        ? `+${Math.max(0, Math.round((target / 100) * funnel.followers_total) - funnel.qualified_followers)} additional qualified leads if targeting improves`
        : 'Grow your follower base to unlock this insight',
    actionSteps: [
      'Screenshot ad targeting settings',
      'Document best-performing Story Ads',
      'Create targeting template',
      'Test 1 lookalike audience',
    ],
  }
}

// ─── Main export ────────────────────────────────────────────────────────────

export function generateInsights(
  funnel: FunnelData,
  previousFunnel: FunnelData,
  adSpend: number,
  breakdownByType?: { type: string; count: number; spend: number }[]
): PerformanceInsight[] {
  // previousFunnel is available for future trend indicators
  void previousFunnel

  return [
    conversationToAppointmentInsight(funnel),
    adSpendEfficiencyInsight(funnel, adSpend, breakdownByType),
    profileConversionInsight(funnel),
    costPerFollowerInsight(funnel, adSpend),
    showUpRateInsight(funnel),
    qualificationSuccessInsight(funnel),
  ]
}

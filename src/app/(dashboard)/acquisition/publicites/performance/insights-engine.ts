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
  action_required: 'Action requise',
  needs_optimization: 'A optimiser',
  on_track: 'En bonne voie',
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
    title: 'Taux conversation → RDV',
    status,
    statusLabel: STATUS_LABELS[status],
    currentValue: formatPercent(rate),
    targetValue: `${target}%+`,
    description:
      funnel.conversations === 0
        ? 'Aucune conversation enregistree. Commencez a engager vos followers pour generer des RDV.'
        : `${formatPercent(rate)} des conversations aboutissent a un RDV (objectif : ${target}%+).`,
    expectedImpact:
      additionalAppointments > 0
        ? `+${additionalAppointments} RDV supplementaire${additionalAppointments > 1 ? 's' : ''} si l'objectif est atteint`
        : 'Le taux de conversion est dans l\'objectif',
    actionSteps: [
      'Configurer une reponse auto en moins de 60 minutes',
      'Creer 3 templates de DM avec des CTA clairs',
      'Ajouter un message d\'urgence et de disponibilite limitee',
      'Relancer sous 24h si pas de reservation',
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
      title: 'Optimiser les depenses pub',
      status: 'on_track',
      statusLabel: STATUS_LABELS.on_track,
      currentValue: funnel.followers > 0 ? formatCurrency(cpf) : 'N/A',
      targetValue: 'Comparer les sources',
      description:
        'Pas assez de donnees pour comparer les sources. Connectez plusieurs sources pub pour debloquer cet insight.',
      expectedImpact: 'Ajoutez plus de sources pour calculer les economies potentielles',
      actionSteps: [
        'Verifier que plusieurs sources sont trackees',
        'Comparer le cout/follower entre les sources',
        'Reallouer le budget vers la source la plus efficace',
        'Mettre en pause les sources sous-performantes',
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
      title: 'Optimiser les depenses pub',
      status: 'on_track',
      statusLabel: STATUS_LABELS.on_track,
      currentValue: 'N/A',
      targetValue: 'Comparer les sources',
      description:
        'Une seule source a des donnees. Il faut au moins deux sources avec des followers pour comparer.',
      expectedImpact: 'Ajoutez plus de sources pour debloquer l\'optimisation',
      actionSteps: [
        'Verifier que plusieurs sources sont trackees',
        'Comparer le cout/follower entre les sources',
        'Reallouer le budget vers la source la plus efficace',
        'Mettre en pause les sources sous-performantes',
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
    title: 'Optimiser les depenses pub',
    status,
    statusLabel: STATUS_LABELS[status],
    currentValue: `ecart ${ratio.toFixed(1)}x`,
    targetValue: '<2x',
    description: `${mostExpensive.type} coute ${formatCurrency(mostExpensive.cpf)}/follower vs ${formatCurrency(cheapest.cpf)} pour ${cheapest.type} (ecart de ${ratio.toFixed(1)}x).`,
    expectedImpact:
      monthlySavings > 0
        ? `~${formatCurrency(monthlySavings)} d'economies/periode en reallouant le budget`
        : 'Les sources sont dans une fourchette acceptable',
    actionSteps: [
      `Reduire le budget ${mostExpensive.type} de 60%`,
      `Reallouer vers ${cheapest.type}`,
      'Creer 10 nouvelles variations de pub',
      `Mettre en pause les pubs avec CPF > ${formatCurrency(mostExpensive.cpf)}`,
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
    title: 'Conversion du profil',
    status,
    statusLabel: STATUS_LABELS[status],
    currentValue: formatPercent(rate),
    targetValue: `${target}%+`,
    description:
      funnel.profile_visits === 0
        ? 'Aucune visite de profil enregistree. Lancez des pubs pour generer du trafic.'
        : `${formatPercent(rate)} des visiteurs du profil deviennent followers (objectif : ${target}%+).`,
    expectedImpact:
      funnel.profile_visits > 0
        ? `+${Math.max(0, Math.round((target / 100) * funnel.profile_visits) - funnel.followers)} followers supplementaires si l'objectif est atteint`
        : 'Generez des visites pour mesurer la conversion',
    actionSteps: [
      'Reecrire la bio avec une proposition de valeur claire',
      'Ajouter un CTA direct dans la bio',
      'Creer 5 Highlights Instagram',
      'Epingler les 3 meilleurs posts',
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
    title: 'Cout par follower',
    status,
    statusLabel: STATUS_LABELS[status],
    currentValue: funnel.followers > 0 ? formatCurrency(cpf) : 'N/A',
    targetValue: `<${formatCurrency(target)}`,
    description:
      funnel.followers === 0
        ? 'Aucun follower gagne sur cette periode. Verifiez que vos pubs tournent et que le ciblage est correct.'
        : `Chaque nouveau follower coute ${formatCurrency(cpf)} (objectif : <${formatCurrency(target)}).`,
    expectedImpact:
      funnel.followers > 0 && cpf > target
        ? `${formatCurrency((cpf - target) * funnel.followers)} d'economies potentielles si l'objectif CPF est atteint`
        : 'Le CPF est dans l\'objectif',
    actionSteps: [
      'Lancer des A/B tests creatifs chaque semaine',
      `Mettre en pause les pubs avec CPF > ${formatCurrency(5)}`,
      `Doubler le budget sur les pubs < ${formatCurrency(3.5)} CPF`,
      'Rafraichir les creatifs tous les 7-10 jours',
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
    title: 'Taux de presence',
    status,
    statusLabel: STATUS_LABELS[status],
    currentValue: formatPercent(rate),
    targetValue: `${target}%+`,
    description:
      funnel.appointments === 0
        ? 'Aucun RDV planifie sur cette periode.'
        : `${formatPercent(rate)} des RDV reserves ont abouti a une presence (objectif : ${target}%+).`,
    expectedImpact:
      funnel.appointments > 0
        ? `+${Math.max(0, Math.round((target / 100) * funnel.appointments) - funnel.show_ups)} presences supplementaires si l'objectif est atteint`
        : 'Planifiez des RDV pour mesurer le taux de presence',
    actionSteps: [
      'Documenter le processus de confirmation',
      'Garder les rappels 24h et 2h avant',
      'Ajouter des questions de confirmation',
      'Former l\'equipe sur ce processus',
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
    title: 'Taux de qualification',
    status,
    statusLabel: STATUS_LABELS[status],
    currentValue: formatPercent(rate),
    targetValue: `${target}%+`,
    description:
      funnel.followers_total === 0
        ? 'Aucun follower enregistre. Developpez votre audience pour mesurer le taux de qualification.'
        : `${formatPercent(rate)} de vos followers sont des leads qualifies (objectif : ${target}%+).`,
    expectedImpact:
      funnel.followers_total > 0
        ? `+${Math.max(0, Math.round((target / 100) * funnel.followers_total) - funnel.qualified_followers)} leads qualifies supplementaires si le ciblage s'ameliore`
        : 'Developpez votre base followers pour debloquer cet insight',
    actionSteps: [
      'Capturer les parametres de ciblage publicitaire',
      'Documenter les Story Ads les plus performantes',
      'Creer un template de ciblage',
      'Tester 1 audience lookalike',
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

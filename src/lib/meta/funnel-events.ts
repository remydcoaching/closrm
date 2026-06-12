/**
 * Friendly catalog of Meta Pixel events the coach can fire from a funnel
 * block (FormBlock submit, BookingBlock confirmation, etc.).
 *
 * Plain-French labels with a short explanation so the coach picks the
 * business meaning ("c'est un lead qualifié") instead of having to know
 * Meta's vocabulary. The `event` field is the actual Meta standard event
 * name passed to `fbq('track', ...)` and to the Conversions API.
 */

export type MetaEventChoice =
  | 'none'
  | 'lead'
  | 'registration'
  | 'application'
  | 'contact'
  | 'schedule'
  | 'purchase'
  | 'view_content'
  | 'subscribe'
  | 'custom'

export interface MetaEventConfig {
  type: MetaEventChoice
  /** Used only when type === 'custom'. Free-form Meta event name. */
  customName?: string
}

export interface MetaEventOption {
  value: MetaEventChoice
  label: string
  helper: string
  event: string | null  // null = no event sent. 'CUSTOM' = use customName.
}

export const META_EVENT_OPTIONS: MetaEventOption[] = [
  {
    value: 'none',
    label: 'Ne rien envoyer à Meta',
    helper: 'À ce moment, on ne dit rien à Meta.',
    event: null,
  },
  {
    value: 'lead',
    label: "C'est un lead qualifié",
    helper: 'Meta apprend à cibler des profils qui convertissent.',
    event: 'Lead',
  },
  {
    value: 'registration',
    label: "C'est une inscription",
    helper: "L'utilisateur s'est inscrit, sans plus.",
    event: 'CompleteRegistration',
  },
  {
    value: 'application',
    label: "C'est une candidature",
    helper: "L'utilisateur a déposé un dossier ou postulé.",
    event: 'SubmitApplication',
  },
  {
    value: 'contact',
    label: "C'est une prise de contact",
    helper: "Simple contact, pas encore qualifié.",
    event: 'Contact',
  },
  {
    value: 'schedule',
    label: "C'est une réservation de RDV",
    helper: "L'utilisateur a pris un créneau.",
    event: 'Schedule',
  },
  {
    value: 'purchase',
    label: "C'est un achat",
    helper: "L'utilisateur a payé (avec un montant).",
    event: 'Purchase',
  },
  {
    value: 'view_content',
    label: "C'est juste une vue de contenu",
    helper: 'Pour tracker une page importante sans dire "lead".',
    event: 'ViewContent',
  },
  {
    value: 'subscribe',
    label: "C'est un abonnement",
    helper: 'Abonnement recurring.',
    event: 'Subscribe',
  },
  {
    value: 'custom',
    label: 'Event Meta personnalisé',
    helper: 'Tu tapes toi-même le nom de l\'event.',
    event: 'CUSTOM',
  },
]

/** Resolve a MetaEventConfig (typically from a block's config) into the
 *  actual Meta event name to fire, or null if nothing should be sent. */
export function resolveMetaEvent(config: MetaEventConfig | null | undefined, fallback: MetaEventChoice = 'none'): string | null {
  const choice = config?.type ?? fallback
  if (choice === 'custom') {
    return (config?.customName ?? '').trim() || null
  }
  const opt = META_EVENT_OPTIONS.find(o => o.value === choice)
  return opt?.event && opt.event !== 'CUSTOM' ? opt.event : null
}

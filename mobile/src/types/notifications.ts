// Types miroir de /lib/push/send-to-workspace.ts (web).

export type PushType =
  | 'new_lead'
  | 'booking_created'
  | 'closing_assigned'
  | 'call_reminder_h1'
  | 'no_show'
  | 'deal_won'
  | 'dm_reply'
  | 'followup_due'

export interface PushTypeMeta {
  type: PushType
  label: string
  description: string
  icon: string // Ionicons key, géré côté screen
  tint: string
}

// Source de vérité pour la page de réglages mobile.
// Si tu rajoutes un type côté serveur, ajoute-le ici aussi.
export const PUSH_TYPES_META: PushTypeMeta[] = [
  {
    type: 'new_lead',
    label: 'Nouveau prospect',
    description: 'Un nouveau lead arrive (Meta Ads, formulaire, manuel).',
    icon: 'person-add',
    tint: '#3b82f6',
  },
  {
    type: 'booking_created',
    label: 'Booking créé',
    description: "Un lead a réservé un créneau sur ton lien de booking.",
    icon: 'calendar',
    tint: '#a855f7',
  },
  {
    type: 'closing_assigned',
    label: 'Closing assigné',
    description: "Un setter te passe un closing à fermer.",
    icon: 'flame',
    tint: '#f97316',
  },
  {
    type: 'call_reminder_h1',
    label: 'Rappel RDV H-1',
    description: "Un de tes RDV démarre dans 1 heure.",
    icon: 'time',
    tint: '#f59e0b',
  },
  {
    type: 'no_show',
    label: 'No-show',
    description: "Un lead ne s'est pas présenté à un appel.",
    icon: 'alert-circle',
    tint: '#ef4444',
  },
  {
    type: 'deal_won',
    label: 'Deal closé',
    description: "Un membre de l'équipe ferme un deal (toi inclus).",
    icon: 'cash',
    tint: '#22c55e',
  },
  {
    type: 'dm_reply',
    label: 'Réponse Instagram',
    description: 'Un lead a répondu à un DM Instagram.',
    icon: 'chatbubble-ellipses',
    tint: '#ec4899',
  },
  {
    type: 'followup_due',
    label: 'Follow-up à faire',
    description: "Un follow-up est planifié pour aujourd'hui.",
    icon: 'repeat',
    tint: '#06b6d4',
  },
]

import type { WorkflowTriggerType, WorkflowActionType, WorkflowStepType, DelayUnit } from '@/types'

export interface WorkflowTemplate {
  id: string
  name: string
  description: string
  category: 'leads' | 'calls' | 'instagram' | 'booking'
  icon: string
  trigger_type: WorkflowTriggerType
  trigger_config: Record<string, unknown>
  steps: Array<{
    step_type: WorkflowStepType
    action_type?: WorkflowActionType
    action_config?: Record<string, unknown>
    delay_value?: number
    delay_unit?: DelayUnit
  }>
  requires_integration?: string[]
}

export const workflowTemplates: WorkflowTemplate[] = [
  // ─── LEADS ──────────────────────────────────────────────────────────────────

  {
    id: 'new-lead-welcome-email',
    name: 'Nouveau lead → Email de bienvenue',
    description: 'Envoie automatiquement un email de bienvenue a chaque nouveau lead.',
    category: 'leads',
    icon: 'mail',
    trigger_type: 'new_lead',
    trigger_config: {},
    steps: [
      {
        step_type: 'action',
        action_type: 'send_email',
        action_config: {
          template: 'welcome',
          subject: 'Bienvenue {{prenom}} !',
        },
      },
    ],
  },

  {
    id: 'deal-won-email',
    name: 'Deal gagne → Email de felicitations',
    description: 'Envoie un email de felicitations et ajoute le tag "client" quand un deal est gagne.',
    category: 'leads',
    icon: 'trophy',
    trigger_type: 'deal_won',
    trigger_config: {},
    steps: [
      {
        step_type: 'action',
        action_type: 'send_email',
        action_config: {
          template: 'deal_won',
          subject: 'Felicitations {{prenom}}, bienvenue dans le programme !',
        },
      },
      {
        step_type: 'action',
        action_type: 'add_tag',
        action_config: {
          tag: 'client',
        },
      },
    ],
  },

  {
    id: 'facebook-lead-notification',
    name: 'Lead Facebook → Notification coach',
    description: 'Notifie le coach des qu\'un nouveau lead arrive via Facebook Ads.',
    category: 'leads',
    icon: 'bell',
    trigger_type: 'new_lead',
    trigger_config: { source: 'facebook_ads' },
    steps: [
      {
        step_type: 'action',
        action_type: 'send_notification',
        action_config: {
          channel: 'telegram',
          message: 'Nouveau lead Facebook : {{prenom}} {{nom}} ({{email}})',
        },
      },
    ],
    requires_integration: ['meta'],
  },

  {
    id: 'new-lead-fb-conversion',
    name: 'Nouveau lead → Conversion API Facebook',
    description: 'Envoie l\'evenement "Lead" a la Conversions API Facebook pour chaque nouveau lead.',
    category: 'leads',
    icon: 'bar-chart',
    trigger_type: 'new_lead',
    trigger_config: {},
    steps: [
      {
        step_type: 'action',
        action_type: 'facebook_conversions_api',
        action_config: {
          event_name: 'Lead',
        },
      },
    ],
    requires_integration: ['meta'],
  },

  // ─── CALLS ──────────────────────────────────────────────────────────────────

  {
    id: 'call-reserved-notif-telegram',
    name: 'Appel planifie → Notification Telegram',
    description: 'Envoie une notification Telegram au coach quand un appel est planifie.',
    category: 'calls',
    icon: 'phone',
    trigger_type: 'call_scheduled',
    trigger_config: {},
    steps: [
      {
        step_type: 'action',
        action_type: 'send_notification',
        action_config: {
          channel: 'telegram',
          message: 'Appel planifie avec {{prenom}} {{nom}} le {{date_rdv}} a {{heure_rdv}}',
        },
      },
    ],
    requires_integration: ['telegram'],
  },

  {
    id: 'call-reserved-fb-conversion',
    name: 'Appel planifie → Conversion API Facebook',
    description: 'Envoie l\'evenement "Schedule" a la Conversions API Facebook quand un appel est planifie.',
    category: 'calls',
    icon: 'bar-chart',
    trigger_type: 'call_scheduled',
    trigger_config: {},
    steps: [
      {
        step_type: 'action',
        action_type: 'facebook_conversions_api',
        action_config: {
          event_name: 'Schedule',
        },
      },
    ],
    requires_integration: ['meta'],
  },

  {
    id: 'rappel-rdv',
    name: 'Rappel RDV → WhatsApp J-1 et H-2',
    description: 'Envoie un rappel WhatsApp 24h avant le RDV, puis un second rappel 2h avant.',
    category: 'calls',
    icon: 'clock',
    trigger_type: 'call_in_x_hours',
    trigger_config: { hours_before: 24 },
    steps: [
      {
        step_type: 'action',
        action_type: 'send_whatsapp',
        action_config: {
          template: 'reminder_j1',
          message: 'Bonjour {{prenom}}, petit rappel : votre RDV est prevu demain a {{heure_rdv}}. A tres vite !',
        },
      },
      {
        step_type: 'delay',
        delay_value: 22,
        delay_unit: 'hours',
      },
      {
        step_type: 'action',
        action_type: 'send_whatsapp',
        action_config: {
          template: 'reminder_h2',
          message: 'Bonjour {{prenom}}, votre RDV est dans 2h. Pensez a vous connecter. A tout de suite !',
        },
      },
    ],
    requires_integration: ['whatsapp'],
  },

  {
    id: 'no-show-relance',
    name: 'No-show → Relance WhatsApp + Follow-up',
    description: 'Envoie un message WhatsApp de relance apres un no-show et cree un follow-up dans 2 jours.',
    category: 'calls',
    icon: 'phone-missed',
    trigger_type: 'call_no_show',
    trigger_config: {},
    steps: [
      {
        step_type: 'action',
        action_type: 'send_whatsapp',
        action_config: {
          template: 'no_show_relance',
          message: 'Bonjour {{prenom}}, nous n\'avons pas pu vous joindre pour votre RDV. Souhaitez-vous reprogrammer ? Repondez a ce message.',
        },
      },
      {
        step_type: 'action',
        action_type: 'create_followup',
        action_config: {
          reason: 'Relance apres no-show',
          delay_days: 2,
          channel: 'whatsapp',
        },
      },
    ],
    requires_integration: ['whatsapp'],
  },

  // ─── INSTAGRAM ──────────────────────────────────────────────────────────────

  {
    id: 'new-follower-nurturing',
    name: 'Nouveau follower → Sequence DM Instagram',
    description: 'Envoie une sequence de 3 DMs Instagram sur 3 jours pour convertir un nouveau follower en lead.',
    category: 'instagram',
    icon: 'instagram',
    trigger_type: 'new_follower',
    trigger_config: {},
    steps: [
      {
        step_type: 'action',
        action_type: 'send_dm_instagram',
        action_config: {
          message: 'Salut {{prenom}} ! Merci de me suivre. Je suis ravi de t\'avoir dans la communaute.',
        },
      },
      {
        step_type: 'delay',
        delay_value: 1,
        delay_unit: 'days',
      },
      {
        step_type: 'action',
        action_type: 'send_dm_instagram',
        action_config: {
          message: 'Au fait {{prenom}}, j\'ai un guide gratuit qui pourrait t\'interesser. Tu veux que je te l\'envoie ?',
        },
      },
      {
        step_type: 'delay',
        delay_value: 2,
        delay_unit: 'days',
      },
      {
        step_type: 'action',
        action_type: 'send_dm_instagram',
        action_config: {
          message: 'Hey {{prenom}} ! Si tu veux aller plus loin, je propose un appel decouverte gratuit. Ca te dit ? Voici le lien : {{booking_link}}',
        },
      },
    ],
    requires_integration: ['instagram'],
  },
]

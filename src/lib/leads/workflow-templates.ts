export interface WorkflowInlineStep {
  channel: 'whatsapp' | 'email' | 'instagram_dm' | 'manuel'
  delay_days: number
  template_text: string
}

export const WORKFLOW_TEMPLATES_BY_SOURCE: Record<string, WorkflowInlineStep[]> = {
  instagram_ads: [
    { channel: 'instagram_dm', delay_days: 1, template_text: 'Premiere relance — prise de contact' },
    { channel: 'instagram_dm', delay_days: 3, template_text: 'Relance de suivi' },
  ],
  follow_ads: [
    { channel: 'instagram_dm', delay_days: 1, template_text: 'Premiere relance — prise de contact' },
    { channel: 'instagram_dm', delay_days: 3, template_text: 'Relance de suivi' },
  ],
  facebook_ads: [
    { channel: 'whatsapp', delay_days: 0, template_text: 'Premier contact' },
    { channel: 'whatsapp', delay_days: 1, template_text: 'Relance rapide' },
    { channel: 'email', delay_days: 3, template_text: 'Relance email' },
  ],
  formulaire: [
    { channel: 'email', delay_days: 0, template_text: 'Confirmation inscription' },
    { channel: 'whatsapp', delay_days: 1, template_text: 'Relance de suivi' },
  ],
  funnel: [
    { channel: 'email', delay_days: 0, template_text: 'Confirmation inscription' },
    { channel: 'whatsapp', delay_days: 1, template_text: 'Relance de suivi' },
  ],
  manuel: [],
}

export interface WorkflowInlineStep {
  channel: 'whatsapp' | 'email' | 'instagram_dm' | 'manuel'
  delay_days: number
  template_text: string
}

export const WORKFLOW_TEMPLATES_BY_SOURCE: Record<string, WorkflowInlineStep[]> = {
  instagram_ads: [
    { channel: 'instagram_dm', delay_days: 0, template_text: "Salut {{prenom}} ! Merci de me suivre, tu es la pour [objectif] ?" },
    { channel: 'instagram_dm', delay_days: 2, template_text: "Hey {{prenom}}, je voulais te demander : qu'est-ce qui t'a fait cliquer sur mon profil ?" },
  ],
  follow_ads: [
    { channel: 'instagram_dm', delay_days: 0, template_text: "Salut {{prenom}} ! Merci de me suivre, tu es la pour [objectif] ?" },
    { channel: 'instagram_dm', delay_days: 2, template_text: "Hey {{prenom}}, je voulais te demander : qu'est-ce qui t'a fait cliquer sur mon profil ?" },
  ],
  facebook_ads: [
    { channel: 'whatsapp', delay_days: 0, template_text: "Bonjour {{prenom}}, suite a votre demande d'informations..." },
    { channel: 'whatsapp', delay_days: 1, template_text: "{{prenom}}, avez-vous eu le temps de regarder les informations ?" },
    { channel: 'email', delay_days: 3, template_text: "Bonjour {{prenom}}, je me permets de revenir vers vous..." },
  ],
  formulaire: [
    { channel: 'email', delay_days: 0, template_text: "Bonjour {{prenom}}, merci pour votre inscription !" },
    { channel: 'whatsapp', delay_days: 1, template_text: "{{prenom}}, avez-vous des questions ?" },
  ],
  funnel: [
    { channel: 'email', delay_days: 0, template_text: "Bonjour {{prenom}}, merci pour votre inscription !" },
    { channel: 'whatsapp', delay_days: 1, template_text: "{{prenom}}, avez-vous des questions ?" },
  ],
  manuel: [],
}

import type { PriorityCategory } from './priority'

export interface TemplateContext {
  firstName: string
  daysSinceLastContact: number | null
}

export interface RenderedTemplate {
  label: string
  text: string
}

export function pickTemplate(category: PriorityCategory, ctx: TemplateContext): RenderedTemplate {
  const name = ctx.firstName || 'là'

  if (category === 'premier_message' || category === 'engagement_instagram') {
    return {
      label: 'Premier message',
      text: `Salut ${name} ! J'ai vu ton profil, je me permets de venir vers toi.`,
    }
  }

  if (category === 'jamais_recontacte' && ctx.daysSinceLastContact !== null) {
    return {
      label: `Reprise après ${ctx.daysSinceLastContact} jours`,
      text: `Salut ${name}, ça fait un moment ! Je voulais savoir où tu en étais.`,
    }
  }

  return {
    label: 'Relance',
    text: `Salut ${name}, je reviens vers toi — toujours partant(e) ?`,
  }
}

/**
 * Defaults configs pour chaque type de bloc email. Équivalent de
 * `src/lib/funnels/defaults.ts`. Utilisé par le builder v2 quand le coach
 * ajoute un bloc depuis la palette.
 */

import type {
  EmailBlock,
  EmailBlockType,
  EmailBlockConfig,
  HeaderBlockConfig,
  EmailHeroBlockConfig,
  TextBlockConfig,
  ImageBlockConfig,
  ButtonBlockConfig,
  EmailCtaBannerBlockConfig,
  DividerBlockConfig,
  EmailSpacerBlockConfig,
  EmailQuoteBlockConfig,
  EmailTestimonialsBlockConfig,
  EmailFeaturesGridBlockConfig,
  EmailVideoBlockConfig,
  EmailSocialLinksBlockConfig,
  FooterBlockConfig,
} from '@/types'

export function getDefaultEmailBlockConfig(type: EmailBlockType): EmailBlockConfig {
  switch (type) {
    case 'header':
      return { title: 'Titre', alignment: 'center' } satisfies HeaderBlockConfig
    case 'hero':
      return {
        title: 'Bienvenue',
        subtitle: 'Un court message qui accroche.',
        ctaText: 'Découvrir',
        ctaUrl: '#',
        alignment: 'center',
      } satisfies EmailHeroBlockConfig
    case 'text':
      return { content: '' } satisfies TextBlockConfig
    case 'image':
      return {
        src: '',
        alt: '',
        alignment: 'center',
      } satisfies ImageBlockConfig
    case 'button':
      return {
        text: 'Cliquer ici',
        url: '#',
        color: '#E53E3E',
        alignment: 'center',
      } satisfies ButtonBlockConfig
    case 'cta_banner':
      return {
        text: 'Prêt à commencer ?',
        ctaText: "Réserver un appel",
        ctaUrl: '#',
      } satisfies EmailCtaBannerBlockConfig
    case 'divider':
      return { color: '#e4e4e7', spacing: 16 } satisfies DividerBlockConfig
    case 'spacer':
      return { height: 24 } satisfies EmailSpacerBlockConfig
    case 'quote':
      return {
        text: '"Une citation inspirante."',
        author: 'Auteur',
      } satisfies EmailQuoteBlockConfig
    case 'testimonials':
      return {
        items: [
          {
            quote: 'Le meilleur choix que j\'aie fait cette année.',
            author: 'Marie L.',
            role: 'Coach bien-être',
          },
        ],
      } satisfies EmailTestimonialsBlockConfig
    case 'features_grid':
      return {
        columns: 2,
        items: [
          { icon: '🎯', title: 'Objectif', description: 'Atteindre ton objectif rapidement.' },
          { icon: '📈', title: 'Progression', description: 'Suivre ta progression en temps réel.' },
          { icon: '🤝', title: 'Accompagnement', description: 'Un suivi personnalisé.' },
          { icon: '⚡', title: 'Résultats', description: 'Des résultats dès la première semaine.' },
        ],
      } satisfies EmailFeaturesGridBlockConfig
    case 'video':
      return {
        thumbnailUrl: '',
        linkUrl: '',
        caption: 'Regarder la vidéo',
      } satisfies EmailVideoBlockConfig
    case 'social_links':
      return {
        instagram: '',
        facebook: '',
      } satisfies EmailSocialLinksBlockConfig
    case 'footer':
      return { text: '' } satisfies FooterBlockConfig
  }
}

/** Génère un bloc complet avec ID unique (pattern emprunté à funnels). */
export function createDefaultEmailBlock(type: EmailBlockType): EmailBlock {
  return {
    id: `block-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    config: getDefaultEmailBlockConfig(type),
  }
}

/** Labels FR pour la palette de blocs. */
export const EMAIL_BLOCK_LABELS: Record<EmailBlockType, string> = {
  header: 'En-tête',
  hero: 'Hero',
  text: 'Texte',
  image: 'Image',
  button: 'Bouton',
  cta_banner: 'Bannière CTA',
  divider: 'Séparateur',
  spacer: 'Espacement',
  quote: 'Citation',
  testimonials: 'Témoignages',
  features_grid: 'Grille de features',
  video: 'Vidéo',
  social_links: 'Réseaux sociaux',
  footer: 'Pied de page',
}

/** Types de blocs ajoutables (footer exclu, auto-appendé en fin). */
export const ADDABLE_EMAIL_BLOCK_TYPES: EmailBlockType[] = [
  'header',
  'hero',
  'text',
  'image',
  'button',
  'cta_banner',
  'quote',
  'testimonials',
  'features_grid',
  'video',
  'social_links',
  'divider',
  'spacer',
]

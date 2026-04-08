/**
 * T-028 Phase 10 — Defaults réutilisables pour la création de blocs et de
 * pages de funnels.
 *
 * Utilisé à 2 endroits :
 * 1. `FunnelBuilderV2.handleAddBlock()` — quand le coach ajoute un bloc
 *    depuis le menu "Ajouter une section"
 * 2. `[id]/page.tsx` fetchFunnel + handleAddPage — quand une page est
 *    créée (soit la première page auto d'un funnel vide, soit une page
 *    ajoutée manuellement par le coach). Chaque nouvelle page démarre
 *    avec un squelette Hero + Text + Footer pour que le coach n'ait
 *    jamais une page vide (validé par Rémy le 2026-04-07).
 */

import type {
  FunnelBlock,
  FunnelBlockType,
  FunnelBlockConfig,
} from '@/types'

/**
 * Retourne la config initiale d'un bloc selon son type. Tous les champs
 * obligatoires sont remplis avec des valeurs "lambda" que le coach remplacera,
 * et les effets par-bloc sont activés par défaut pour que le rendu soit
 * "premium" dès la création (validé par Rémy — "les effets sont mis par
 * défaut et la personne peut les enlever").
 */
export function getDefaultBlockConfig(type: FunnelBlockType): FunnelBlockConfig {
  switch (type) {
    case 'hero':
      return {
        title: 'Transformez votre vie en 90 jours',
        subtitle:
          'Découvrez la méthode qui a déjà aidé +500 personnes à atteindre leurs objectifs.',
        ctaText: 'Voir la vidéo',
        ctaUrl: '#',
        backgroundImage: null,
        alignment: 'center',
        badgeText: 'Atelier 100% Gratuit',
        effects: { shimmer: true, buttonShine: true },
      }
    case 'video':
      return { url: '', autoplay: false, controls: true, aspectRatio: '16:9' }
    case 'testimonials':
      return {
        items: [
          {
            name: 'Sarah Martin',
            role: 'Coach business',
            content: "J'ai doublé mon CA en 4 mois grâce à la méthode.",
            avatarUrl: null,
            rating: 5,
          },
        ],
        layout: 'grid',
        columns: 3,
      }
    case 'form':
      return {
        title: 'Candidature',
        subtitle: 'Réponds aux questions pour qu\'on évalue si on peut t\'aider.',
        fields: [
          {
            key: 'email',
            label: 'Email',
            type: 'email',
            placeholder: 'votre@email.com',
            required: true,
          },
        ],
        submitText: 'Envoyer',
        redirectUrl: null,
        successMessage: 'Merci ! Nous reviendrons vers toi sous 24h.',
      }
    case 'booking':
      return {
        calendarId: null,
        title: 'Réserve ton appel',
        subtitle: '30 minutes pour qu\'on fasse le point sur ta situation.',
      }
    case 'pricing':
      return {
        title: 'Coaching essentiel',
        price: '297',
        currency: '€',
        period: 'mois',
        features: ['1 séance par semaine', 'Plan d\'action personnalisé', 'Support WhatsApp'],
        ctaText: 'Choisir cette offre',
        ctaUrl: '#',
        highlighted: false,
      }
    case 'faq':
      return {
        title: 'Questions fréquentes',
        items: [
          {
            question: 'Combien de temps prend l\'accompagnement ?',
            answer: 'Le programme dure 90 jours avec un suivi hebdomadaire.',
          },
        ],
      }
    case 'countdown':
      return {
        targetDate: new Date(Date.now() + 7 * 86400000).toISOString(),
        title: 'Offre limitée',
        expiredMessage: 'Cette offre est terminée.',
        style: 'simple',
      }
    case 'cta':
      return {
        text: 'Réserve ton appel',
        url: '#',
        style: 'primary',
        size: 'lg',
        alignment: 'center',
        effects: { buttonShine: true },
      }
    case 'text':
      return {
        content:
          'Voici un paragraphe de texte libre. Utilise cet espace pour expliquer ton offre en détail, raconter ton histoire ou renforcer l\'engagement du visiteur avant le CTA final.',
        alignment: 'center',
        // T-028 Phase 10 — shimmer ON par défaut (validé par Rémy)
        effects: { shimmer: true },
      }
    case 'image':
      return {
        src: '',
        alt: '',
        width: null,
        alignment: 'center',
        linkUrl: null,
      }
    case 'spacer':
      return { height: 48 }
    case 'footer':
      return {
        brand: 'Ma marque',
        year: new Date().getFullYear(),
        copyrightText: 'Tous droits réservés.',
      }
  }
}

/**
 * Génère un ID de bloc unique pour un nouveau bloc créé dans le builder.
 * Même pattern que `FunnelBuilderV2.handleAddBlock`.
 */
function generateBlockId(): string {
  return `block-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

/**
 * Crée un bloc complet (avec ID + config par défaut) prêt à être inséré
 * dans une page. Utilisé par `handleAddBlock` du builder et aussi par
 * `getDefaultPageBlocks` ci-dessous.
 */
export function createDefaultBlock(type: FunnelBlockType): FunnelBlock {
  return {
    id: generateBlockId(),
    type,
    config: getDefaultBlockConfig(type),
  }
}

/**
 * Retourne le **squelette par défaut** d'une nouvelle page de funnel.
 *
 * Validé avec Rémy le 2026-04-07 : chaque page créée (soit la première auto
 * d'un funnel vide, soit une nouvelle page ajoutée par le coach) doit
 * contenir au minimum Hero + Text + Footer. Le coach peut les supprimer
 * ensuite s'il veut, mais il n'aura jamais à démarrer d'une page vraiment
 * vide.
 *
 * Pourquoi ces 3 blocs :
 * - **Hero** : le point d'entrée visuel de toute page de coaching (badge,
 *   titre accrocheur, sous-titre, CTA principal)
 * - **Text** : un paragraphe au milieu pour expliquer l'offre, raconter
 *   l'histoire du coach ou renforcer l'engagement avant le CTA final
 * - **Footer** : brand + copyright + année — identité visuelle basique
 */
export function getDefaultPageBlocks(): FunnelBlock[] {
  return [createDefaultBlock('hero'), createDefaultBlock('text'), createDefaultBlock('footer')]
}

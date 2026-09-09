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
 * Génère un ID unique pour un item à l'intérieur d'une liste de bloc
 * (cartes Problèmes, étapes Programme, points Qualifier, stats Coach).
 * Même pattern que `generateBlockId` ci-dessous.
 */
function generateItemId(): string {
  return `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

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
            key: 'prenom',
            label: 'Prénom',
            type: 'text',
            placeholder: 'Ton prénom',
            required: true,
          },
          {
            key: 'email',
            label: 'Email',
            type: 'email',
            placeholder: 'votre@email.com',
            required: true,
          },
          {
            key: 'telephone',
            label: 'Téléphone',
            type: 'tel',
            placeholder: '06 12 34 56 78',
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
    case 'booking_actions':
      return {
        title: 'Ajoute le RDV à ton agenda',
        subtitle: 'En 1 clic, ton rendez-vous est dans ton calendrier.',
        googleLabel: 'Ajouter à Google Calendar',
        appleLabel: 'Ajouter à Apple / iCal',
        outlookLabel: 'Ajouter à Outlook',
        manageLabel: 'Reprogrammer ou annuler',
        noBookingMessage:
          "Tu n'as pas encore réservé de rendez-vous. Reviens sur cette page après avoir choisi un créneau pour pouvoir l'ajouter à ton agenda.",
        showManageLink: true,
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
        images: [],
        size: 'large',
        columns: 1,
      }
    case 'spacer':
      return { height: 48 }
    case 'footer':
      return {
        brand: 'Ma marque',
        year: new Date().getFullYear(),
        copyrightText: 'Tous droits réservés.',
      }
    case 'problems':
      return {
        title: 'Tu fais tout ça, mais rien ne change ?',
        subtitle: "Voici pourquoi tu n'avances pas malgré tes efforts.",
        items: [
          {
            id: generateItemId(),
            title: 'Tu t\'entraînes sans réelle stratégie',
            description: 'Tu enchaînes les séances sans progression mesurable, sans savoir si tu avances vraiment.',
            showNumber: true,
            icon: { name: 'Dumbbell' },
            imageUrl: null,
          },
          {
            id: generateItemId(),
            title: 'Tu ne sais pas quoi manger',
            description: 'Tu changes de régime toutes les semaines sans jamais obtenir de résultat durable.',
            showNumber: true,
            icon: { name: 'Utensils' },
            imageUrl: null,
          },
          {
            id: generateItemId(),
            title: 'Tu manques de constance',
            description: 'Motivé quelques semaines, puis tu abandonnes — le cycle recommence.',
            showNumber: true,
            icon: { name: 'Flame' },
            imageUrl: null,
          },
        ],
        columns: 3,
        numberLabel: 'PROBLÈME',
      }
    case 'program':
      return {
        title: 'Comment fonctionne l\'accompagnement',
        subtitle: 'Une méthode structurée en 4 étapes, du diagnostic aux résultats.',
        items: [
          {
            id: generateItemId(),
            number: '01',
            title: 'Analyse',
            description: 'On fait le point sur ton niveau, ton objectif, ton alimentation et ta situation actuelle.',
            icon: { name: 'Compass' },
            imageUrl: null,
          },
          {
            id: generateItemId(),
            number: '02',
            title: 'Plan personnalisé',
            description: 'Tu reçois un plan d\'entraînement et une stratégie nutritionnelle adaptés à ton objectif.',
            icon: { name: 'Target' },
            imageUrl: null,
          },
          {
            id: generateItemId(),
            number: '03',
            title: 'Suivi',
            description: 'On analyse tes données chaque semaine et on ajuste ton plan en conséquence.',
            icon: { name: 'BarChart3' },
            imageUrl: null,
          },
          {
            id: generateItemId(),
            number: '04',
            title: 'Progression',
            description: 'Tu avances avec une méthode structurée plutôt que de fonctionner au hasard.',
            icon: { name: 'TrendingUp' },
            imageUrl: null,
          },
        ],
        columns: 4,
      }
    case 'qualifier':
      return {
        yes: {
          title: 'C\'est pour toi si',
          icon: { name: 'CheckCircle2' },
          items: [
            { id: generateItemId(), text: 'Tu veux réellement transformer ton physique' },
            { id: generateItemId(), text: 'Tu es prêt à t\'investir' },
            { id: generateItemId(), text: 'Tu acceptes de suivre un cadre' },
            { id: generateItemId(), text: 'Tu veux être accompagné' },
          ],
        },
        no: {
          title: 'Ce n\'est pas pour toi si',
          icon: { name: 'XCircle' },
          items: [
            { id: generateItemId(), text: 'Tu cherches une solution miracle' },
            { id: generateItemId(), text: 'Tu ne veux rien changer à tes habitudes' },
            { id: generateItemId(), text: 'Tu n\'es pas prêt à t\'investir' },
            { id: generateItemId(), text: 'Tu veux des résultats sans effort' },
          ],
        },
      }
    case 'about_coach':
      return {
        imageUrl: null,
        title: 'Qui suis-je ?',
        subtitle: 'Coach certifié, 5 ans d\'expérience',
        text: 'Depuis 5 ans, j\'accompagne des dizaines de personnes à transformer leur physique et leur discipline grâce à une méthode structurée, sans injonction ni solution miracle.',
        ctaText: 'Réserve ton appel',
        ctaUrl: '#',
        stats: [
          { id: generateItemId(), value: '100+', label: 'Clients accompagnés' },
          { id: generateItemId(), value: '5+', label: 'Années d\'expérience' },
        ],
        layout: 'image-left',
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
 * T-028 Phase 11 — Templates de page proposés quand le coach clique sur
 * le "+" à côté des onglets de pages dans le builder. Chaque template
 * est un squelette de blocs pré-remplis adaptés à un usage spécifique
 * (VSL, capture lead, remerciement, prise de RDV, ou vierge).
 *
 * Le coach peut ensuite modifier/supprimer n'importe quel bloc une fois
 * la page créée. Les templates ne sont qu'un point de départ.
 */
export type FunnelPageTemplate =
  | 'blank'
  | 'vsl'
  | 'capture'
  | 'thank-you'
  | 'booking'

export interface FunnelPageTemplateMeta {
  id: FunnelPageTemplate
  label: string
  description: string
  /** Nom de l'icône Lucide à afficher. */
  icon: 'file-text' | 'video' | 'file-input' | 'heart-handshake' | 'calendar'
}

export const PAGE_TEMPLATES: readonly FunnelPageTemplateMeta[] = [
  {
    id: 'blank',
    label: 'Page vierge',
    description: 'Hero + Texte + Footer (squelette minimal)',
    icon: 'file-text',
  },
  {
    id: 'vsl',
    label: 'Page VSL classique',
    description: 'Hero + Vidéo + Témoignages + CTA + Footer',
    icon: 'video',
  },
  {
    id: 'capture',
    label: 'Page de capture',
    description: 'Hero + Formulaire + Footer',
    icon: 'file-input',
  },
  {
    id: 'thank-you',
    label: 'Page de remerciement',
    description: 'Hero + Texte de confirmation + Footer',
    icon: 'heart-handshake',
  },
  {
    id: 'booking',
    label: 'Page de prise de RDV',
    description: 'Hero + Bouton de réservation + Footer',
    icon: 'calendar',
  },
] as const

/**
 * Retourne le squelette de blocs d'une nouvelle page selon le template choisi.
 * Validé avec Rémy le 2026-04-07 : chaque page démarre avec quelque chose de
 * concret au lieu d'être vide.
 */
export function getDefaultPageBlocksForTemplate(
  template: FunnelPageTemplate,
): FunnelBlock[] {
  switch (template) {
    // ─── Page vierge (Hero + Text + Footer) ──────────────────────────────
    case 'blank':
      return [
        createDefaultBlock('hero'),
        createDefaultBlock('text'),
        createDefaultBlock('footer'),
      ]

    // ─── VSL : Hero d'accroche + Vidéo + Témoignages + CTA + Footer ──────
    case 'vsl': {
      const hero = createDefaultBlock('hero')
      // Ajuste le CTA du Hero pour qu'il scroll vers la vidéo au lieu de "#"
      ;(hero.config as { ctaText: string }).ctaText = 'Regarde la vidéo'
      return [
        hero,
        createDefaultBlock('video'),
        createDefaultBlock('testimonials'),
        createDefaultBlock('cta'),
        createDefaultBlock('footer'),
      ]
    }

    // ─── Capture : Hero (promesse) + Form + Footer ────────────────────────
    case 'capture': {
      const hero = createDefaultBlock('hero')
      const heroConfig = hero.config as {
        title: string
        subtitle: string
        ctaText: string
        badgeText: string
      }
      heroConfig.title = 'Reçois le guide gratuit'
      heroConfig.subtitle =
        "Laisse ton email pour recevoir la méthode complète directement dans ta boîte de réception."
      heroConfig.ctaText = 'Je veux le guide'
      heroConfig.badgeText = 'Guide 100% Gratuit'
      return [hero, createDefaultBlock('form'), createDefaultBlock('footer')]
    }

    // ─── Remerciement : Hero de confirmation + Text + Footer ──────────────
    case 'thank-you': {
      const hero = createDefaultBlock('hero')
      const heroConfig = hero.config as {
        title: string
        subtitle: string
        ctaText: string
        badgeText: string
      }
      heroConfig.title = 'Merci ! Ton inscription est confirmée 🎉'
      heroConfig.subtitle =
        "Tu vas recevoir un email dans quelques minutes avec toutes les informations."
      heroConfig.ctaText = ''
      heroConfig.badgeText = 'Confirmé'

      const text = createDefaultBlock('text')
      ;(text.config as { content: string }).content =
        "En attendant, n'hésite pas à ajouter notre email à tes contacts pour être sûr de bien recevoir nos messages. À très vite !"

      return [hero, text, createDefaultBlock('footer')]
    }

    // ─── Booking : Hero + Booking placeholder + Footer ────────────────────
    case 'booking': {
      const hero = createDefaultBlock('hero')
      const heroConfig = hero.config as {
        title: string
        subtitle: string
        ctaText: string
        badgeText: string
      }
      heroConfig.title = 'Réserve ton appel découverte'
      heroConfig.subtitle =
        "30 minutes pour qu'on fasse le point sur ta situation et comment on peut t'aider."
      heroConfig.ctaText = ''
      heroConfig.badgeText = 'Appel Offert'
      return [hero, createDefaultBlock('booking'), createDefaultBlock('footer')]
    }
  }
}

/**
 * @deprecated T-028 Phase 11 — Gardé pour compat avec les appels qui ne
 * spécifient pas de template. Équivalent à `getDefaultPageBlocksForTemplate('blank')`.
 */
export function getDefaultPageBlocks(): FunnelBlock[] {
  return getDefaultPageBlocksForTemplate('blank')
}

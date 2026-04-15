import type { FunnelBlock, FunnelBlockType, FunnelBlockConfig } from '@/types'

// ─── Template Types ─────────────────────────────────────────────────────────

export interface FunnelTemplatePage {
  name: string
  slug: string
  blocks: FunnelBlock[]
}

export interface FunnelTemplate {
  id: string
  name: string
  description: string
  category: string
  /** 'funnel' = tunnel multi-pages, 'page' = page individuelle. */
  kind: 'funnel' | 'page'
  pages: FunnelTemplatePage[]
  thumbnail: string | null
  comingSoon?: boolean
}

// ─── Helpers ────────────────────────────────────────────────────────────────

let blockCounter = 0

function block<T extends FunnelBlockConfig>(
  type: FunnelBlockType,
  config: T
): FunnelBlock {
  blockCounter += 1
  return {
    id: `tpl-block-${blockCounter}`,
    type,
    config,
  }
}

/** Footer par défaut ajouté à chaque page de template. */
function footerBlock(): FunnelBlock {
  return block('footer', {
    brand: 'Ma marque',
    year: new Date().getFullYear(),
    copyrightText: 'Tous droits réservés.',
  })
}

// ─── Templates ──────────────────────────────────────────────────────────────

export const FUNNEL_TEMPLATES: FunnelTemplate[] = (() => {
  // On utilise une IIFE pour pouvoir stocker les blocs en variables
  // et référencer leurs IDs dans les liens (ancres #block-{id}).

  // ─── 1. VSL classique ─────────────────────────────────────────────────
  const vslVideo = block('video', { url: '', autoplay: false, controls: true, aspectRatio: '16:9' })
  const tplVsl: FunnelTemplate = {
    id: 'tpl-vsl-classique',
    name: 'VSL classique',
    description:
      'Page de vente vidéo avec témoignages et appel à l\'action. Idéal pour présenter une offre de coaching.',
    category: 'vsl',
    kind: 'page' as const,
    thumbnail: null,
    pages: [
      {
        name: 'Page de vente',
        slug: 'vente',
        blocks: [
          block('hero', {
            title: 'Transformez votre vie en 90 jours',
            subtitle:
              'Découvrez la méthode qui a déjà aidé +500 personnes à atteindre leurs objectifs.',
            ctaText: 'Voir la vidéo',
            ctaUrl: `#block-${vslVideo.id}`,
            backgroundImage: null,
            alignment: 'center',
            badgeText: 'Atelier 100% Gratuit',
            effects: { shimmer: true, buttonShine: true },
          }),
          vslVideo,
          block('spacer', { height: 48 }),
          block('testimonials', {
            items: [
              {
                name: 'Marie D.',
                role: 'Entrepreneure',
                content:
                  'Grâce à ce programme, j\'ai doublé mon chiffre d\'affaires en 3 mois.',
                avatarUrl: null,
                rating: 5,
              },
              {
                name: 'Thomas L.',
                role: 'Coach sportif',
                content:
                  'La méthode est simple et les résultats sont au rendez-vous.',
                avatarUrl: null,
                rating: 5,
              },
              {
                name: 'Sophie M.',
                role: 'Consultante',
                content:
                  'Un accompagnement de qualité. Je recommande à 100%.',
                avatarUrl: null,
                rating: 5,
              },
            ],
            layout: 'grid',
            columns: 3,
          }),
          block('cta', {
            text: 'Réserver mon appel gratuit',
            url: '#',
            style: 'primary',
            size: 'lg',
            alignment: 'center',
            effects: { buttonShine: true },
          }),
          footerBlock(),
        ],
      },
    ],
  }

  // ─── 2. Page de capture ───────────────────────────────────────────────
  const tplCapture: FunnelTemplate = {
    id: 'tpl-page-capture',
    name: 'Page de capture',
    description:
      'Formulaire simple pour capturer des leads. Prénom, email et téléphone.',
    category: 'capture',
    kind: 'page' as const,
    thumbnail: null,
    pages: [
      {
        name: 'Capture',
        slug: 'capture',
        blocks: [
          block('hero', {
            title: 'Recevez votre guide gratuit',
            subtitle:
              'Entrez vos informations ci-dessous pour recevoir le guide par email.',
            ctaText: '',
            ctaUrl: '',
            backgroundImage: null,
            alignment: 'center',
            badgeText: 'Guide Gratuit',
            effects: { shimmer: true, buttonShine: true },
          }),
          block('form', {
            title: 'Vos informations',
            subtitle: 'Remplissez le formulaire pour accéder au guide.',
            fields: [
              {
                key: 'first_name',
                label: 'Prénom',
                type: 'text',
                placeholder: 'Votre prénom',
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
                key: 'phone',
                label: 'Téléphone',
                type: 'tel',
                placeholder: '06 12 34 56 78',
                required: false,
              },
            ],
            submitText: 'Recevoir le guide',
            redirectUrl: null,
            successMessage: 'Merci ! Vérifiez votre boîte email.',
          }),
          footerBlock(),
        ],
      },
    ],
  }

  // ─── 3. Funnel complet (4 pages, liées entre elles) ───────────────────
  const fcVideo = block('video', { url: '', autoplay: false, controls: true, aspectRatio: '16:9' })
  const tplFunnelComplet: FunnelTemplate = {
    id: 'tpl-funnel-complet',
    name: 'Funnel complet',
    description:
      'Tunnel de vente en 4 étapes : VSL, candidature, prise de rendez-vous et remerciement.',
    category: 'complet',
    kind: 'funnel' as const,
    thumbnail: null,
    pages: [
      {
        name: 'Page de vente',
        slug: 'vente',
        blocks: [
          block('hero', {
            title: 'Prêt à passer au niveau supérieur ?',
            subtitle: 'Regardez cette vidéo pour découvrir comment notre programme peut vous aider.',
            ctaText: 'Regarder la vidéo',
            ctaUrl: `#block-${fcVideo.id}`,
            backgroundImage: null,
            alignment: 'center',
            badgeText: 'Programme Exclusif',
            effects: { shimmer: true, buttonShine: true },
          }),
          fcVideo,
          block('spacer', { height: 32 }),
          block('faq', {
            title: 'Questions fréquentes',
            items: [
              { question: 'Pour qui est ce programme ?', answer: 'Ce programme s\'adresse aux entrepreneurs et coachs qui veulent scaler leur activité.' },
              { question: 'Combien de temps dure le programme ?', answer: 'Le programme dure 12 semaines avec un suivi personnalisé.' },
              { question: 'Y a-t-il une garantie ?', answer: 'Oui, nous offrons une garantie satisfait ou remboursé de 30 jours.' },
            ],
          }),
          block('cta', {
            text: 'Postuler maintenant',
            url: 'page:candidature',
            style: 'primary',
            size: 'lg',
            alignment: 'center',
            effects: { buttonShine: true },
          }),
          footerBlock(),
        ],
      },
      {
        name: 'Candidature',
        slug: 'candidature',
        blocks: [
          block('hero', {
            title: 'Formulaire de candidature',
            subtitle: 'Répondez à quelques questions pour que nous puissions préparer votre appel.',
            ctaText: '',
            ctaUrl: '',
            backgroundImage: null,
            alignment: 'center',
            effects: { shimmer: true },
          }),
          block('form', {
            title: '',
            subtitle: '',
            fields: [
              { key: 'prenom', label: 'Prénom', type: 'text', placeholder: 'Votre prénom', required: true },
              { key: 'email', label: 'Email', type: 'email', placeholder: 'votre@email.com', required: true },
              { key: 'telephone', label: 'Téléphone', type: 'tel', placeholder: '06 12 34 56 78', required: true },
              { key: 'situation', label: 'Décrivez votre situation actuelle', type: 'textarea', placeholder: 'Dites-nous en plus sur votre activité...', required: true },
              { key: 'revenue', label: 'Chiffre d\'affaires mensuel', type: 'select', placeholder: 'Sélectionnez', required: true, options: ['Moins de 3 000 €', '3 000 € - 10 000 €', '10 000 € - 30 000 €', 'Plus de 30 000 €'] },
            ],
            submitText: 'Envoyer ma candidature',
            redirectUrl: 'page:booking',
            successMessage: 'Candidature envoyée !',
          }),
          footerBlock(),
        ],
      },
      {
        name: 'Réservation',
        slug: 'booking',
        blocks: [
          block('hero', {
            title: 'Réservez votre appel stratégique',
            subtitle: 'Choisissez un créneau qui vous convient pour un appel de 30 minutes.',
            ctaText: '',
            ctaUrl: '',
            backgroundImage: null,
            alignment: 'center',
            effects: { shimmer: true },
          }),
          block('booking', { calendarId: null, title: 'Choisissez votre créneau', subtitle: 'Appel stratégique gratuit de 30 minutes.' }),
          footerBlock(),
        ],
      },
      {
        name: 'Merci',
        slug: 'merci',
        blocks: [
          block('hero', {
            title: 'Merci ! Votre appel est confirmé',
            subtitle: 'Vous allez recevoir un email de confirmation avec les détails de votre rendez-vous.',
            ctaText: '',
            ctaUrl: '',
            backgroundImage: null,
            alignment: 'center',
            badgeText: 'Confirmé',
            effects: { shimmer: true },
          }),
          block('text', {
            content: '<p>En attendant votre appel, voici ce que vous pouvez faire :</p><ul><li>Préparez vos questions</li><li>Réfléchissez à vos objectifs pour les 90 prochains jours</li><li>Notez vos blocages actuels</li></ul>',
            alignment: 'center',
            effects: { shimmer: true },
          }),
          footerBlock(),
        ],
      },
    ],
  }

  // ─── 4. Page de remerciement ──────────────────────────────────────────
  const tplMerci: FunnelTemplate = {
    id: 'tpl-page-merci',
    name: 'Page de remerciement',
    description: 'Page de remerciement simple après une inscription ou un achat.',
    category: 'merci',
    kind: 'page' as const,
    thumbnail: null,
    pages: [{
      name: 'Merci',
      slug: 'merci',
      blocks: [
        block('hero', {
          title: 'Merci pour votre inscription !',
          subtitle: 'Vous allez recevoir un email avec toutes les informations.',
          ctaText: '', ctaUrl: '', backgroundImage: null, alignment: 'center',
          badgeText: 'Confirmé',
          effects: { shimmer: true },
        }),
        block('text', {
          content: '<p>Nous avons bien reçu votre demande. Un membre de notre équipe vous contactera dans les 24 heures.</p><p>En attendant, n\'hésitez pas à nous suivre sur les réseaux sociaux.</p>',
          alignment: 'center',
          effects: { shimmer: true },
        }),
        block('cta', {
          text: 'Retour à l\'accueil', url: '/', style: 'secondary', size: 'md', alignment: 'center',
        }),
        footerBlock(),
      ],
    }],
  }

  // ─── 5. Page de réservation ─────────────────────────────────────────
  const tplReservation: FunnelTemplate = {
    id: 'tpl-page-reservation',
    name: 'Réservation',
    description: 'Page de prise de rendez-vous avec calendrier intégré. Idéal pour les appels découverte.',
    category: 'reservation',
    kind: 'page' as const,
    thumbnail: null,
    pages: [{
      name: 'Réservation',
      slug: 'reservation',
      blocks: [
        block('hero', {
          title: 'Réservez votre appel découverte',
          subtitle: '30 minutes pour faire le point sur votre situation et voir comment on peut vous aider.',
          ctaText: '', ctaUrl: '', backgroundImage: null, alignment: 'center',
          badgeText: 'Appel Offert',
          effects: { shimmer: true },
        }),
        block('booking', { calendarId: null, title: 'Choisissez votre créneau', subtitle: 'Appel stratégique gratuit de 30 minutes.' }),
        footerBlock(),
      ],
    }],
  }

  // ─── 6. Page de candidature ─────────────────────────────────────────
  const tplCandidature: FunnelTemplate = {
    id: 'tpl-page-candidature',
    name: 'Candidature',
    description: 'Formulaire de candidature détaillé pour qualifier les prospects avant un appel.',
    category: 'candidature',
    kind: 'page' as const,
    thumbnail: null,
    pages: [{
      name: 'Candidature',
      slug: 'candidature',
      blocks: [
        block('hero', {
          title: 'Postulez pour rejoindre le programme',
          subtitle: 'Répondez à quelques questions pour que nous puissions évaluer votre situation.',
          ctaText: '', ctaUrl: '', backgroundImage: null, alignment: 'center',
          effects: { shimmer: true },
        }),
        block('form', {
          title: '', subtitle: '',
          fields: [
            { key: 'prenom', label: 'Prénom', type: 'text', placeholder: 'Ton prénom', required: true },
            { key: 'email', label: 'Email', type: 'email', placeholder: 'votre@email.com', required: true },
            { key: 'telephone', label: 'Téléphone', type: 'tel', placeholder: '06 12 34 56 78', required: true },
            { key: 'situation', label: 'Décrivez votre situation actuelle', type: 'textarea', placeholder: 'Dites-nous en plus sur votre activité...', required: true },
            { key: 'revenue', label: 'Chiffre d\'affaires mensuel', type: 'select', placeholder: 'Sélectionnez', required: true, options: ['Moins de 3 000 €', '3 000 € - 10 000 €', '10 000 € - 30 000 €', 'Plus de 30 000 €'] },
          ],
          submitText: 'Envoyer ma candidature',
          redirectUrl: null,
          successMessage: 'Merci ! Nous reviendrons vers vous sous 24h.',
        }),
        footerBlock(),
      ],
    }],
  }

  // ─── Funnels complets "À venir" ─────────────────────────────────────
  const tplQuiz: FunnelTemplate = {
    id: 'tpl-quiz-funnel', name: 'Quiz funnel',
    description: 'Funnel sous forme de quiz interactif : le visiteur répond à quelques questions et reçoit un résultat personnalisé + une offre adaptée.',
    category: 'quiz', kind: 'funnel' as const, thumbnail: null, comingSoon: true, pages: [],
  }
  const tplWebinar: FunnelTemplate = {
    id: 'tpl-webinar-funnel', name: 'Webinar funnel',
    description: 'Funnel d\'inscription à un webinaire : inscription + remerciement + replay + vente post-webinar.',
    category: 'webinar', kind: 'funnel' as const, thumbnail: null, comingSoon: true, pages: [],
  }

  return [tplVsl, tplCapture, tplFunnelComplet, tplMerci, tplReservation, tplCandidature, tplQuiz, tplWebinar]
})()

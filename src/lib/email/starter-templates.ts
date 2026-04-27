/**
 * 6 starter templates utilisés dans la galerie lors de la création d'un
 * template. Chacun utilise le preset `classique` par défaut — le coach
 * peut changer via la Direction artistique ensuite.
 */

import type { EmailBlock, EmailBlockType } from '@/types'
import { createDefaultEmailBlock } from './defaults'

export interface StarterTemplate {
  id: string
  name: string
  description: string
  subject: string
  preset_id: string
  blocks: EmailBlock[]
}

/**
 * Helper pour construire un block avec un overlay sur la config par défaut.
 * Pas de narrowing type-safe possible car EmailBlock n'est pas une union
 * discriminée sur `type` côté config, donc on cast en Record générique.
 */
function block(type: EmailBlockType, config: Record<string, unknown>): EmailBlock {
  const base = createDefaultEmailBlock(type)
  return {
    ...base,
    config: { ...(base.config as Record<string, unknown>), ...config } as EmailBlock['config'],
  }
}

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: 'newsletter',
    name: 'Newsletter',
    description: 'Rendez-vous mensuel avec tes abonnés : actus, tips, CTA.',
    subject: '{{prenom}}, le récap du mois est arrivé',
    preset_id: 'classique',
    blocks: [
      block('header', { title: 'Ta newsletter du mois', alignment: 'center' }),
      block('text', {
        content:
          "<p>Hello {{prenom}},</p><p>Voici un récap des nouveautés, conseils et opportunités à ne pas manquer ce mois-ci.</p>",
      }),
      block('features_grid', {
        columns: 2,
        items: [
          { icon: '📣', title: 'Nouveauté', description: 'Le programme a évolué — découvre ce qui change.' },
          { icon: '💡', title: 'Tip du mois', description: "3 habitudes simples à mettre en place dès cette semaine." },
          { icon: '🎙', title: 'Podcast', description: "Mon dernier épisode sur la procrastination." },
          { icon: '📆', title: 'Agenda', description: "Les prochains événements à venir." },
        ],
      }),
      block('button', { text: 'Tout lire sur le blog', url: 'https://', alignment: 'center' }),
      block('footer', { text: 'Tu reçois cet email car tu es inscrit à la newsletter.' }),
    ],
  },
  {
    id: 'promo',
    name: 'Promo / Offre spéciale',
    description: 'Lance une promo avec impact : hero + preuves sociales + CTA.',
    subject: "{{prenom}}, -30% ce week-end seulement",
    preset_id: 'impact',
    blocks: [
      block('hero', {
        title: "-30% jusqu'à dimanche",
        subtitle: "C'est le bon moment de te lancer. Offre limitée à 48h.",
        ctaText: 'Je profite de -30%',
        ctaUrl: 'https://',
        alignment: 'center',
      }),
      block('testimonials', {
        items: [
          { quote: "J'ai perdu 8kg en 3 mois, je ne me reconnais plus.", author: 'Julie M.', role: 'Cliente depuis 2024' },
          { quote: "Le meilleur investissement de l'année.", author: 'Marc D.', role: 'Entrepreneur' },
        ],
      }),
      block('features_grid', {
        columns: 3,
        items: [
          { icon: '⚡', title: 'Résultats rapides', description: "Dès la première semaine." },
          { icon: '🎯', title: 'Sur-mesure', description: "Un programme adapté à ton profil." },
          { icon: '🤝', title: 'Accompagnement', description: "Je suis là à chaque étape." },
        ],
      }),
      block('cta_banner', {
        text: 'Dernier appel : -30% jusqu\'à dimanche minuit',
        ctaText: 'Rejoindre maintenant',
        ctaUrl: 'https://',
      }),
      block('footer', { text: 'Promotion valable jusqu\'au dimanche 23h59.' }),
    ],
  },
  {
    id: 'welcome',
    name: 'Bienvenue',
    description: "Premier email après inscription : accueil chaleureux + next steps.",
    subject: 'Bienvenue {{prenom}} 👋',
    preset_id: 'foret',
    blocks: [
      block('hero', {
        title: 'Bienvenue {{prenom}} !',
        subtitle: "Merci de nous rejoindre. Voici comment bien démarrer.",
        ctaText: 'Commencer maintenant',
        ctaUrl: 'https://',
        alignment: 'center',
      }),
      block('text', {
        content:
          "<p>Très contente de t'accueillir dans la communauté.</p><p>Pour bien démarrer, je te recommande de commencer par ces 3 étapes simples :</p>",
      }),
      block('features_grid', {
        columns: 3,
        items: [
          { icon: '1️⃣', title: 'Complète ton profil', description: "Ça prend 2 minutes." },
          { icon: '2️⃣', title: 'Regarde la vidéo', description: "15 min d'introduction." },
          { icon: '3️⃣', title: 'Réserve ton appel', description: "On fait le point ensemble." },
        ],
      }),
      block('button', { text: 'Réserver mon appel', url: 'https://', alignment: 'center' }),
      block('footer', { text: 'À très vite, {{nom_coach}}' }),
    ],
  },
  {
    id: 'confirmation_rdv',
    name: 'Confirmation RDV',
    description: 'Email de confirmation après prise de rendez-vous.',
    subject: 'Ton RDV est confirmé 📅',
    preset_id: 'minimal',
    blocks: [
      block('header', { title: 'Rendez-vous confirmé', alignment: 'center' }),
      block('text', {
        content:
          "<p>Bonjour {{prenom}},</p><p>Ton rendez-vous avec <strong>{{nom_coach}}</strong> est bien confirmé.</p>",
      }),
      block('quote', {
        text: 'Prépare-toi à faire un vrai bilan : objectifs, blocages actuels, ce que tu veux atteindre dans les 3 prochains mois.',
      }),
      block('button', { text: 'Ajouter à mon agenda', url: 'https://', alignment: 'center' }),
      block('text', {
        content:
          "<p>Tu as des questions d'ici là ? Réponds simplement à cet email.</p>",
      }),
      block('footer', { text: 'Un imprévu ? Tu peux replanifier via le lien dans ton espace.' }),
    ],
  },
  {
    id: 'relance',
    name: 'Relance lead inactif',
    description: 'Réveille un lead qui ne t\'a pas répondu depuis plusieurs jours.',
    subject: 'Toujours là {{prenom}} ?',
    preset_id: 'ocean',
    blocks: [
      block('header', { title: 'Tu nous manques 👋', alignment: 'center' }),
      block('text', {
        content:
          "<p>Hello {{prenom}},</p><p>On ne s'est pas parlé depuis un moment. Est-ce que tu es toujours motivé pour avancer sur tes objectifs ?</p>",
      }),
      block('quote', {
        text: "Les meilleurs résultats arrivent quand on arrête de repousser. Un simple appel de 15 min peut tout changer.",
      }),
      block('button', { text: 'Réserver un appel rapide', url: 'https://', alignment: 'center' }),
      block('footer', { text: 'Si tu n\'es plus intéressé, tu peux ignorer ce message.' }),
    ],
  },
  {
    id: 'testimonial_highlight',
    name: 'Témoignage client',
    description: 'Met en avant une réussite client avec photo + citation + CTA.',
    subject: "Comment {{prenom}} a atteint son objectif en 3 mois",
    preset_id: 'violet',
    blocks: [
      block('header', { title: 'Une réussite qui inspire', alignment: 'center' }),
      block('text', {
        content:
          "<p>Hello {{prenom}},</p><p>Aujourd'hui je voulais te partager l'histoire de Sarah, qui a fait un parcours impressionnant ces 3 derniers mois.</p>",
      }),
      block('testimonials', {
        items: [
          {
            quote:
              "Je n'osais pas me lancer pendant des mois. J'ai eu raison de franchir le pas — mon quotidien a changé du tout au tout.",
            author: 'Sarah L.',
            role: 'Cliente depuis 3 mois',
          },
        ],
      }),
      block('video', {
        thumbnailUrl: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=600',
        linkUrl: 'https://',
        caption: 'Voir son témoignage complet (3 min)',
      }),
      block('cta_banner', {
        text: 'Et si c\'était ton tour ?',
        ctaText: 'Réserver mon appel',
        ctaUrl: 'https://',
      }),
      block('footer', { text: 'Tu as des questions ? Réponds directement à cet email.' }),
    ],
  },
]

// Static catalogs mirrored from the web:
// - FUNNEL_TEMPLATES metadata (src/lib/funnels/templates.ts) — only id/name/
//   description/kind/page count: the pages themselves are built SERVER-side
//   by POST /api/funnels { template_id }.
// - Email STARTER_TEMPLATES (src/lib/email/starter-templates.ts), with the
//   block defaults of src/lib/email/defaults.ts inlined, because the web
//   gallery POSTs the full blocks to /api/emails/templates.

export interface FunnelTemplateMeta {
  id: string
  name: string
  description: string
  kind: 'funnel' | 'page'
  pageCount: number
  comingSoon?: boolean
}

export const FUNNEL_TEMPLATES: FunnelTemplateMeta[] = [
  {
    id: 'tpl-vsl-classique',
    name: 'VSL classique',
    description: "Page de vente vidéo avec témoignages et appel à l'action. Idéal pour présenter une offre de coaching.",
    kind: 'page',
    pageCount: 1,
  },
  {
    id: 'tpl-page-capture',
    name: 'Page de capture',
    description: 'Formulaire simple pour capturer des leads. Prénom, email et téléphone.',
    kind: 'page',
    pageCount: 1,
  },
  {
    id: 'tpl-funnel-complet',
    name: 'Funnel complet',
    description: 'Tunnel de vente en 4 étapes : VSL, candidature, prise de rendez-vous et remerciement.',
    kind: 'funnel',
    pageCount: 4,
  },
  {
    id: 'tpl-page-merci',
    name: 'Page de remerciement',
    description: 'Page de remerciement simple après une inscription ou un achat.',
    kind: 'page',
    pageCount: 1,
  },
  {
    id: 'tpl-page-reservation',
    name: 'Réservation',
    description: 'Page de prise de rendez-vous avec calendrier intégré. Idéal pour les appels découverte.',
    kind: 'page',
    pageCount: 1,
  },
  {
    id: 'tpl-page-candidature',
    name: 'Candidature',
    description: 'Formulaire de candidature détaillé pour qualifier les prospects avant un appel.',
    kind: 'page',
    pageCount: 1,
  },
  {
    id: 'tpl-quiz-funnel',
    name: 'Quiz funnel',
    description:
      'Funnel sous forme de quiz interactif : le visiteur répond à quelques questions et reçoit un résultat personnalisé + une offre adaptée.',
    kind: 'funnel',
    pageCount: 0,
    comingSoon: true,
  },
  {
    id: 'tpl-webinar-funnel',
    name: 'Webinar funnel',
    description: "Funnel d'inscription à un webinaire : inscription + remerciement + replay + vente post-webinar.",
    kind: 'funnel',
    pageCount: 0,
    comingSoon: true,
  },
]

// ─── Email starters ─────────────────────────────────────────────────────────

type Cfg = Record<string, unknown>

const EMAIL_BLOCK_DEFAULTS: Record<string, Cfg> = {
  header: { title: 'Titre', alignment: 'center' },
  hero: { title: 'Bienvenue', subtitle: 'Un court message qui accroche.', ctaText: 'Découvrir', ctaUrl: '#', alignment: 'center' },
  text: { content: '' },
  button: { text: 'Cliquer ici', url: '#', color: '#E53E3E', alignment: 'center' },
  cta_banner: { text: 'Prêt à commencer ?', ctaText: 'Réserver un appel', ctaUrl: '#' },
  quote: { text: '"Une citation inspirante."', author: 'Auteur' },
  testimonials: { items: [] },
  features_grid: { columns: 2, items: [] },
  video: { thumbnailUrl: '', linkUrl: '', caption: 'Regarder la vidéo' },
  footer: { text: '' },
}

export interface EmailBlockDraft {
  id: string
  type: string
  config: Cfg
}

let seq = 0
function block(type: string, config: Cfg): EmailBlockDraft {
  seq += 1
  return {
    id: `block-${Date.now()}-${seq}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    config: { ...(EMAIL_BLOCK_DEFAULTS[type] ?? {}), ...config },
  }
}

export interface EmailStarter {
  id: string
  name: string
  description: string
  subject: string
  preset_id: string
  blocks: () => EmailBlockDraft[]
}

export const BLANK_TEMPLATE_BLOCKS = (): EmailBlockDraft[] => [
  { id: 'block-1', type: 'text', config: { content: '<p>Bonjour {{prenom}},</p>' } },
  { id: 'footer', type: 'footer', config: { text: '© Mon Coaching' } },
]

export const EMAIL_STARTERS: EmailStarter[] = [
  {
    id: 'newsletter',
    name: 'Newsletter',
    description: 'Rendez-vous mensuel avec tes abonnés : actus, tips, CTA.',
    subject: '{{prenom}}, le récap du mois est arrivé',
    preset_id: 'classique',
    blocks: () => [
      block('header', { title: 'Ta newsletter du mois', alignment: 'center' }),
      block('text', {
        content: '<p>Hello {{prenom}},</p><p>Voici un récap des nouveautés, conseils et opportunités à ne pas manquer ce mois-ci.</p>',
      }),
      block('features_grid', {
        columns: 2,
        items: [
          { icon: '📣', title: 'Nouveauté', description: 'Le programme a évolué — découvre ce qui change.' },
          { icon: '💡', title: 'Tip du mois', description: '3 habitudes simples à mettre en place dès cette semaine.' },
          { icon: '🎙', title: 'Podcast', description: 'Mon dernier épisode sur la procrastination.' },
          { icon: '📆', title: 'Agenda', description: 'Les prochains événements à venir.' },
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
    subject: '{{prenom}}, -30% ce week-end seulement',
    preset_id: 'impact',
    blocks: () => [
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
          { icon: '⚡', title: 'Résultats rapides', description: 'Dès la première semaine.' },
          { icon: '🎯', title: 'Sur-mesure', description: 'Un programme adapté à ton profil.' },
          { icon: '🤝', title: 'Accompagnement', description: 'Je suis là à chaque étape.' },
        ],
      }),
      block('cta_banner', { text: "Dernier appel : -30% jusqu'à dimanche minuit", ctaText: 'Rejoindre maintenant', ctaUrl: 'https://' }),
      block('footer', { text: "Promotion valable jusqu'au dimanche 23h59." }),
    ],
  },
  {
    id: 'welcome',
    name: 'Bienvenue',
    description: 'Premier email après inscription : accueil chaleureux + next steps.',
    subject: 'Bienvenue {{prenom}} 👋',
    preset_id: 'foret',
    blocks: () => [
      block('hero', {
        title: 'Bienvenue {{prenom}} !',
        subtitle: 'Merci de nous rejoindre. Voici comment bien démarrer.',
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
          { icon: '1️⃣', title: 'Complète ton profil', description: 'Ça prend 2 minutes.' },
          { icon: '2️⃣', title: 'Regarde la vidéo', description: "15 min d'introduction." },
          { icon: '3️⃣', title: 'Réserve ton appel', description: 'On fait le point ensemble.' },
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
    blocks: () => [
      block('header', { title: 'Rendez-vous confirmé', alignment: 'center' }),
      block('text', {
        content: '<p>Bonjour {{prenom}},</p><p>Ton rendez-vous avec <strong>{{nom_coach}}</strong> est bien confirmé.</p>',
      }),
      block('quote', {
        text: 'Prépare-toi à faire un vrai bilan : objectifs, blocages actuels, ce que tu veux atteindre dans les 3 prochains mois.',
      }),
      block('button', { text: 'Ajouter à mon agenda', url: 'https://', alignment: 'center' }),
      block('text', { content: "<p>Tu as des questions d'ici là ? Réponds simplement à cet email.</p>" }),
      block('footer', { text: 'Un imprévu ? Tu peux replanifier via le lien dans ton espace.' }),
    ],
  },
  {
    id: 'relance',
    name: 'Relance lead inactif',
    description: "Réveille un lead qui ne t'a pas répondu depuis plusieurs jours.",
    subject: 'Toujours là {{prenom}} ?',
    preset_id: 'ocean',
    blocks: () => [
      block('header', { title: 'Tu nous manques 👋', alignment: 'center' }),
      block('text', {
        content:
          "<p>Hello {{prenom}},</p><p>On ne s'est pas parlé depuis un moment. Est-ce que tu es toujours motivé pour avancer sur tes objectifs ?</p>",
      }),
      block('quote', {
        text: "Les meilleurs résultats arrivent quand on arrête de repousser. Un simple appel de 15 min peut tout changer.",
      }),
      block('button', { text: 'Réserver un appel rapide', url: 'https://', alignment: 'center' }),
      block('footer', { text: "Si tu n'es plus intéressé, tu peux ignorer ce message." }),
    ],
  },
  {
    id: 'testimonial_highlight',
    name: 'Témoignage client',
    description: 'Met en avant une réussite client avec photo + citation + CTA.',
    subject: 'Comment {{prenom}} a atteint son objectif en 3 mois',
    preset_id: 'violet',
    blocks: () => [
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
      block('cta_banner', { text: "Et si c'était ton tour ?", ctaText: 'Réserver mon appel', ctaUrl: 'https://' }),
      block('footer', { text: 'Tu as des questions ? Réponds directement à cet email.' }),
    ],
  },
]

// ─── Broadcast filter options (web BroadcastFilterBuilder) ──────────────────

export const BROADCAST_STATUSES = [
  { value: 'nouveau', label: 'Nouveau' },
  { value: 'scripte', label: 'Scripté' },
  { value: 'setting_planifie', label: 'Setting planifié' },
  { value: 'no_show_setting', label: 'No-show setting' },
  { value: 'closing_planifie', label: 'Closing planifié' },
  { value: 'no_show_closing', label: 'No-show closing' },
  { value: 'clos', label: 'Closé' },
  { value: 'dead', label: 'Dead' },
] as const

export const BROADCAST_SOURCES = [
  { value: 'facebook_ads', label: 'Facebook Ads' },
  { value: 'instagram_ads', label: 'Instagram Ads' },
  { value: 'follow_ads', label: 'Follow Ads' },
  { value: 'formulaire', label: 'Formulaire' },
  { value: 'manuel', label: 'Manuel' },
] as const

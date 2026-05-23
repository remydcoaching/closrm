export interface SprintWeek {
  id: string
  slug: string
  title: string
  start_date: string
  end_date: string
  created_at: string
}

export interface SprintDayKpi {
  id: string
  sprint_id: string
  date: string
  ca_close: number
  calls_booked: number
  calls_done: number
  dms_sent: number
  reels_published: number
  leads_ads: number
  cpl: number
  notes: string
  updated_at: string
  focus_theme: string | null
  focus_emoji: string | null
  focus_description: string | null
  schedule_blocks: DayScheduleBlock[] | null
}

export interface DayScheduleBlock {
  start: string
  end: string
  label: string
  sublabel?: string
  color: string
}

export interface SprintDayConfig {
  date: string
  label: string
  shortLabel: string
  focusTheme: string
  focusEmoji: string
  focusDescription: string
}

export const SPRINT_DAYS: SprintDayConfig[] = [
  {
    date: '2026-06-01',
    label: 'Lundi 1 Juin',
    shortLabel: 'Lun',
    focusTheme: 'Setup Pubs Meta',
    focusEmoji: '🚀',
    focusDescription: 'Créer / relancer les campagnes Facebook & Instagram. Audiences, budgets, créas. Pubs live avant 10h30.',
  },
  {
    date: '2026-06-02',
    label: 'Mardi 2 Juin',
    shortLabel: 'Mar',
    focusTheme: 'Outreach & DMs',
    focusEmoji: '📩',
    focusDescription: 'Outreach ciblé sur Instagram / Facebook. Réponses à tous les messages. Objectif : 20+ conversations ouvertes.',
  },
  {
    date: '2026-06-03',
    label: 'Mercredi 3 Juin',
    shortLabel: 'Mer',
    focusTheme: 'Closing',
    focusEmoji: '💰',
    focusDescription: 'Revoir / affiner le script de closing. Préparer les arguments contre objections. Vérifier l\'offre : prix, bonuses, urgence.',
  },
  {
    date: '2026-06-04',
    label: 'Jeudi 4 Juin',
    shortLabel: 'Jeu',
    focusTheme: 'Batch Contenu',
    focusEmoji: '🎬',
    focusDescription: 'Filmer maximum de reels en une session. Objectif : 3-5 vidéos avant 10h30. Thèmes préparés la veille.',
  },
  {
    date: '2026-06-05',
    label: 'Vendredi 5 Juin',
    shortLabel: 'Ven',
    focusTheme: 'Systèmes',
    focusEmoji: '⚙️',
    focusDescription: 'Mettre à jour le suivi leads dans ClosRM. Configurer follow-ups automatiques. Optimiser les pubs (ROAS, CPL).',
  },
  {
    date: '2026-06-06',
    label: 'Samedi 6 Juin',
    shortLabel: 'Sam',
    focusTheme: 'Review & Bilan',
    focusEmoji: '📊',
    focusDescription: 'CA généré, calls bookés/closés, stats pubs. Ce qui a marché, ce qui n\'a pas marché. Plan semaine suivante.',
  },
]

export const DAY_BLOCKS: DayScheduleBlock[] = [
  { start: '09:00', end: '10:30', label: 'SESSION FOCUS', sublabel: 'Thème du jour', color: '#E53E3E' },
  { start: '10:30', end: '12:00', label: 'TRAINING', color: '#D69E2E' },
  { start: '12:00', end: '13:30', label: 'DÉJEUNER', color: '#4A5568' },
  { start: '13:30', end: '17:00', label: 'VENTES', sublabel: 'Calls · DMs · Closing · Follow-ups', color: '#38A169' },
  { start: '17:00', end: '19:30', label: 'CONTENU', sublabel: 'Tournage · Montage · Publication', color: '#3B82F6' },
  { start: '19:30', end: '21:00', label: 'CLOSRM + REVIEW', sublabel: '1h dev max · Bilan journée KPIs', color: '#6B7280' },
]

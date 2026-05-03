/**
 * Centralized definition of grouped pages — used by both the sidebar
 * (to know which top-level entry leads to which default tab) and the
 * PageTabs component on each page (to render the tab bar).
 */

export interface TabGroup {
  /** Unique key for the group */
  key: string
  /** Top-level label shown in the sidebar */
  label: string
  /** Tabs in display order */
  tabs: { label: string; href: string }[]
}

export const TAB_GROUPS: Record<string, TabGroup> = {
  agenda: {
    key: 'agenda',
    label: 'Agenda',
    tabs: [
      { label: 'Vue calendrier', href: '/agenda' },
      { label: 'Pages de réservation', href: '/parametres/calendriers' },
    ],
  },
  leads: {
    key: 'leads',
    label: 'Leads',
    tabs: [
      { label: 'Pipeline', href: '/leads' },
      { label: 'Closing', href: '/closing' },
      { label: 'Relances', href: '/follow-ups' },
      { label: 'Base de données', href: '/base-de-donnees' },
    ],
  },
  analyse: {
    key: 'analyse',
    label: 'Statistiques',
    tabs: [
      { label: 'Stats', href: '/statistiques' },
      { label: 'Finance', href: '/finance' },
    ],
  },
  equipe: {
    key: 'equipe',
    label: 'Équipe',
    tabs: [
      { label: 'Membres', href: '/parametres/equipe' },
      { label: 'Chat', href: '/equipe/messages' },
    ],
  },
  parametres: {
    key: 'parametres',
    label: 'Paramètres',
    tabs: [
      { label: 'Compte', href: '/parametres/reglages' },
      { label: 'Intégrations', href: '/parametres/integrations' },
      { label: 'Assistant IA', href: '/parametres/assistant-ia' },
    ],
  },
}

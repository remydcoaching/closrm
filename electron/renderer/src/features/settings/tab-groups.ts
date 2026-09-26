// Tab groups to declare in app/tab-groups.ts (same shape as TabGroup).
export const SETTINGS_TAB_GROUPS = {
  parametres: {
    key: 'parametres',
    tabs: [
      { label: 'Compte', to: '/parametres/reglages' },
      { label: 'Intégrations', to: '/parametres/integrations' },
      { label: 'Assistant IA', to: '/parametres/assistant-ia' },
    ],
  },
  equipe: {
    key: 'equipe',
    tabs: [
      { label: 'Membres', to: '/parametres/equipe' },
      { label: 'Chat', to: '/equipe/messages' },
    ],
  },
}

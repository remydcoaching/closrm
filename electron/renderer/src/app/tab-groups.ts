// Mirror of the web's src/lib/layout/page-tab-groups.ts: one sidebar entry
// per group, and a tab bar on every page of the group to switch sub-views.
// Explicit feedback: Leads, Relances and Closing live on the SAME Leads
// page (tabs), not as separate sidebar entries.
export interface TabGroup {
  key: string
  tabs: { label: string; to: string }[]
}

export const TAB_GROUPS = {
  leads: {
    key: 'leads',
    tabs: [
      { label: 'Leads', to: '/leads' },
      { label: 'Pipeline', to: '/pipeline' },
      { label: 'Closing', to: '/closing' },
      { label: 'Relances', to: '/relances' },
      { label: 'Deals', to: '/deals' },
    ],
  },
  agenda: {
    key: 'agenda',
    tabs: [
      { label: 'Vue calendrier', to: '/agenda' },
      { label: 'Pages de réservation', to: '/agenda/pages' },
    ],
  },
  stats: {
    key: 'stats',
    tabs: [
      { label: 'Stats', to: '/statistiques' },
      { label: 'Finance', to: '/finance' },
    ],
  },
} satisfies Record<string, TabGroup>

/** True when `pathname` belongs to one of the group's tabs (sub-routes included). */
export function groupMatches(group: TabGroup, pathname: string): boolean {
  return group.tabs.some((t) => pathname === t.to || pathname.startsWith(`${t.to}/`))
}

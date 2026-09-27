// Icon-only vertical sidebar — a compact navigation rail, not the visual
// centerpiece of the app. Layout direction referenced from Insyder's own
// compiled UI (narrow floating rounded rail, icon-first, subtle active
// state, tooltip on hover) — no Insyder code, icon asset, or class name is
// reused, every icon here is a fresh inline SVG built for ClosRM's own
// navigation (CLOSRM_DESKTOP_FINAL_VISION.md §7).
import { NavLink, useLocation } from 'react-router-dom'
import './sidebar.css'

interface SidebarItem {
  to: string
  label: string
  icon: React.ReactNode
  disabled?: boolean
  badge?: number
  /** Extra paths that keep this entry highlighted (tab groups). */
  matchPaths?: string[]
}

const DashboardIcon = (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="9" rx="1" />
    <rect x="14" y="3" width="7" height="5" rx="1" />
    <rect x="14" y="12" width="7" height="9" rx="1" />
    <rect x="3" y="16" width="7" height="5" rx="1" />
  </svg>
)

const AgendaIcon = (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </svg>
)

const LeadsIcon = (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
)




const DiscoveryIcon = (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.3-4.3" />
    <circle cx="11" cy="11" r="2.5" fill="currentColor" stroke="none" />
  </svg>
)

const InteractionsIcon = (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
  </svg>
)

const ContentIcon = (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <path d="M21 15l-5-5L5 21" />
  </svg>
)


const AnalyticsIcon = (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3v18h18" />
    <path d="M18.7 8l-5.1 5.1-2.8-2.8L7 14" />
  </svg>
)


const AudienceIcon = (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <circle cx="17" cy="7" r="3" opacity="0.6" />
  </svg>
)


const TeamIcon = (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
    <path d="M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6" />
  </svg>
)

const SocialIcon = (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
  </svg>
)

const SettingsIcon = (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
)

const LeadMagnetIcon = (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
  </svg>
)

const PublicitesIcon = (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 11l18-5v12L3 14v-3z" />
    <path d="M11.6 16.8a2 2 0 0 1-3.2 2.4L6 15" />
  </svg>
)

const FunnelIcon = (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 4h18l-7 8v6l-4 2v-8z" />
  </svg>
)

const MailIcon = (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="m22 6-10 7L2 6" />
  </svg>
)

const ZapIcon = (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
  </svg>
)

const MessagesIcon = (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z" />
  </svg>
)

// CLOSRM_DESKTOP_FINAL_VISION.md §7 navigation. Only Leads is fully wired
// today (Phase D). Everything else is listed for wayfinding per the
// approved navigation shape, disabled until its Phase lands. Badges are
// left undefined (not 0) until a real backend count is wired — an absent
// badge, not a fake "0", is the honest default per the no-fake-data rule.
const NAV_ITEMS: SidebarItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: DashboardIcon },
  { to: '/agenda', label: 'Agenda', icon: AgendaIcon, matchPaths: ['/agenda'] },
  // Pipeline, Closing, Relances and Deals are tabs of the Leads page.
  { to: '/leads', label: 'Leads', icon: LeadsIcon, matchPaths: ['/pipeline', '/closing', '/relances', '/deals', '/instagram/sessions-dm'] },
]

const INSTAGRAM_ITEMS: SidebarItem[] = [
  { to: '/instagram/discovery', label: 'Analyse (ciblage)', icon: DiscoveryIcon },
  { to: '/instagram/interactions', label: 'Interactions', icon: InteractionsIcon },
  { to: '/instagram/content', label: 'Content', icon: ContentIcon },
  { to: '/instagram/audience', label: 'Audience', icon: AudienceIcon, matchPaths: ['/instagram/stories'] },
  { to: '/acquisition/lead-magnets', label: 'Lead Magnets', icon: LeadMagnetIcon },
  { to: '/acquisition/publicites', label: 'Publicités', icon: PublicitesIcon },
  { to: '/acquisition/funnels', label: 'Funnels', icon: FunnelIcon },
  { to: '/acquisition/reseaux-sociaux', label: 'Réseaux sociaux', icon: SocialIcon },
]

const MARKETING_ITEMS: SidebarItem[] = [
  { to: '/acquisition/messages', label: 'Messages', icon: MessagesIcon },
  { to: '/acquisition/emails', label: 'Emails', icon: MailIcon },
  { to: '/acquisition/automations', label: 'Automations', icon: ZapIcon },
]

const ANALYTICS_ITEMS: SidebarItem[] = [{ to: '/statistiques', label: 'Statistiques', icon: AnalyticsIcon, matchPaths: ['/finance'] }]

const SYSTEM_ITEMS: SidebarItem[] = [
  { to: '/parametres/equipe', label: 'Équipe', icon: TeamIcon, matchPaths: ['/equipe'] },
  { to: '/parametres/reglages', label: 'Paramètres', icon: SettingsIcon, matchPaths: ['/parametres/integrations', '/parametres/assistant-ia'] },
]

export function Sidebar() {
  return (
    <nav className="ds-sidebar-rail">
      <div className="ds-sidebar-card ds-sidebar-card--flex">
        <div className="ds-sidebar-brand">
          <div className="ds-sidebar-logo" aria-label="ClosRM">
            {/* Same mark as the app icon (electron/build/icon.png). */}
            <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
              <path d="M19.55 20.05 A6.8 6.8 0 1 1 19.55 9.95" fill="none" stroke="#fff" strokeWidth="3.35" strokeLinecap="round" />
              <circle cx="15" cy="15" r="2.1" fill="#fff" />
            </svg>
          </div>
        </div>

        <div className="ds-sidebar-group">
          {NAV_ITEMS.map((item) => (
            <SidebarButton key={item.to} item={item} />
          ))}
        </div>

        <div className="ds-sidebar-divider" />

        <div className="ds-sidebar-group">
          {INSTAGRAM_ITEMS.map((item) => (
            <SidebarButton key={item.to} item={item} />
          ))}
        </div>

        <div className="ds-sidebar-divider" />

        <div className="ds-sidebar-group">
          {MARKETING_ITEMS.map((item) => (
            <SidebarButton key={item.to} item={item} />
          ))}
        </div>

        <div className="ds-sidebar-divider" />

        <div className="ds-sidebar-group">
          {ANALYTICS_ITEMS.map((item) => (
            <SidebarButton key={item.to} item={item} />
          ))}
        </div>

        <div className="ds-sidebar-divider" />

        <div className="ds-sidebar-group">
          {SYSTEM_ITEMS.map((item) => (
            <SidebarButton key={item.to} item={item} />
          ))}
        </div>
      </div>
    </nav>
  )
}

function SidebarButton({ item }: { item: SidebarItem }) {
  const { pathname } = useLocation()
  const extraMatch = (item.matchPaths ?? []).some((p) => pathname === p || pathname.startsWith(`${p}/`))
  const badge = item.badge && item.badge > 0 ? <span className="ds-sidebar-badge">{item.badge > 9 ? '9+' : item.badge}</span> : null

  if (item.disabled) {
    return (
      <span className="ds-sidebar-item ds-sidebar-item--disabled" title={`${item.label} — bientôt disponible`}>
        {item.icon}
        {badge}
      </span>
    )
  }
  return (
    <NavLink
      to={item.to}
      className={({ isActive }) => `ds-sidebar-item ${isActive || extraMatch ? 'ds-sidebar-item--active' : ''}`}
      title={item.label}
    >
      {item.icon}
      {badge}
    </NavLink>
  )
}

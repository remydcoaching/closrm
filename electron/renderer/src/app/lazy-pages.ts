// Every screen but the dashboard is its own chunk: start-up only parses the
// screen it opens, then preloadPages() (start-up warm-up) loads the others in
// the background so a click never waits for code.
import { lazy, type ComponentType } from 'react'

const loaders: (() => Promise<unknown>)[] = []

function page<M, K extends keyof M>(load: () => Promise<M>, name: K) {
  loaders.push(load)
  return lazy(() => load().then((m) => ({ default: m[name] as unknown as ComponentType })))
}

/** Loads every screen's code (idle, after start-up). */
export function preloadPages(): void {
  for (const load of loaders) void load().catch(() => undefined)
}

export const LeadsListPage = page(() => import('../features/leads/LeadsListPage'), 'LeadsListPage')
export const LeadDetailPage = page(() => import('../features/leads/LeadDetailPage'), 'LeadDetailPage')
export const DiscoveryPage = page(() => import('../features/instagram/DiscoveryPage'), 'DiscoveryPage')
export const CiblageRunPage = page(() => import('../features/instagram/CiblageRunPage'), 'CiblageRunPage')
export const InstagramPersonPage = page(() => import('../features/instagram/InstagramPersonPage'), 'InstagramPersonPage')
export const InstagramLeadsPage = page(() => import('../features/instagram/InstagramLeadsPage'), 'InstagramLeadsPage')
export const ContentPage = page(() => import('../features/instagram/ContentPage'), 'ContentPage')
export const ContentDetailPage = page(() => import('../features/instagram/ContentDetailPage'), 'ContentDetailPage')
export const StoryDetailPage = page(() => import('../features/instagram/StoryDetailPage'), 'StoryDetailPage')
export const AudiencePage = page(() => import('../features/instagram/AudiencePage'), 'AudiencePage')
export const LeadMagnetsPage = page(() => import('../features/acquisition/LeadMagnetsPage'), 'LeadMagnetsPage')
export const PublicitesPage = page(() => import('../features/acquisition/PublicitesPage'), 'PublicitesPage')
export const PipelinePage = page(() => import('../features/crm/PipelinePage'), 'PipelinePage')
export const RelancesPage = page(() => import('../features/crm/RelancesPage'), 'RelancesPage')
export const DealsPage = page(() => import('../features/crm/DealsPage'), 'DealsPage')
export const ClosingPage = page(() => import('../features/crm/ClosingPage'), 'ClosingPage')
export const SocialPage = page(() => import('../features/social/SocialPage'), 'SocialPage')
export const SettingsAccountPage = page(() => import('../features/settings/SettingsAccountPage'), 'SettingsAccountPage')
export const IntegrationsPage = page(() => import('../features/settings/IntegrationsPage'), 'IntegrationsPage')
export const AiAssistantPage = page(() => import('../features/settings/AiAssistantPage'), 'AiAssistantPage')
export const TeamPage = page(() => import('../features/settings/TeamPage'), 'TeamPage')
export const TeamChatPage = page(() => import('../features/settings/TeamChatPage'), 'TeamChatPage')
export const FunnelsPage = page(() => import('../features/marketing/FunnelsPage'), 'FunnelsPage')
export const EmailsPage = page(() => import('../features/marketing/EmailsPage'), 'EmailsPage')
export const AutomationsPage = page(() => import('../features/marketing/AutomationsPage'), 'AutomationsPage')
export const MessagesPage = page(() => import('../features/marketing/MessagesPage'), 'MessagesPage')
export const AgendaPage = page(() => import('../features/agenda/AgendaPage'), 'AgendaPage')
export const BookingPagesPage = page(() => import('../features/agenda/BookingPagesPage'), 'BookingPagesPage')
export const BookingCalendarEditPage = page(() => import('../features/agenda/BookingCalendarEditPage'), 'BookingCalendarEditPage')
export const StatsPage = page(() => import('../features/stats/StatsPage'), 'StatsPage')
export const FinancePage = page(() => import('../features/stats/FinancePage'), 'FinancePage')

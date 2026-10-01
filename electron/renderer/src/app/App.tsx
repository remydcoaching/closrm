import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from '../lib/auth-context'
import { LoginPage } from '../features/auth/LoginPage'
import { DashboardLayout } from './DashboardLayout'
import { LeadsListPage } from '../features/leads/LeadsListPage'
import { LeadDetailPage } from '../features/leads/LeadDetailPage'
import { DiscoveryPage } from '../features/instagram/DiscoveryPage'
import { CiblageRunPage } from '../features/instagram/CiblageRunPage'
import { InstagramPersonPage } from '../features/instagram/InstagramPersonPage'
import { ContentPage } from '../features/instagram/ContentPage'
import { ContentDetailPage } from '../features/instagram/ContentDetailPage'
import { StoryDetailPage } from '../features/instagram/StoryDetailPage'
import { AudiencePage } from '../features/instagram/AudiencePage'
import { LeadMagnetsPage } from '../features/acquisition/LeadMagnetsPage'
import { PublicitesPage } from '../features/acquisition/PublicitesPage'
import { PipelinePage } from '../features/crm/PipelinePage'
import { RelancesPage } from '../features/crm/RelancesPage'
import { DealsPage } from '../features/crm/DealsPage'
import { ClosingPage } from '../features/crm/ClosingPage'
import { DashboardPage } from '../features/dashboard/DashboardPage'
import { SocialPage } from '../features/social/SocialPage'
import { SettingsAccountPage } from '../features/settings/SettingsAccountPage'
import { IntegrationsPage } from '../features/settings/IntegrationsPage'
import { AiAssistantPage } from '../features/settings/AiAssistantPage'
import { TeamPage } from '../features/settings/TeamPage'
import { TeamChatPage } from '../features/settings/TeamChatPage'
import { FunnelsPage } from '../features/marketing/FunnelsPage'
import { EmailsPage } from '../features/marketing/EmailsPage'
import { AutomationsPage } from '../features/marketing/AutomationsPage'
import { MessagesPage } from '../features/marketing/MessagesPage'
import { AgendaPage } from '../features/agenda/AgendaPage'
import { BookingPagesPage } from '../features/agenda/BookingPagesPage'
import { BookingCalendarEditPage } from '../features/agenda/BookingCalendarEditPage'
import { StatsPage } from '../features/stats/StatsPage'
import { FinancePage } from '../features/stats/FinancePage'
import { TabGroupLayout } from '../design-system/PageTabs'
import { TAB_GROUPS } from './tab-groups'
import { LoadingState } from '../design-system/States'

function RequireAuth({ children }: { children: React.ReactElement }) {
  const { session, loading } = useAuth()
  if (loading) return <LoadingState label="Vérification de la session…" />
  if (!session) return <Navigate to="/login" replace />
  return children
}

// Mirror of RequireAuth for /login: without this, a user who already has a
// restored session (e.g. app relaunched, Keychain session still valid) stays
// stuck on the login screen — submitting the form succeeds against Supabase
// but nothing ever navigates away from /login, so clicking "Se connecter"
// visibly does nothing.
function RedirectIfAuthed({ children }: { children: React.ReactElement }) {
  const { session, loading } = useAuth()
  if (loading) return <LoadingState label="Vérification de la session…" />
  if (session) return <Navigate to="/" replace />
  return children
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <RedirectIfAuthed>
            <LoginPage />
          </RedirectIfAuthed>
        }
      />
      <Route
        path="/"
        element={
          <RequireAuth>
            <DashboardLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route element={<TabGroupLayout group={TAB_GROUPS.agenda} />}>
          <Route path="agenda" element={<AgendaPage />} />
          <Route path="agenda/pages" element={<BookingPagesPage />} />
        </Route>
        <Route path="agenda/pages/:id" element={<BookingCalendarEditPage />} />
        <Route element={<TabGroupLayout group={TAB_GROUPS.stats} />}>
          <Route path="statistiques" element={<StatsPage />} />
          <Route path="finance" element={<FinancePage />} />
        </Route>
        {/* Clicking a lead navigates to its own dedicated page (/leads/:id)
            rather than opening a docked side panel — explicit feedback:
            "quand tu cliques sur un lead, ça t'affiche le lead, ça
            t'affiche une page du lead entier". */}
        {/* Leads, Pipeline, Closing, Relances, Deals = one Leads page with
            tabs (explicit feedback, mirrors the web's page-tab-groups). */}
        <Route element={<TabGroupLayout group={TAB_GROUPS.leads} />}>
          <Route path="leads" element={<LeadsListPage />} />
          <Route path="pipeline" element={<PipelinePage />} />
          <Route path="closing" element={<ClosingPage />} />
          <Route path="relances" element={<RelancesPage />} />
          <Route path="deals" element={<DealsPage />} />
        </Route>
        <Route path="leads/:id" element={<LeadDetailPage />} />
        <Route path="instagram/discovery" element={<DiscoveryPage />} />
        <Route path="instagram/discovery/:runId" element={<CiblageRunPage />} />
        <Route path="instagram/interactions" element={<Navigate to="/instagram/audience" replace />} />
        <Route path="instagram/content" element={<ContentPage />} />
        <Route path="instagram/content/:contentId" element={<ContentDetailPage />} />
        <Route path="instagram/audience" element={<AudiencePage />} />
        <Route path="instagram/stories" element={<Navigate to="/instagram/audience" replace />} />
        <Route path="instagram/stories/:pk" element={<StoryDetailPage />} />
        <Route path="instagram/people/:username" element={<InstagramPersonPage />} />
        {/* Sessions DM now lives in Leads › Relances. */}
        <Route path="instagram/sessions-dm" element={<Navigate to="/relances?vue=sessions-dm" replace />} />
        <Route path="acquisition/lead-magnets" element={<LeadMagnetsPage />} />
        <Route path="acquisition/publicites" element={<PublicitesPage />} />
        <Route path="acquisition/funnels" element={<FunnelsPage />} />
        <Route path="acquisition/reseaux-sociaux" element={<SocialPage />} />
        <Route element={<TabGroupLayout group={TAB_GROUPS.parametres} />}>
          <Route path="parametres/reglages" element={<SettingsAccountPage />} />
          <Route path="parametres/integrations" element={<IntegrationsPage />} />
          <Route path="parametres/assistant-ia" element={<AiAssistantPage />} />
        </Route>
        <Route element={<TabGroupLayout group={TAB_GROUPS.equipe} />}>
          <Route path="parametres/equipe" element={<TeamPage />} />
          <Route path="equipe/messages" element={<TeamChatPage />} />
        </Route>
        <Route path="acquisition/emails" element={<EmailsPage />} />
        <Route path="acquisition/automations" element={<AutomationsPage />} />
        <Route path="acquisition/messages" element={<MessagesPage />} />
      </Route>
    </Routes>
  )
}

export function App() {
  return (
    <AuthProvider>
      {/* HashRouter: the renderer is loaded from a local file:// / dev-server
          origin, not a real path-based server — history routing would break
          on refresh/reload in that context. */}
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    </AuthProvider>
  )
}

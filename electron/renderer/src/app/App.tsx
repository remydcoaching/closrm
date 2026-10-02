import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from '../lib/auth-context'
import { LoginPage } from '../features/auth/LoginPage'
import { DashboardLayout } from './DashboardLayout'
import { DashboardPage } from '../features/dashboard/DashboardPage'
import { TabGroupLayout } from '../design-system/PageTabs'
import { TAB_GROUPS } from './tab-groups'
import { LoadingState } from '../design-system/States'
import {
  LeadsListPage,
  LeadDetailPage,
  DiscoveryPage,
  CiblageRunPage,
  InstagramPersonPage,
  InstagramLeadsPage,
  ContentPage,
  ContentDetailPage,
  StoryDetailPage,
  AudiencePage,
  LeadMagnetsPage,
  PublicitesPage,
  PipelinePage,
  RelancesPage,
  DealsPage,
  ClosingPage,
  SocialPage,
  SettingsAccountPage,
  IntegrationsPage,
  AiAssistantPage,
  TeamPage,
  TeamChatPage,
  FunnelsPage,
  EmailsPage,
  AutomationsPage,
  MessagesPage,
  AgendaPage,
  BookingPagesPage,
  BookingCalendarEditPage,
  StatsPage,
  FinancePage,
} from './lazy-pages'

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
        <Route path="instagram/leads" element={<InstagramLeadsPage />} />
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

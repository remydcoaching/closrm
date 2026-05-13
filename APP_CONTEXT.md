# APP_CONTEXT.md — ClosRM

> Contexte applicatif complet pour un LLM chargé de créer la version mobile.
> Généré le 2026-05-06 depuis le codebase web Next.js.

---

## 1. Stack technique

| Couche | Technologie | Version |
|--------|-------------|---------|
| Framework | Next.js (App Router) | 16.2.1 |
| UI | React | 19.2.4 |
| Langage | TypeScript (strict) | ^5 |
| Styling | Tailwind CSS | v4 |
| Composants UI | Radix UI + shadcn/ui | v1.1-2.2.x |
| Icônes | Lucide React | 1.7.0 |
| Charts | Recharts | 3.8.1 |
| Drag & Drop | @dnd-kit | core 6.3.1, sortable 10.0.0 |
| Rich Text | TipTap | 3.21.0 |
| Dates | date-fns (FR locale) | 4.1.0 |
| Validation | Zod | 4.3.6 |
| CSV | PapaParse | 5.5.3 |
| Base de données | Supabase (PostgreSQL + RLS) | supabase-js 2.100.1 |
| Auth | Supabase Auth (cookie-based SSR) | @supabase/ssr 0.9.0 |
| Emails | AWS SES v2 | @aws-sdk 3.1032.0 |
| AI | Anthropic Claude SDK | 0.85.0 |
| Hébergement | Vercel (serverless) | — |

**Path alias :** `@/*` → `./src/*`

---

## 2. Routes & navigation

### Groupes de layout

```
Root Layout (layout.tsx)
├── (auth)/     → pages login/register/reset (centrées, fond gradient)
├── (dashboard)/ → shell avec sidebar + header (auth requise)
├── (public)/   → pages publiques (unsubscribe)
├── book/       → pages de réservation publiques
└── f/          → pages de funnels publiques (SSR)
```

### Routes principales (dashboard)

| URL | Rôle |
|-----|------|
| `/dashboard` | KPIs, calendrier bookings, plan du jour, leads chauds/à risque, funnel |
| `/leads` | Liste paginée des leads (filtres, recherche, tri) |
| `/leads/[id]` | Fiche lead détaillée (onglets infos/messages, calls, deals, notes, magnets) |
| `/leads/import` | Import CSV de leads |
| `/leads/import/history` | Historique des imports |
| `/closing` | Appels closing (tableau + calendrier) |
| `/follow-ups` | Relances planifiées |
| `/statistiques` | Dashboard statistiques avancé |
| `/base-de-donnees` | Vue globale contacts, export CSV |
| `/agenda` | Calendrier global (v2 disponible) |
| `/agenda/templates` | Templates de planning hebdo |
| `/agenda/templates/[id]` | Éditeur de template |
| `/acquisition/emails` | Hub email (templates, séquences, broadcasts) |
| `/acquisition/emails/templates/[id]` | Builder email (TipTap) |
| `/acquisition/emails/sequences/[id]` | Éditeur séquence (timeline steps) |
| `/acquisition/emails/broadcasts/new` | Composer broadcast |
| `/acquisition/funnels` | Liste funnels |
| `/acquisition/funnels/[id]` | Builder funnel v2 (preview desktop/tablet/mobile, undo/redo, autosave) |
| `/acquisition/automations` | Liste workflows |
| `/acquisition/automations/[id]` | Éditeur workflow (triggers/actions/conditions/delays) |
| `/acquisition/lead-magnets` | Lead magnets |
| `/acquisition/messages` | Messages Instagram DM |
| `/acquisition/publicites` | Dashboard Meta Ads |
| `/acquisition/reseaux-sociaux` | Gestion social multi-plateforme (production pipeline) |
| `/montage` | Board montage vidéo (Kanban, assignation monteur) |
| `/equipe/formation` | Modules de formation équipe |
| `/equipe/messages` | Messagerie interne |
| `/finance` | Vue financière (revenus, commissions) |
| `/parametres/reglages` | Profil, workspace, branding, labels, plan |
| `/parametres/calendriers` | Calendriers de booking |
| `/parametres/calendriers/[id]` | Config dispo, champs formulaire, rappels |
| `/parametres/equipe` | Gestion membres |
| `/parametres/integrations` | Intégrations tierces |
| `/parametres/assistant-ia` | Config assistant IA |

### Routes publiques (sans auth)

| URL | Rôle |
|-----|------|
| `/book/[workspaceSlug]/[calendarSlug]` | Page de réservation publique (calendrier + formulaire) |
| `/book/.../confirmation` | Confirmation de booking |
| `/booking/manage/[id]` | Gestion booking par token (reschedule/cancel) |
| `/f/[workspaceSlug]/[funnelSlug]/[pageSlug]` | Page funnel publique (SSR, SEO) |
| `/unsubscribe` | Désinscription email |

---

## 3. Modèles de données & types TypeScript principaux

> Fichier source : `src/types/index.ts` (1653 lignes) + `src/types/agenda.ts`, `src/types/billing.ts`, `src/types/pm.ts`

### Entités CRM core

```typescript
// Lead — entité centrale du CRM
type LeadStatus = 'nouveau' | 'scripte' | 'setting_planifie' | 'no_show_setting' 
  | 'closing_planifie' | 'no_show_closing' | 'clos' | 'dead'
type LeadSource = 'facebook_ads' | 'instagram_ads' | 'follow_ads' | 'formulaire' | 'manuel' | 'funnel'

interface Lead {
  id: string; workspace_id: string;
  first_name: string; last_name: string; phone: string; email: string;
  status: LeadStatus; source: LeadSource; tags: string[];
  call_attempts: number; reached: boolean; notes: string;
  instagram_handle?: string; email_unsubscribed: boolean;
  deal_amount?: number; deal_installments?: number; cash_collected?: number;
  closed_at?: string; assigned_to?: string;
  meta_campaign_id?: string; meta_adset_id?: string; meta_ad_id?: string;
  created_at: string; updated_at: string;
}

// Call
type CallType = 'setting' | 'closing'
type CallOutcome = 'pending' | 'done' | 'cancelled' | 'no_show'
interface Call {
  id: string; lead_id: string; type: CallType;
  scheduled_at: string; outcome: CallOutcome;
  notes: string; attempt_number: number; reached: boolean;
  duration_seconds?: number; closer_id?: string; assigned_to?: string;
  handoff_brief?: HandoffBrief;
}

// Follow-up
type FollowUpChannel = 'whatsapp' | 'email' | 'instagram_dm' | 'manuel'
type FollowUpStatus = 'en_attente' | 'fait' | 'annule'
interface FollowUp {
  id: string; lead_id: string; reason: string;
  scheduled_at: string; channel: FollowUpChannel; status: FollowUpStatus;
}

// Deal
type DealStatus = 'active' | 'completed' | 'churned' | 'refunded'
interface Deal {
  id: string; lead_id: string; setter_id?: string; closer_id?: string;
  amount: number; cash_collected: number; installments: number;
  duration_months?: number; started_at: string; ends_at?: string; status: DealStatus;
}
```

### Booking & Agenda

```typescript
type BookingStatus = 'confirmed' | 'cancelled' | 'no_show' | 'completed'
type BookingSource = 'booking_page' | 'manual' | 'google_sync'
interface Booking {
  id: string; calendar_id: string; lead_id?: string; call_id?: string;
  scheduled_at: string; duration_minutes: number;
  form_data: Record<string, string>; location_id?: string;
  meet_url?: string; status: BookingStatus; source: BookingSource;
}

type AgendaEventKind = 'booking' | 'call'
// Union discriminée AgendaBookingEvent | AgendaCallEvent
```

### Workflows / Automations

```typescript
type WorkflowStatus = 'brouillon' | 'actif' | 'inactif'
type WorkflowTriggerType = 'new_lead' | 'lead_imported' | 'lead_status_changed' 
  | 'tag_added' | 'tag_removed' | 'deal_won' | 'call_scheduled' | 'call_in_x_hours'
  | 'call_no_show' | 'booking_created' | 'booking_cancelled' | 'booking_no_show'
  | 'booking_completed' | /* ... 19+ triggers */
type WorkflowActionType = 'send_email' | 'send_whatsapp' | 'send_dm_instagram' 
  | 'create_followup' | 'change_lead_status' | 'add_tag' | 'remove_tag'
  | 'send_notification' | 'facebook_conversions_api' | 'enroll_in_sequence'
  | /* ... 17+ actions */
type WorkflowStepType = 'action' | 'delay' | 'condition' | 'wait_for_event'
```

### Email & Social

```typescript
// Email
type EmailBroadcastStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed'
type EmailSendStatus = 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'complained'
interface EmailTemplate { id: string; subject: string; blocks: EmailBlock[]; preset_id?: string; }
interface EmailBroadcast { id: string; template_id?: string; subject: string; filters: EmailBroadcastFilters; }

// Social multi-plateforme
type SocialPlatform = 'instagram' | 'youtube' | 'tiktok'
type SocialPostStatus = 'draft' | 'scheduled' | 'publishing' | 'published' | 'partial' | 'failed'
type SocialProductionStatus = 'idea' | 'to_film' | 'filmed' | 'edited' | 'ready'
interface SocialPost {
  id: string; title: string; caption: string; hashtags: string[];
  media_urls: string[]; status: SocialPostStatus;
  production_status: SocialProductionStatus;
  monteur_id?: string; rush_url?: string; final_url?: string;
}
```

### Funnels

```typescript
type FunnelStatus = 'draft' | 'published'
type FunnelBlockType = 'hero' | 'video' | 'testimonials' | 'form' | 'booking' 
  | 'pricing' | 'faq' | 'countdown' | 'cta' | 'text' | 'image' | 'spacer' | 'footer'
interface Funnel { id: string; name: string; slug: string; status: FunnelStatus; preset_id?: string; }
interface FunnelPage { id: string; funnel_id: string; blocks: FunnelBlock[]; seo_title?: string; }
```

### Billing

```typescript
type PlanId = 'trial' | 'starter' | 'pro' | 'scale' | 'internal'
type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'canceled' | 'suspended' | 'internal'
interface WorkspaceBilling {
  plan_id: PlanId; subscription_status: SubscriptionStatus;
  trial_ends_at?: string; wallet_balance_cents: number;
}
```

### Workspace & Rôles

```typescript
type WorkspaceRole = 'admin' | 'setter' | 'closer' | 'monteur'
type MemberStatus = 'active' | 'invited' | 'suspended'
interface WorkspaceMember {
  id: string; workspace_id: string; user_id: string;
  role: WorkspaceRole; status: MemberStatus; permissions: Record<string, boolean>;
}
```

### Validation (Zod — 18 fichiers dans `src/lib/validations/`)

Chaque entité a ses schemas Zod (`createLeadSchema`, `updateCallSchema`, `bookingFiltersSchema`, etc.) avec types inférés. Tous les endpoints valident les payloads via ces schemas.

---

## 4. Endpoints API (méthode, URL, structure réponse)

### Pattern de réponse standard

```typescript
// Succès
{ data: T }
{ data: T[], meta: { total: number, page: number, per_page: number, total_pages: number } }

// Erreur
{ error: string }  // 400, 401, 404, 500
```

### Authentification & contexte

| Méthode | URL | Réponse |
|---------|-----|---------|
| GET | `/api/auth/me` | `{ data: { userId, workspaceId, role } }` |

### CRM Core

| Méthode | URL | Réponse / Notes |
|---------|-----|-----------------|
| GET | `/api/leads?search=&status=&source=&tags=&page=&per_page=` | Leads paginés. Filtrage par rôle (setter voit les siens + non-assignés). |
| POST | `/api/leads` | Crée lead. Side-effects : link IG, fire workflow triggers. |
| GET | `/api/leads/[id]` | Lead complet |
| PATCH | `/api/leads/[id]` | Update partiel |
| DELETE | `/api/leads/[id]` | Suppression |
| GET | `/api/leads/grouped` | Leads groupés par statut/source |
| GET | `/api/contacts?...` | Vue contacts unifiée (mêmes filtres que leads) |
| GET/POST | `/api/calls` | CRUD appels |
| GET/PATCH | `/api/calls/[id]` | |
| GET/POST | `/api/follow-ups` | CRUD relances |
| GET/PATCH | `/api/follow-ups/[id]` | |
| GET/POST | `/api/deals` | CRUD deals |
| PATCH | `/api/deals/[id]` | |

### Bookings

| Méthode | URL | Réponse / Notes |
|---------|-----|-----------------|
| GET/POST | `/api/booking-calendars` | Calendriers de booking |
| GET/PATCH | `/api/booking-calendars/[id]` | Config disponibilités, champs, rappels |
| GET/POST | `/api/booking-locations` | Lieux de RDV |
| GET/POST | `/api/bookings` | CRUD bookings |
| GET/PATCH | `/api/bookings/[id]` | |
| GET | `/api/calendars/[id]/reminders-log` | Log rappels envoyés |

### Emails

| Méthode | URL | Réponse / Notes |
|---------|-----|-----------------|
| GET/POST | `/api/emails/templates` | Templates email |
| GET/POST | `/api/emails/templates/[id]` | |
| POST | `/api/emails/templates/preview` | Rendu preview |
| GET/POST | `/api/emails/broadcasts` | Campagnes email |
| POST | `/api/emails/broadcasts/[id]/send` | Envoi immédiat |
| GET | `/api/emails/broadcasts/[id]/stats` | Stats delivery/open/click |
| GET/POST | `/api/emails/sequences` | Séquences auto |
| POST | `/api/emails/sequences/[id]/enroll` | Inscrire contacts |
| GET/POST | `/api/emails/domains` | Domaines custom |
| GET | `/api/emails/stats` | Métriques globales |

### Workflows

| Méthode | URL | Réponse / Notes |
|---------|-----|-----------------|
| GET/POST | `/api/workflows` | CRUD workflows |
| GET/PATCH | `/api/workflows/[id]` | |
| POST | `/api/workflows/[id]/activate` | Activer |
| POST | `/api/workflows/[id]/deactivate` | Désactiver |
| POST | `/api/workflows/[id]/dry-run` | Test sans exécution |
| GET | `/api/workflows/[id]/executions` | Historique |
| GET/POST | `/api/workflows/[id]/steps` | Steps du workflow |
| GET | `/api/workflows/templates` | Templates pré-construits |

### Instagram & Social

| Méthode | URL | Réponse / Notes |
|---------|-----|-----------------|
| GET | `/api/instagram/account` | Compte connecté |
| GET/POST | `/api/instagram/messages` | Messages DM |
| POST | `/api/instagram/messages/send` | `{ conversation_id, text }` |
| GET/POST | `/api/instagram/conversations` | Conversations DM |
| GET/POST | `/api/instagram/comments` | Commentaires |
| POST | `/api/instagram/comments/sync` | Sync manuelle |
| GET/POST | `/api/instagram/drafts` | Brouillons/planifiés |
| POST | `/api/instagram/drafts/[id]/publish` | Publier |
| GET/POST | `/api/social/posts` | Posts multi-plateforme |
| POST | `/api/social/posts/[id]/publish` | Publier maintenant |
| POST | `/api/social/generate-caption` | Génération IA |
| POST | `/api/social/generate-hooks` | Hooks IA |
| POST | `/api/social/generate-script` | Script vidéo IA |

### Meta Ads

| Méthode | URL | Réponse / Notes |
|---------|-----|-----------------|
| POST | `/api/integrations/meta` | Connecter |
| GET | `/api/integrations/meta/callback` | OAuth callback |
| POST | `/api/integrations/meta/disconnect` | Déconnecter |
| GET | `/api/meta/ad-performance` | Perf campagne/adset/ad |
| GET | `/api/meta/ad-attribution` | Attribution leads→ads |
| GET | `/api/meta/insights` | Insights compte |

### Intégrations

| Méthode | URL | Réponse / Notes |
|---------|-----|-----------------|
| POST | `/api/integrations/google/authorize` | OAuth Google Calendar |
| GET | `/api/integrations/google/callback` | Callback OAuth |
| POST | `/api/integrations/google/sync` | Sync manuelle |
| POST | `/api/integrations/youtube/authorize` | OAuth YouTube |
| GET/POST | `/api/integrations` | Liste/ajout intégrations |

### Dashboard & Finance

| Méthode | URL | Réponse / Notes |
|---------|-----|-----------------|
| GET | `/api/dashboard/brief` | KPIs résumé |
| GET | `/api/performance/crm-funnel` | Métriques pipeline |
| GET | `/api/finance/overview` | Revenus |
| GET | `/api/finance/team` | Commissions équipe |

### Funnels

| Méthode | URL | Réponse / Notes |
|---------|-----|-----------------|
| GET/POST | `/api/funnels` | CRUD funnels |
| GET/PATCH | `/api/funnels/[id]` | |
| GET/POST | `/api/funnels/[id]/pages` | Pages du funnel |
| POST | `/api/funnels/[id]/publish` | Publier |
| GET | `/api/funnels/[id]/stats` | Stats conversion |

### IA

| Méthode | URL | Réponse / Notes |
|---------|-----|-----------------|
| GET/POST | `/api/ai/brief` | Config IA du workspace |
| POST | `/api/ai/suggest` | Suggestions IA contextuelles |
| POST | `/api/ai/learn` | Entraînement custom |

### Webhooks entrants

| Méthode | URL | Réponse / Notes |
|---------|-----|-----------------|
| POST | `/api/webhooks/instagram` | Messages/commentaires IG (signature HMAC) |
| POST | `/api/webhooks/meta` | Leads Facebook Ads |
| POST | `/api/webhooks/ses` | Bounces/complaints AWS SES |

### Public (sans auth)

| Méthode | URL | Réponse / Notes |
|---------|-----|-----------------|
| POST | `/api/public/f/submit` | Soumission formulaire funnel → upsert lead |
| GET | `/api/public/booking/[calendarId]` | Disponibilités calendrier |
| POST | `/api/public/bookings/[id]/cancel` | Annulation par token |

### Crons (Vercel, auth par CRON_SECRET)

| URL | Fréquence | Rôle |
|-----|-----------|------|
| `/api/cron/booking-reminders` | Chaque minute | Envoyer rappels RDV (email/WhatsApp/IG DM) |
| `/api/cron/workflow-scheduler` | 8h quotidien | Exécuter workflows planifiés |
| `/api/cron/scheduled-posts` | — | Publier posts programmés |
| `/api/cron/instagram-sync` | 3h30 quotidien | Sync Instagram |
| `/api/cron/youtube-sync` | 3h30 quotidien | Sync YouTube |

---

## 5. Les 10+ composants les plus réutilisés

| # | Composant | Fichier | Rôle | Props clés |
|---|-----------|---------|------|------------|
| 1 | **Toast** | `components/ui/Toast.tsx` | Notifications globales (success/error/info) | Via hook `useToast()` |
| 2 | **LeadSidePanel** | `components/shared/LeadSidePanel.tsx` | Panel détail lead (onglets infos/messages, calls, deals, notes, magnets) | `leadId`, `onClose` |
| 3 | **ConfirmModal** | `components/shared/ConfirmModal.tsx` | Dialog de confirmation générique | `title`, `message`, `onConfirm`, `onCancel`, `confirmDanger` |
| 4 | **StatusBadge** | `components/leads/StatusBadge.tsx` | Badge statut lead (couleurs config workspace) | `status: LeadStatus` |
| 5 | **SourceBadge** | `components/leads/SourceBadge.tsx` | Badge source lead (couleurs config workspace) | `source: LeadSource` |
| 6 | **MemberAssignDropdown** | `components/shared/MemberAssignDropdown.tsx` | Dropdown assignation membre équipe | `assignedTo`, `members`, `onAssign`, `compact` |
| 7 | **CallScheduleModal** | `components/leads/CallScheduleModal.tsx` | Planifier un call setting/closing avec handoff brief | `lead`, `onClose`, `onScheduled` |
| 8 | **MessageInput** | `components/messages/MessageInput.tsx` | Textarea avec speech recognition + upload image | `onSend`, `onSendImage`, `disabled` |
| 9 | **ConversationThread** | `components/messages/ConversationThread.tsx` | Affichage thread de conversation IG DM | `messages: IgMessage[]` |
| 10 | **LeadActionModal** | `components/leads/LeadActionModal.tsx` | Modal multi-mode (reschedule/won/dead) | `lead`, `onClose`, `onAction` |
| 11 | **LeadMagnetsWidget** | `components/leads/LeadMagnetsWidget.tsx` | Widget lead magnets avec tracking | `leadId` |
| 12 | **LeadDealsWidget** | `components/leads/LeadDealsWidget.tsx` | Gestion deals du lead | `leadId` |

---

## 6. State management

### Architecture : React Context + hooks (pas de Redux/Zustand)

#### Providers globaux

| Provider | Fichier | Scope | Hook |
|----------|---------|-------|------|
| **ToastProvider** | `components/ui/Toast.tsx` | Root layout — notifications | `useToast()` → `{ toast, success, error, info }` |
| **ThemeProvider** | `components/theme/ThemeProvider.tsx` | Root layout — light/dark | `useTheme()` → `{ theme, setTheme }` (localStorage) |
| **WorkspaceConfigProvider** | `lib/workspace/config-context.tsx` | Dashboard layout — config statuts/sources | `useStatusConfig()`, `useSourceConfig()`, `useStatusEntry(key)`, `useSourceEntry(key)` |
| **FunnelRenderProvider** | `components/funnels/FunnelRenderContext.tsx` | Pages funnel — mode preview/public | `useFunnelRender()` → `{ isPreview, funnelPageId }` |

#### Hooks custom

| Hook | Fichier | Rôle |
|------|---------|------|
| `useUser()` | `hooks/use-user.ts` | Auth user + profil + workspaceId. Écoute `onAuthStateChange`. |
| `useAutosave()` | `components/funnels/v2/use-autosave.ts` | Sauvegarde auto debounced (1.5s) avec flush on unmount. |

#### Patterns de state

- **Pas de store global** : chaque page fetch ses données au mount via `useState` + `fetch()`
- **Optimistic updates** : MemberAssignDropdown, WorkspaceConfigProvider (rollback on error)
- **Polling** : LeadSidePanel poll les messages Instagram
- **Props drilling** pour callbacks modales (pas d'event bus)
- **Server components** : pages dashboard sont des `async` server components qui fetchent Supabase côté serveur

---

## 7. Logique métier critique

### Pipeline de leads

```
nouveau → scripté → setting_planifié → no_show_setting → closing_planifié → no_show_closing → closé ✅ → dead ❌
```

Les transitions déclenchent des **workflows automatiques** (emails, WhatsApp, notifications Telegram).

### Multi-tenant (isolation workspace)

- **Toute requête** filtre par `workspace_id`
- **RLS Supabase** sur toutes les tables
- 3 clients Supabase :
  - `createBrowserClient()` — composants client
  - `createServerClient()` — server components + API routes (cookie-based)
  - `createClient(SERVICE_ROLE_KEY)` — crons/webhooks (bypass RLS, filtre manuellement)
- `getWorkspaceId()` : helper central qui extrait `{ userId, workspaceId, role }` depuis la session

### RBAC (rôles)

| Rôle | Accès |
|------|-------|
| `admin` | Tout |
| `setter` | Ses leads + non-assignés, pas les closing d'autres |
| `closer` | Ses closing leads |
| `monteur` | Module montage vidéo uniquement |

### Rappels de booking

- Cron chaque minute (`/api/cron/booking-reminders`)
- Multi-canal : email, WhatsApp, Instagram DM
- Délais configurables par calendrier (J-1 à 9h, H-2, H-1)
- Templates avec variables `{{prenom}}`, `{{date_rdv}}`, `{{heure_rdv}}`

### Workflows / Automations

- 19+ types de triggers, 17+ types d'actions
- Steps : `action | delay | condition | wait_for_event`
- Branching conditionnel (if/else)
- Exécution trackée step par step avec logs
- Dry-run disponible
- Notification coach si échec (`notify_on_failure`)

### Billing / Quotas

- Plans : trial → starter → pro → scale → internal
- Wallet prépayé pour les dépassements (emails, AI tokens, WhatsApp)
- `consumeResource()` : check quota + débit wallet atomique (RPC Supabase)
- Vérification avant chaque envoi email/WhatsApp/IA

### Webhooks sécurisés

- Instagram & Meta : vérification HMAC-SHA256 (`x-hub-signature-256`)
- SES : validation SNS
- Crons : auth par `CRON_SECRET` bearer token

---

## 8. Ce qui est SPÉCIFIQUE au web (adaptation mobile nécessaire)

### Navigation

- **Sidebar fixe gauche** (180px, collapsible) → remplacer par tab bar bottom ou drawer
- **Breadcrumbs** sur certaines pages → simplifier pour mobile
- **Modales pleines** (ConfirmModal, CallScheduleModal, LeadActionModal) → bottom sheets ou pages dédiées

### Builders visuels (web-only, PAS à porter en mobile V1)

- **Funnel Builder v2** : drag-drop de blocs, preview responsive, autosave → trop complexe pour mobile
- **Email Builder** : TipTap rich text + blocs email → limiter à la consultation mobile
- **Workflow Editor** : nodes trigger/action/condition avec branching → consultation seule

### Fonctionnalités à adapter

| Feature web | Adaptation mobile |
|------------|-------------------|
| Tables denses (leads, closing, follow-ups) | Listes cards swipeable |
| Drag & drop (Kanban montage, workflow steps) | Actions via long-press ou menus contextuels |
| Calendrier intégré (agenda v2) | Vue calendrier native ou liste jour |
| CSV import | File picker natif ou simplifier |
| Charts Recharts | Librairie charts native (Victory Native, etc.) |
| Rich text (TipTap) | Éditeur markdown simple ou lecture seule |
| Theme CSS variables | Design tokens natifs (StyleSheet / theme provider) |
| `useAutosave()` debounced | Adapter au lifecycle mobile (background/foreground) |
| Cookie-based Supabase auth | Token-based auth (AsyncStorage / SecureStore) |
| Server components (SSR) | Tout est client-side en mobile, API calls directs |
| Polling messages IG | Push notifications + polling en foreground |

### Intégrations à adapter

- **Google Calendar OAuth** : Deep link vers navigateur + callback via URL scheme
- **Meta OAuth** : Idem
- **Speech recognition** (MessageInput) : API native du device
- **File upload** (avatar, médias social) : Camera/gallery picker natif
- **Notifications Telegram** : Push notifications natives en complément

### Design tokens à transposer

```css
/* Web (CSS variables) */
--bg-primary: #09090b;
--bg-secondary: #0c0c0e;
--bg-elevated: #141414;
--text-primary: #f5f5f7;
--text-secondary: #A0A0A0;
--border-primary: rgba(255,255,255,0.06);
--primary: #00C853;
--primary-hover: #00A844;
```

Le thème supporte **light + dark mode** (toggle via `data-theme`).

### Ce qui peut être partagé tel quel

- **Types TypeScript** : tous les types `src/types/` sont réutilisables
- **Schemas Zod** : validation identique côté mobile
- **Endpoints API** : l'app mobile consomme les mêmes routes `/api/*`
- **Logique métier** : pipeline leads, RBAC, billing rules

---

## Résumé

ClosRM est un CRM SaaS multi-tenant pour coachs avec ~55 pages, ~196 endpoints API, ~150 types TypeScript et une architecture React Context sans store global. L'app mobile doit consommer la même API REST, réutiliser les types/schemas, et adapter la navigation (sidebar → tab bar), les listes (tables → cards), et l'auth (cookies → tokens). Les builders visuels (funnels, emails, workflows) sont à exclure du scope mobile V1.

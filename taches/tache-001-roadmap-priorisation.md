# Tâche 001 — Roadmap & priorisation des tâches V1

> **Statut :** Terminée
> **Développeur :** Pierre
> **Date de début :** 2026-03-27
> **Date de fin :** 2026-03-27
> **Branche Git :** `develop` (fichier de planification uniquement, pas de code)

---

## Objectif

Lister toutes les tâches à réaliser pour la V1 de ClosRM, les prioriser, les répartir entre Rémy et Pierre, et identifier les dépendances entre elles. Ce fichier sert de référence unique pour savoir quoi faire, dans quel ordre, et qui fait quoi.

---

## État actuel du projet (ce qui existe déjà)

### Infrastructure
- ✅ Next.js 14 (App Router) + TypeScript + Tailwind CSS v4 + shadcn/ui
- ✅ Supabase configuré (client browser `src/lib/supabase/client.ts` + serveur `src/lib/supabase/server.ts`)
- ✅ Middleware auth (`src/lib/supabase/middleware.ts`) — redirige `/dashboard` → `/login` si non connecté, et `/login` → `/dashboard` si connecté
- ✅ Schéma SQL complet (`supabase/schema.sql`) — 7 tables : workspaces, users, leads, calls, follow_ups, automations, integrations + RLS + trigger auto-création workspace à l'inscription
- ✅ Types TypeScript complets (`src/types/index.ts`) — tous les modèles typés
- ✅ Design system (dark theme `#0A0A0A`, primary `#E53E3E`, variables CSS dans `globals.css`)
- ✅ Utilitaires (`src/lib/utils.ts`) — `cn()`, `formatDate()`, `formatDateTime()`, labels/couleurs pour statuts

### Pages existantes (toutes en placeholder "Module en cours de développement…")
- ✅ Auth : login (`src/app/(auth)/login/page.tsx`) + register (`src/app/(auth)/register/page.tsx`) — fonctionnels avec Supabase Auth
- ✅ Layout dashboard (`src/app/(dashboard)/layout.tsx`) — protection route + Sidebar
- ✅ Sidebar (`src/components/layout/Sidebar.tsx`) — 3 sections (Ventes/Acquisition/Compte), 11 items, collapsible, logout
- ✅ Pages placeholder : dashboard, leads, leads/[id], closing, follow-ups, statistiques, base-de-donnees, automations, publicites, reglages, integrations

### Ce qui manque (tout le reste)
- Aucune API route
- Aucun composant métier (tables, modales, formulaires, cards)
- Aucun hook custom
- Aucune logique métier
- Aucune intégration tierce fonctionnelle
- Dashboard d'accueil vide

---

## Roadmap V1 — Tâches détaillées par phase

---

### PHASE 1 — Fondations (aucune dépendance)

> Pierre et Rémy peuvent travailler en parallèle dès cette phase.

---

#### T-002 · Auth : finaliser le système — Pierre

**Objectif :** S'assurer que tout le cycle auth est solide et complet.

**Ce qui existe déjà :**
- Pages login/register fonctionnelles (Supabase `signInWithPassword` / `signUp`)
- Middleware de protection des routes
- Trigger SQL `on_auth_user_created` → crée workspace + profil user

**Ce qu'il reste à faire :**
- [ ] Tester le flow complet : inscription → création workspace → redirection dashboard
- [ ] Ajouter la gestion "mot de passe oublié" (Supabase `resetPasswordForEmail`)
- [ ] Ajouter la page de reset password (`/reset-password`)
- [ ] Vérifier que le middleware protège TOUTES les routes dashboard (pas seulement `/dashboard`)
- [ ] Créer un hook `useUser()` pour récupérer l'utilisateur courant + son workspace côté client
- [ ] Créer un helper `getWorkspaceId()` côté serveur (utilisé par toutes les API routes)
- [ ] Ajouter validation des inputs (email format, password min 8 chars) côté client
- [ ] Gérer le cas "email déjà utilisé" à l'inscription
- [ ] Ajouter un loading state global pendant la vérification de session

**Fichiers à créer :**
| Fichier | Description |
|---------|-------------|
| `src/hooks/use-user.ts` | Hook client : user + workspace courant |
| `src/lib/supabase/get-workspace.ts` | Helper serveur : récupère le workspace_id de l'utilisateur connecté |
| `src/app/(auth)/reset-password/page.tsx` | Page reset mot de passe |

**Fichiers à modifier :**
| Fichier | Modification |
|---------|-------------|
| `src/app/(auth)/login/page.tsx` | Ajouter lien "Mot de passe oublié", validation inputs |
| `src/app/(auth)/register/page.tsx` | Ajouter gestion erreur email existant, validation |
| `src/lib/supabase/middleware.ts` | Vérifier couverture routes (closing, follow-ups, acquisition, parametres) |

**Critères de validation :**
- Un nouvel utilisateur peut s'inscrire, un workspace est créé, il arrive sur /dashboard
- Un utilisateur existant peut se connecter et retrouve son workspace
- Un utilisateur non connecté est redirigé vers /login depuis n'importe quelle page dashboard
- Le mot de passe oublié fonctionne (email envoyé via Supabase)
- `useUser()` retourne le user + workspace_id côté client
- `getWorkspaceId()` retourne le workspace_id côté serveur (prêt pour les API routes)

---

#### T-003 · Dashboard d'accueil — Rémy

**Objectif :** Remplacer le placeholder par un vrai dashboard avec KPIs résumés.

**Ce qu'il faut faire :**
- [ ] Cards KPIs du jour/semaine : nouveaux leads, appels planifiés, deals closés
- [ ] Liste des prochains appels (aujourd'hui)
- [ ] Liste des follow-ups en retard
- [ ] Accès rapide aux actions fréquentes (ajouter lead, planifier appel)
- [ ] Message de bienvenue avec nom du coach

**Fichiers à créer :**
| Fichier | Description |
|---------|-------------|
| `src/components/dashboard/stats-card.tsx` | Card KPI réutilisable |
| `src/components/dashboard/upcoming-calls.tsx` | Liste appels à venir |
| `src/components/dashboard/pending-followups.tsx` | Liste follow-ups en retard |

**Fichiers à modifier :**
| Fichier | Modification |
|---------|-------------|
| `src/app/(dashboard)/dashboard/page.tsx` | Remplacer placeholder par le vrai dashboard |

**Dépend de :** T-004 (API Leads) pour les données réelles — peut commencer avec des données mockées puis brancher sur l'API

---

### PHASE 2 — Module Leads (cœur du CRM)

> C'est le module le plus critique. Presque tout en dépend. Pierre fait l'API, Rémy fait le frontend.

---

#### T-004 · API routes Leads — Pierre

**Objectif :** CRUD complet pour les leads, utilisable par toutes les pages frontend.

**Endpoints à créer :**

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/leads` | Liste paginée + filtres (status, source, search, tags, date range) |
| `POST` | `/api/leads` | Créer un lead (ajout manuel) |
| `GET` | `/api/leads/[id]` | Détail d'un lead avec ses calls et follow-ups |
| `PATCH` | `/api/leads/[id]` | Modifier un lead (statut, infos, tags, notes) |
| `DELETE` | `/api/leads/[id]` | Supprimer / archiver un lead |
| `GET` | `/api/leads/stats` | KPIs agrégés (count par statut, par source, par période) |

**Spécifications techniques :**
- Chaque route utilise `getWorkspaceId()` (T-002) pour isoler les données
- Pagination : `?page=1&per_page=25` (défaut 25, max 100)
- Filtres : `?status=nouveau,setting_planifie&source=facebook_ads&search=dupont&tag=chaud`
- Tri : `?sort=created_at&order=desc` (défaut : plus récent en premier)
- Réponse format : `{ data: Lead[], meta: { total, page, per_page, total_pages } }`
- Validation des inputs avec types TypeScript stricts
- Gestion erreurs : 400 (bad request), 401 (non auth), 404 (not found), 500 (server error)

**Fichiers à créer :**
| Fichier | Description |
|---------|-------------|
| `src/app/api/leads/route.ts` | GET (liste) + POST (create) |
| `src/app/api/leads/[id]/route.ts` | GET (detail) + PATCH (update) + DELETE |
| `src/app/api/leads/stats/route.ts` | GET (KPIs agrégés) |

**Dépend de :** T-002 (helper `getWorkspaceId()`)

**Bloque :** T-005, T-006, T-007, T-008, T-011, T-012, T-013

---

#### T-005 · Page liste Leads — Rémy

**Objectif :** Afficher tous les leads dans un tableau interactif avec filtres et actions.

**Spécifications UI (depuis CLAUDE.md) :**
- Tableau dense avec colonnes : Date création, Prénom/Nom, Téléphone, Email, Source, Nb tentatives appel, Joint (toggle), Statut pipeline (badge coloré), Tags, Actions
- Filtres : par statut, source, tags, recherche texte
- Actions par lead : Planifier appel, Voir fiche, Archiver
- Bouton "Ajouter un lead" → modale de création
- Pagination
- Setter assigné : masqué en V1 (prévu V2)

**Composants à créer :**
| Fichier | Description |
|---------|-------------|
| `src/components/leads/leads-table.tsx` | Tableau principal avec colonnes |
| `src/components/leads/lead-filters.tsx` | Barre de filtres (statut, source, search) |
| `src/components/leads/add-lead-modal.tsx` | Modale ajout lead manuel |
| `src/components/leads/lead-status-badge.tsx` | Badge coloré statut (réutilisable) |
| `src/components/leads/lead-source-badge.tsx` | Badge source |

**Dépend de :** T-004 (API Leads)

---

#### T-006 · Fiche Lead détaillée — Rémy

**Objectif :** Page de détail d'un lead avec tout son historique.

**Spécifications UI (depuis CLAUDE.md) :**
- Informations de contact complètes (prénom, nom, phone, email, source)
- Historique de tous les appels (date, durée, résultat, notes)
- Timeline des interactions (changements de statut, appels, follow-ups)
- Bouton "Appeler" → log automatique tentative (incrémente `call_attempts`)
- Bouton "Planifier RDV" → modale (sync Google Agenda en Phase 5)
- Champ notes libre (éditable)
- Statut actuel + historique des changements
- Tags éditables (ajout/suppression)
- Source publicitaire (campagne, ad set, ad — si Meta connecté, sinon masqué)

**Composants à créer :**
| Fichier | Description |
|---------|-------------|
| `src/components/leads/lead-info-card.tsx` | Card infos contact |
| `src/components/leads/lead-call-history.tsx` | Liste historique appels |
| `src/components/leads/lead-timeline.tsx` | Timeline interactions |
| `src/components/leads/lead-notes.tsx` | Éditeur notes |
| `src/components/leads/lead-tags-editor.tsx` | Gestion tags |
| `src/components/leads/schedule-call-modal.tsx` | Modale planifier appel |

**Dépend de :** T-004, T-005, T-007

---

### PHASE 3 — Modules Closing & Follow-ups

> Entièrement sur Pierre. Peut commencer dès que T-004 (API Leads) est terminé.

---

#### T-007 · API routes Calls — Pierre

**Objectif :** CRUD pour les appels (setting et closing).

**Endpoints à créer :**

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/calls` | Liste avec filtres (type, outcome, date range, lead_id) |
| `POST` | `/api/calls` | Planifier un appel |
| `GET` | `/api/calls/[id]` | Détail d'un appel |
| `PATCH` | `/api/calls/[id]` | Modifier (outcome, notes, reached, duration) |
| `DELETE` | `/api/calls/[id]` | Supprimer un appel |

**Logique métier :**
- Quand un call setting est créé → le lead passe en statut `setting_planifie`
- Quand un call closing est créé → le lead passe en statut `closing_planifie`
- Quand outcome = `done` + type = `closing` → le lead passe en `clos`
- Quand outcome = `no_show` → le lead passe en `no_show_setting` ou `no_show_closing` selon le type
- Quand outcome = `cancelled` → le lead revient au statut précédent
- `attempt_number` s'incrémente automatiquement par lead

**Fichiers à créer :**
| Fichier | Description |
|---------|-------------|
| `src/app/api/calls/route.ts` | GET (liste) + POST (create) |
| `src/app/api/calls/[id]/route.ts` | GET + PATCH + DELETE |

**Dépend de :** T-004 (leads existent pour associer les calls)

---

#### T-008 · API routes Follow-ups — Pierre

**Objectif :** CRUD pour les follow-ups / relances.

**Endpoints à créer :**

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/follow-ups` | Liste avec filtres (status, channel, lead_id, date range) |
| `POST` | `/api/follow-ups` | Créer un follow-up |
| `PATCH` | `/api/follow-ups/[id]` | Modifier (statut, notes, date) |
| `DELETE` | `/api/follow-ups/[id]` | Supprimer |

**Logique métier :**
- Un follow-up peut être créé manuellement ou automatiquement (via automations en Phase 5)
- Statuts : `en_attente` → `fait` ou `annule`
- Canaux : `whatsapp`, `email`, `manuel`

**Fichiers à créer :**
| Fichier | Description |
|---------|-------------|
| `src/app/api/follow-ups/route.ts` | GET + POST |
| `src/app/api/follow-ups/[id]/route.ts` | PATCH + DELETE |

**Dépend de :** T-004

---

#### T-009 · Module Closing (frontend) — Pierre

**Objectif :** Vue dédiée aux appels de closing avec onglets et vue calendrier.

**Spécifications UI (depuis CLAUDE.md) :**

**4 onglets :**
1. **Appels à venir** — calls de type `closing` avec outcome `pending` et `scheduled_at` > now (badge count)
2. **Appels à actualiser** — calls de type `closing` avec outcome `pending` et `scheduled_at` < now (résultat non renseigné)
3. **Appels traités** — outcome `done`
4. **Annulés / Absents** — outcome `cancelled` ou `no_show`

**Toggle vue :** Liste (tableau) ↔ Calendrier (grille semaine/mois)

**Par appel affiché :**
- Nom du lead + contact (phone, email)
- Closer assigné (dropdown — V1 : coach seul donc pas de sélection)
- Setter d'origine (info)
- Date/heure prévue
- Statut : En attente / Fait / Annulé / Absent (badge coloré)
- Actions : Appeler (log tentative), Reprogrammer (modale), Marquer résultat (dropdown), Voir fiche (lien)

**Composants à créer :**
| Fichier | Description |
|---------|-------------|
| `src/components/closing/closing-tabs.tsx` | Onglets avec badge count |
| `src/components/closing/closing-table.tsx` | Vue tableau des appels |
| `src/components/closing/closing-calendar.tsx` | Vue calendrier |
| `src/components/closing/call-card.tsx` | Card d'un appel (réutilisable) |
| `src/components/closing/reschedule-modal.tsx` | Modale reprogrammer |
| `src/components/closing/mark-outcome-dropdown.tsx` | Dropdown résultat |

**Fichiers à modifier :**
| Fichier | Modification |
|---------|-------------|
| `src/app/(dashboard)/closing/page.tsx` | Remplacer placeholder |

**Dépend de :** T-007 (API Calls)

---

#### T-010 · Module Follow-ups (frontend) — Pierre

**Objectif :** Vue de gestion des relances.

**Spécifications UI (depuis CLAUDE.md) :**

**Colonnes tableau :**
- Nom du lead (lien vers fiche)
- Raison du follow-up
- Date prévue
- Canal (WhatsApp / Email / Manuel) — icône + label
- Statut (En attente / Fait / Annulé) — badge coloré
- Notes
- Actions : Marquer fait, Reprogrammer, Annuler, Voir fiche lead

**Filtres :** par statut, canal, date range
**Tri :** date prévue (par défaut : plus urgent en premier)
**Bouton :** "Créer un follow-up" → modale

**Composants à créer :**
| Fichier | Description |
|---------|-------------|
| `src/components/follow-ups/followup-table.tsx` | Tableau principal |
| `src/components/follow-ups/followup-filters.tsx` | Barre filtres |
| `src/components/follow-ups/add-followup-modal.tsx` | Modale création (sélection lead, raison, canal, date) |

**Fichiers à modifier :**
| Fichier | Modification |
|---------|-------------|
| `src/app/(dashboard)/follow-ups/page.tsx` | Remplacer placeholder |

**Dépend de :** T-008 (API Follow-ups)

---

### PHASE 4 — Statistiques & Base de données

---

#### T-011 · Module Statistiques — Rémy

**Objectif :** Dashboard de performance avec graphiques et funnel.

**KPIs à afficher (depuis CLAUDE.md) :**
- Leads totaux (période sélectionnable : 7j / 30j / 90j / tout)
- Calls bookés + taux de booking (calls / leads)
- Deals closés + win rate (closés / calls closing)
- Revenue généré (champ à ajouter ? ou V2)
- Coût par lead (si Meta connecté — Phase 5)
- Coût par call booké (si Meta connecté)
- ROAS estimé (si Meta connecté)

**Graphiques (Recharts) :**
- Leads par jour (line chart)
- Funnel de conversion visuel (leads → setting → closing → closé) (bar chart / funnel)
- Performance par source : Facebook vs Instagram vs Manuel (pie chart)
- Performance par campagne / ad set / ad (si Meta connecté — masqué sinon)

**Sélecteur de période :** 7 jours / 30 jours / 90 jours / Tout

**Dépend de :** T-004 (API Leads), T-007 (API Calls) — utilise `/api/leads/stats`

---

#### T-012 · Base de données (vue globale contacts) — Rémy/Pierre

**Objectif :** Vue complète de tous les contacts avec recherche avancée.

**Fonctionnalités (depuis CLAUDE.md) :**
- Recherche full-text (nom, email, phone)
- Filtres avancés : statut, source, tags, date range, joint/pas joint
- Export CSV (téléchargement fichier)
- Historique complet par contact (lien vers fiche lead)
- Segmentation : grouper par statut, source, tags

**Différence avec la page Leads :**
- La page Leads est orientée "pipeline actif" (actions commerciales)
- La Base de données est orientée "répertoire complet" (recherche, export, historique)

**Dépend de :** T-004

---

### PHASE 5 — Intégrations & Automations

---

#### T-013 · Intégration Meta Ads (leads import) — Rémy

**Objectif :** Connecter Facebook/Instagram Ads pour importer les leads automatiquement.

**Ce qu'il faut faire :**
- [ ] OAuth Meta Business (bouton "Connecter" dans Paramètres > Intégrations)
- [ ] Webhook `/api/webhooks/meta` pour recevoir les leads en temps réel
- [ ] Mapping Meta lead → table `leads` (prénom, nom, email, phone, source, campaign_id, adset_id, ad_id)
- [ ] Stocker les credentials chiffrés dans table `integrations`
- [ ] Endpoint pour récupérer les stats campagnes (budget, dépensé, CPL) via Meta Marketing API

**Variables d'environnement nécessaires :**
- `META_APP_ID`
- `META_APP_SECRET`
- `META_WEBHOOK_VERIFY_TOKEN`

**Fichiers à créer :**
| Fichier | Description |
|---------|-------------|
| `src/app/api/webhooks/meta/route.ts` | Webhook réception leads Meta |
| `src/app/api/integrations/meta/route.ts` | OAuth flow + déconnexion |
| `src/lib/meta/client.ts` | Client Meta Marketing API |

**Dépend de :** T-004

---

#### T-014 · Module Automations (workflows) — Pierre

**Objectif :** Configurer des règles d'automatisation trigger → action.

**Triggers disponibles (depuis CLAUDE.md) :**
| Trigger | Description |
|---------|-------------|
| `new_lead` | Quand un nouveau lead est créé (manuel ou Meta) |
| `rdv_planifie` | Quand un appel est planifié |
| `rdv_in_x_hours` | X heures/jours avant un RDV |
| `lead_status_changed` | Quand le statut d'un lead change |
| `followup_pending_x_days` | Quand un follow-up est en attente depuis X jours |

**Actions disponibles (depuis CLAUDE.md) :**
| Action | Description |
|--------|-------------|
| `send_whatsapp` | Envoyer message WhatsApp (template avec variables `{{prenom}}`, `{{date_rdv}}`, `{{heure_rdv}}`, `{{nom_coach}}`) |
| `send_email` | Envoyer email (via Resend) |
| `create_followup` | Créer un follow-up automatiquement |
| `change_lead_status` | Changer le statut du lead |
| `send_notification` | Notification au coach (Telegram ou WhatsApp) |

**Configuration rappels RDV :**
- Canal : WhatsApp / Email / Les deux
- Délais : configurable (J-1 à 9h00, H-2, H-1)
- Message template personnalisable

**Architecture technique :**
- Les automations sont stockées en BDD (table `automations` avec `trigger_config` et `action_config` en JSONB)
- Un moteur d'exécution évalue les triggers et lance les actions
- Pour les triggers temporels (`rdv_in_x_hours`, `followup_pending_x_days`) : cron job ou Supabase Edge Function

**Endpoints API :**
| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/automations` | Liste des automations du workspace |
| `POST` | `/api/automations` | Créer une automation |
| `PATCH` | `/api/automations/[id]` | Modifier (config, activer/désactiver) |
| `DELETE` | `/api/automations/[id]` | Supprimer |

**Composants frontend :**
| Fichier | Description |
|---------|-------------|
| `src/components/automations/automation-list.tsx` | Liste des automations avec toggle actif/inactif |
| `src/components/automations/automation-builder.tsx` | Builder : sélection trigger + config + action + config |
| `src/components/automations/trigger-config.tsx` | Config dynamique selon le trigger sélectionné |
| `src/components/automations/action-config.tsx` | Config dynamique selon l'action sélectionnée |

**Dépend de :** T-007 (API Calls), T-008 (API Follow-ups)

---

#### T-015 · Intégration Google Agenda — Rémy

**Objectif :** Sync bidirectionnelle des RDV.

**Ce qu'il faut faire :**
- [ ] OAuth Google (bouton dans Paramètres > Intégrations)
- [ ] Quand un call est planifié dans ClosRM → créer événement Google Agenda
- [ ] Quand un call est reprogrammé/annulé → mettre à jour/supprimer événement
- [ ] Optionnel : lire les events Google pour les afficher dans le calendrier Closing

**Variables d'environnement :** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

**Dépend de :** T-007 (API Calls)

---

#### T-016 · Notifications (WhatsApp/Telegram) — Pierre

**Objectif :** Envoyer des messages automatiques aux leads et notifications au coach.

**WhatsApp (Meta Cloud API) :**
- Envoi de messages template aux leads (rappels RDV, follow-ups)
- Variables dynamiques : `{{prenom}}`, `{{date_rdv}}`, `{{heure_rdv}}`, `{{nom_coach}}`
- Gratuit jusqu'à 1000 conversations/mois

**Telegram (Bot) :**
- Notifications au coach (nouveau lead reçu, RDV dans 1h, deal closé)
- Via Bot Token configuré dans Paramètres

**Variables d'environnement :** `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`

**Fichiers à créer :**
| Fichier | Description |
|---------|-------------|
| `src/lib/whatsapp/client.ts` | Client Meta Cloud API WhatsApp |
| `src/lib/telegram/client.ts` | Client Telegram Bot API |
| `src/app/api/notifications/whatsapp/route.ts` | Envoi WhatsApp |
| `src/app/api/notifications/telegram/route.ts` | Envoi Telegram |

**Dépend de :** T-014 (Automations — c'est le moteur qui déclenche les notifications)

---

### PHASE 6 — Paramètres & Publicités

---

#### T-017 · Module Publicités (dashboard Meta Ads) — Rémy

**Objectif :** Dashboard de performance des campagnes publicitaires.

**Données affichées (depuis CLAUDE.md) :**
- Budget pub du mois
- Montant dépensé
- Leads générés
- Coût par lead
- Performance par plateforme (Facebook / Instagram)
- Performance par Campagne / Ad Set / Ad (tableau drill-down)
- Graphique leads/jour
- Funnel marketing visuel

**Dépend de :** T-013 (Intégration Meta — les données viennent de l'API Meta)

---

#### T-018 · Paramètres — Réglages — Pierre

**Objectif :** Page de configuration du compte et du workspace.

**Sections (depuis CLAUDE.md) :**
- Informations du compte : nom, email, photo de profil (upload Supabase Storage)
- Nom du workspace / marque
- Fuseau horaire (dropdown)
- Langue (FR par défaut — V1 : FR uniquement)
- Suppression du compte (avec confirmation)
- Gestion des membres d'équipe → masqué en V1 (prévu V2)

**Endpoints API :**
| Méthode | Route | Description |
|---------|-------|-------------|
| `PATCH` | `/api/user/profile` | Modifier profil (nom, avatar) |
| `PATCH` | `/api/workspaces` | Modifier workspace (nom, timezone) |
| `DELETE` | `/api/user/account` | Supprimer compte + workspace |

**Composants :**
| Fichier | Description |
|---------|-------------|
| `src/components/settings/profile-form.tsx` | Formulaire profil |
| `src/components/settings/workspace-form.tsx` | Formulaire workspace |
| `src/components/settings/delete-account.tsx` | Section suppression avec confirmation |

**Dépend de :** T-002 (Auth)

---

#### T-019 · Paramètres — Intégrations — Pierre

**Objectif :** Page pour connecter/déconnecter les services tiers.

**Intégrations à afficher :**
| Service | Statut | Action |
|---------|--------|--------|
| Google Agenda | Connecté ✅ / Non connecté | Bouton Connecter/Déconnecter |
| Meta (Facebook/Instagram) | Connecté ✅ / Non connecté | Bouton Connecter/Déconnecter |
| WhatsApp Business | Connecté ✅ / Non connecté | Bouton Configurer |
| Stripe | 🔒 V2 | Grisé |
| Telegram | Connecté ✅ / Non connecté | Bouton Configurer |

Chaque card montre : icône, nom, description, statut, date de connexion, bouton action.

**Dépend de :** T-013 (Meta OAuth), T-015 (Google OAuth) — au minimum pour que les boutons fassent quelque chose

---

## Résumé — Vue d'ensemble

### Par développeur

**Pierre — 11 tâches :**
| Phase | Tâches |
|-------|--------|
| 1 | T-002 Auth |
| 2 | T-004 API Leads |
| 3 | T-007 API Calls, T-008 API Follow-ups, T-009 Closing, T-010 Follow-ups |
| 4 | T-012 Base de données (partiel) |
| 5 | T-014 Automations, T-016 Notifications |
| 6 | T-018 Réglages, T-019 Intégrations |

**Rémy — 8 tâches :**
| Phase | Tâches |
|-------|--------|
| 1 | T-003 Dashboard |
| 2 | T-005 Liste Leads, T-006 Fiche Lead |
| 4 | T-011 Statistiques, T-012 Base de données (partiel) |
| 5 | T-013 Meta Ads, T-015 Google Agenda |
| 6 | T-017 Publicités |

### Graphe de dépendances

```
T-002 (Auth Pierre) ──┬──→ T-004 (API Leads Pierre) ──┬──→ T-005 (Liste Leads Rémy) ──→ T-006 (Fiche Lead Rémy)
                       │                                │
                       │                                ├──→ T-007 (API Calls Pierre) ──┬──→ T-009 (Closing Pierre)
                       │                                │                               ├──→ T-011 (Stats Rémy)
                       │                                │                               └──→ T-015 (Google Agenda Rémy)
                       │                                │
                       │                                ├──→ T-008 (API FU Pierre) ──→ T-010 (Follow-ups Pierre)
                       │                                │
                       │                                ├──→ T-012 (Base de données Rémy/Pierre)
                       │                                │
                       │                                └──→ T-013 (Meta Ads Rémy) ──→ T-017 (Publicités Rémy)
                       │
                       └──→ T-018 (Réglages Pierre)

T-007 + T-008 ──→ T-014 (Automations Pierre) ──→ T-016 (Notifications Pierre)
T-013 + T-015 ──→ T-019 (Page Intégrations Pierre)
```

### Chemin critique (débloque le plus de tâches)

```
T-002 (Auth) → T-004 (API Leads) → T-007 (API Calls) → T-009 (Closing) / T-014 (Automations)
```

**Pierre doit prioriser T-002 puis T-004 pour débloquer Rémy le plus vite possible.**

---

## Hors scope V1 (prévu V2)

| Feature | Raison |
|---------|--------|
| Tunnels de vente (builder de pages) | Complexité élevée, pas critique pour le MVP |
| Séquences emails (type Mailerlite) | Nécessite infra email dédiée |
| Intégration Stripe (paiements) | Pas prioritaire sans tunnels |
| Multi-membres équipe (setter/closer) | V1 = coach seul |
| Revenue tracking | Nécessite Stripe ou saisie manuelle |
| Multi-langue | V1 = français uniquement |

---

*Créé le 2026-03-27 par Claude Code — ClosRM*

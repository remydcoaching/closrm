# Tâches Pierre — ClosRM V1

> Toutes les tâches de Pierre, dans l'ordre. Chaque module = API + Frontend, autonome.
> Dernière mise à jour : 2026-03-31 (soir)

---

## Ordre de développement

### 1. T-002 · Auth — Finaliser le système
**Priorité :** Critique (débloque tout)
**Statut :** ✅ Terminé (2026-03-27)

- [x] Tester flow complet : inscription → création workspace → redirection dashboard
- [x] Page reset password (`/reset-password`) avec `resetPasswordForEmail`
- [x] Lien "Mot de passe oublié" sur la page login
- [x] Hook `useUser()` → retourne user + workspace_id côté client
- [x] Helper `getWorkspaceId()` → retourne workspace_id côté serveur
- [x] Validation inputs (email format, password 8 chars min)
- [x] Gestion erreur "email déjà utilisé" à l'inscription
- [x] Vérifier que le middleware protège TOUTES les routes dashboard

---

### 2. T-007 · Module Closing — API + Frontend
**Priorité :** Haute
**Statut :** ✅ Terminé (2026-03-28)

- [x] `GET /api/calls` — liste avec filtres (type, outcome, date range, lead_id)
- [x] `POST /api/calls` — planifier un appel
- [x] `GET /api/calls/[id]` — détail
- [x] `PATCH /api/calls/[id]` — modifier (outcome, notes, reached, duration)
- [x] `DELETE /api/calls/[id]` — supprimer
- [x] Logique métier : changement statut lead auto selon outcome
- [x] 4 onglets : À venir / À actualiser / Traités / Annulés-Absents
- [x] Toggle vue Liste ↔ Calendrier
- [x] Actions : Appeler, Reprogrammer, Marquer résultat, Voir fiche
- [x] Modale reprogrammer un appel

---

### 3. T-008 · Module Follow-ups — API + Frontend
**Priorité :** Haute
**Statut :** ✅ Terminé (2026-03-28)

- [x] `GET /api/follow-ups` — liste avec filtres (status, channel, lead_id, date range)
- [x] `POST /api/follow-ups` — créer
- [x] `PATCH /api/follow-ups/[id]` — modifier (statut, notes, date)
- [x] `DELETE /api/follow-ups/[id]` — supprimer
- [x] Tableau : nom lead, raison, date prévue, canal, statut, notes, actions
- [x] Bouton Créer un follow-up + modale
- [x] Actions : Marquer fait, Reprogrammer, Annuler, Voir fiche lead
- [x] FollowUpActionModal (marquer fait/annuler avec notes)

---

### 4. T-014 · Module Automations (Workflows) — API + Frontend
**Priorité :** Moyenne
**Statut :** ✅ Terminé (2026-03-30)

**API (`/api/workflows`) :**
- [x] `GET /api/workflows` — liste
- [x] `POST /api/workflows` — créer
- [x] `PATCH /api/workflows/[id]` — modifier
- [x] `POST /api/workflows/[id]/activate` — activer
- [x] `POST /api/workflows/[id]/deactivate` — désactiver
- [x] `DELETE /api/workflows/[id]` — supprimer
- [x] `GET/POST /api/workflows/[id]/steps` — gestion des étapes
- [x] `GET /api/workflows/[id]/executions` — historique exécutions

**Moteur d'exécution (`src/lib/workflows/`) :**
- [x] `engine.ts` — exécution séquentielle des étapes (action/delay/condition)
- [x] `trigger.ts` — dispatcher de triggers (fire-and-forget)
- [x] `variables.ts` — résolution de templates (`{{prenom}}`, `{{date_rdv}}`, etc.)
- [x] `templates.ts` — templates pré-configurés

**Actions implémentées :**
- [x] `send_email` (Resend API)
- [x] `send_whatsapp` (Meta Cloud API)
- [x] `send_notification` (Telegram ou WhatsApp au coach)
- [x] `create_followup`
- [x] `change_lead_status`
- [x] `add_tag` / `remove_tag`
- [ ] `send_dm_instagram` (stub — T-021)
- [ ] `facebook_conversions_api` (stub — T-013)

**Cron scheduler :**
- [x] `/api/cron/workflow-scheduler` — reprend les exécutions pausées (delay steps) + triggers temporels

**Frontend (page `/acquisition/automations`) :**
- [x] Liste des workflows avec toggle actif/inactif
- [x] Builder visuel : trigger + étapes (action/delay/condition)
- [x] Création depuis templates ou vierge
- [x] Compteur d'exécutions + date dernière exécution

---

### 5. T-016 · Notifications WhatsApp + Telegram
**Priorité :** Moyenne
**Statut :** ✅ Terminé (2026-03-30)

- [x] Client WhatsApp Meta Cloud API (`src/lib/whatsapp/client.ts`)
- [x] Client Telegram Bot API (`src/lib/telegram/client.ts`)
- [x] Client Email Resend (`src/lib/email/client.ts`)
- [x] API route envoi WhatsApp (`/api/notifications/whatsapp`)
- [x] API route envoi Telegram (`/api/notifications/telegram`)
- [x] Intégré dans les actions workflow (send_whatsapp, send_notification)

---

### 6. T-018 · Paramètres — Réglages
**Priorité :** Basse
**Statut :** ✅ Terminé (2026-03-30)

**API :**
- [x] `GET/PATCH /api/user/profile` — modifier profil (nom)
- [x] `POST /api/user/avatar` — upload avatar (Supabase Storage)
- [x] `GET/PATCH /api/workspaces` — modifier workspace (nom, timezone, accent_color)
- [x] `POST/DELETE /api/workspaces/logo` — upload/suppression logo
- [x] `DELETE /api/user/account` — supprimer compte + workspace

**Frontend (page `/parametres/reglages`) :**
- [x] Formulaire profil (nom, email, photo)
- [x] Formulaire workspace (nom, logo, fuseau horaire)
- [x] Section suppression compte avec confirmation
- [x] **Branding** — formulaire couleur d'accent (presets + hex custom) + upload logo + preview live

---

### 6b. Dark/Light Mode
**Statut :** ✅ Terminé (2026-03-31)

- [x] ThemeProvider avec `next-themes` (class attribute, default dark)
- [x] Toggle dans le footer sidebar (Sun/Moon icons, labels français)
- [x] CSS variables complètes light/dark dans `globals.css`
- [x] Support `prefers-color-scheme` (système)

**Fichiers :** `src/components/theme/ThemeProvider.tsx`, `src/components/theme/ThemeToggle.tsx`

---

### 6c. Branding dynamique
**Statut :** ✅ Terminé (2026-03-31)

- [x] Migration SQL : `accent_color` + `logo_url` dans workspaces + bucket `workspace-logos`
- [x] `BrandingInjector` — injection dynamique de CSS variables (`--color-primary`, etc.)
- [x] `BrandingForm` — presets couleurs (12 couleurs) + hex custom + preview live
- [x] Refactor global : couleurs hardcodées → CSS variables `var(--color-primary)`
- [x] Logo affiché dans la sidebar si configuré
- [x] ~~Migration exécutée dans Supabase~~ ✅

**Fichiers :** `src/lib/branding/BrandingInjector.tsx`, `src/lib/branding/utils.ts`, `src/components/settings/BrandingForm.tsx`, `supabase/migrations/003_branding.sql`
**Spec :** `docs/superpowers/specs/2026-03-31-branding-customization-design.md`

---

### 7. T-019 · Paramètres — Page Intégrations
**Priorité :** Basse
**Statut :** ✅ Terminé (2026-03-30)

- [x] Card par service : Telegram, WhatsApp, Meta, Google Agenda, Stripe
- [x] Chaque card : icône, nom, description, statut, date connexion, bouton action
- [x] Modale de connexion (Telegram: bot token + chat ID, WhatsApp: phone ID + access token)
- [x] Validation automatique des credentials
- [x] Toggle actif/inactif + déconnexion avec confirmation
- [x] Placeholders OAuth pour Meta, Google Agenda (sera implémenté par Rémy)
- [x] Chiffrement des credentials en base (`src/lib/crypto.ts`)

---

### 8. T-022 · Module Calendrier / Booking (type Calendly)
**Priorité :** Haute
**Statut :** 🔄 En cours — code implémenté, migrations SQL ✅, tests E2E restants
**Spec :** `docs/superpowers/specs/2026-03-30-agenda-booking-design.md`

**Base de données :**
- [x] Migration SQL : tables `workspace_slugs`, `booking_calendars`, `bookings`
- [x] ~~Migration exécutée dans Supabase~~ ✅

**API :**
- [x] CRUD `/api/booking-calendars`
- [x] CRUD `/api/bookings`
- [x] API publique `/api/public/book/[slug]/[slug]` (créneaux + réservation)
- [x] API `/api/workspaces/slug` (slug public)
- [x] Calcul des créneaux disponibles (`src/lib/bookings/availability.ts`)
- [x] Anti-double-booking
- [x] Création lead auto depuis booking public
- [x] Trigger workflow `booking_created`

**Frontend — Agenda (`/agenda`) :**
- [x] Vues Jour / Semaine / Mois
- [x] Sidebar : mini-calendrier + filtres calendriers
- [x] Modale nouveau RDV (calendrier ou événement perso)
- [x] Panel détails avec statut + suppression
- [x] Affichage événements Google Calendar dans l'agenda (lecture seule, badge "Google")

**Frontend — Paramètres Calendriers (`/parametres/calendriers`) :**
- [x] Liste calendriers avec cards
- [x] Éditeur : général, disponibilités hebdo, champs formulaire, lien

**Frontend — Booking public (`/book/[slug]/[slug]`) :**
- [x] Page Calendly-style avec branding coach
- [x] Formulaire dynamique + page de confirmation

**Ce qui reste :**
- [ ] Exécuter migration SQL dans Supabase
- [ ] Tester end-to-end
- [ ] Ajouter champ slug workspace dans page Réglages (A-022-01)

---

### 8b. Intégration Google Calendar
**Statut :** ✅ Terminé (2026-03-31)

**API :**
- [x] `GET /api/integrations/google/authorize` — initie le flow OAuth Google
- [x] `GET /api/integrations/google/callback` — récupère les tokens + sauvegarde intégration
- [x] `POST /api/integrations/google/sync` — sync événements Google Calendar → bookings

**Backend (`src/lib/google/calendar.ts`) :**
- [x] `getGoogleAuthUrl()` — génération URL OAuth avec scopes calendar
- [x] `getGoogleTokens()` — échange code → tokens
- [x] `refreshGoogleToken()` — refresh automatique token expiré
- [x] `listCalendarEvents()` — récupère événements depuis Google Calendar
- [x] `syncGoogleCalendarEvents()` — sync complète (upsert bookings type `google_event`)

**Frontend :**
- [x] Card Google Calendar sur page intégrations (`google-card.tsx`) avec statut connecté/non connecté
- [x] Bouton "Connecter Google Calendar" → OAuth flow
- [x] Bouton "Synchroniser" + "Déconnecter" quand connecté

---

### 8c. Planning Templates (modèles de semaine type)
**Statut :** ✅ Terminé (2026-03-31)
**Spec :** `docs/superpowers/specs/2026-03-31-planning-templates-design.md`

**API (`/api/planning-templates`) :**
- [x] `GET /api/planning-templates` — liste des templates du workspace
- [x] `POST /api/planning-templates` — créer un template
- [x] `GET /api/planning-templates/[id]` — détail
- [x] `PATCH /api/planning-templates/[id]` — modifier (nom, blocs)
- [x] `DELETE /api/planning-templates/[id]` — supprimer
- [x] `POST /api/planning-templates/[id]/import` — importer les blocs d'un template sur une semaine donnée (crée les bookings)

**Base de données :**
- [x] Migration SQL : table `planning_templates` (`supabase/migrations/005_planning_templates.sql`)
- [x] ~~Migration exécutée dans Supabase~~ ✅

**Frontend — Liste templates (`/agenda/templates`) :**
- [x] Cards templates avec aperçu visuel (nb blocs, calendriers associés)
- [x] Bouton créer un template
- [x] Actions : éditer, dupliquer, supprimer, appliquer à une semaine

**Frontend — Éditeur template (`/agenda/templates/[id]`) :**
- [x] Éditeur hebdomadaire style Google Sheets (grille 7 jours × créneaux horaires)
- [x] Blocs drag & click sur la grille
- [x] Modale ajout/édition de bloc (titre, calendrier, heure début/fin, jours)
- [x] Composants : `TemplateWeekEditor`, `BlockModal`, `TemplateCard`

**Frontend — Import dans l'agenda :**
- [x] Bouton "Appliquer un template" depuis la page agenda
- [x] Sélection template + semaine cible → création automatique des bookings

---

### 9. T-021 · Instagram Automations
**Priorité :** Moyenne
**Statut :** ⬜ Non démarré

- [ ] Envoi automatique de follow en story / DM / commentaire sous un post
- [ ] Intégration Instagram Graph API
- [ ] Config des triggers : réponse à un mot-clé en story, DM, commentaire
- [ ] Actions automatisées selon le trigger
- [ ] Compléter le stub `send_dm_instagram` dans les workflows

---

## Résumé

| # | Tâche | Priorité | Statut |
|---|-------|----------|--------|
| 1 | Auth (T-002) | Critique | ✅ |
| 2 | Closing (T-007) | Haute | ✅ |
| 3 | Follow-ups (T-008) | Haute | ✅ |
| 4 | Automations/Workflows (T-014) | Moyenne | ✅ |
| 5 | Notifications WhatsApp/Telegram (T-016) | Moyenne | ✅ |
| 6 | Paramètres Réglages (T-018) | Basse | ✅ |
| 6b | Dark/Light Mode | — | ✅ |
| 6c | Branding dynamique | — | ✅ |
| 7 | Paramètres Intégrations (T-019) | Basse | ✅ |
| 8 | Calendrier/Booking (T-022) | Haute | 🔄 (tests E2E restants) |
| 8b | Google Calendar sync | — | ✅ |
| 8c | Planning Templates | — | ✅ |
| 9 | Instagram Automations (T-021) | Moyenne | ⬜ |

**Score : 12/13 terminées · 1 non démarrée (T-021 Instagram)**

---

*Mis à jour le 2026-03-31 — ClosRM*

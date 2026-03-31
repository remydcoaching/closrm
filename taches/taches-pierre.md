# Tâches Pierre — ClosRM V1

> Toutes les tâches de Pierre, dans l'ordre. Chaque module = API + Frontend, autonome.
> Dernière mise à jour : 2026-04-01

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
**Statut :** 🔄 En cours (builder refait le 01/04, reste polish)
**Spec :** `docs/superpowers/specs/2026-03-31-email-module-design.md`

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

**Actions implémentées (13 au total) :**
- [x] `send_email` (Resend API)
- [x] `send_whatsapp` (Meta Cloud API)
- [x] `send_notification` (Telegram ou WhatsApp au coach)
- [x] `create_followup`
- [x] `change_lead_status`
- [x] `add_tag` / `remove_tag`
- [x] `enroll_in_sequence` — inscrire lead dans une séquence email
- [x] `add_note` — ajouter une note au lead
- [x] `set_reached` — marquer comme joint
- [x] `schedule_call` — planifier un appel (setting/closing)
- [x] `webhook` — appeler un webhook externe (POST/GET/PUT)
- [ ] `send_dm_instagram` (stub — T-021)
- [ ] `facebook_conversions_api` (stub — T-013)

**Branching + Wait-for-event (ajouté 01/04) :**
- [x] Conditions Si/Sinon avec branches visuelles (Oui/Non côte à côte)
- [x] Nouveau step type `wait_for_event` — pause jusqu'à X heures avant un événement
- [x] Events supportés : `before_call`, `before_booking`
- [x] Engine mis à jour pour exécuter les branches + attendre des events
- [x] Migration SQL `007_workflow_branching.sql`
- [ ] **Exécuter migration 007 dans Supabase**
- [ ] Tester branching end-to-end (condition → branche Oui → actions / branche Non → actions)
- [ ] Tester wait_for_event avec un vrai booking planifié

**Builder visuel (refait le 01/04) :**
- [x] Drag & drop pour réordonner les steps (dnd-kit, poignée dédiée)
- [x] Bouton `+` entre chaque step pour insérer à la bonne position
- [x] Insertion correcte (décalage des steps suivants côté API)
- [x] Branches visuelles Oui/Non après une condition
- [x] Blocs `wait_for_event` (orange) dans le builder
- [ ] Polish UI : améliorer les connecteurs visuels entre branches

**Cron scheduler :**
- [x] `/api/cron/workflow-scheduler` — reprend les exécutions pausées (delay steps + wait_for_event)

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

---

### 6c. Branding dynamique
**Statut :** ✅ Terminé (2026-03-31)

- [x] Migration SQL : `accent_color` + `logo_url` dans workspaces + bucket `workspace-logos`
- [x] `BrandingInjector` — injection dynamique de CSS variables
- [x] `BrandingForm` — presets couleurs (12 couleurs) + hex custom + preview live
- [x] Refactor global : couleurs hardcodées → CSS variables `var(--color-primary)`
- [x] Logo affiché dans la sidebar si configuré

---

### 7. T-019 · Paramètres — Page Intégrations
**Priorité :** Basse
**Statut :** ✅ Terminé (2026-03-30)

- [x] Card par service : Telegram, WhatsApp, Meta, Google Agenda, Stripe
- [x] Modale de connexion (Telegram: bot token + chat ID, WhatsApp: phone ID + access token)
- [x] Validation automatique des credentials
- [x] Toggle actif/inactif + déconnexion avec confirmation
- [x] Chiffrement des credentials en base
- [x] **Card Domaine Email** ajoutée (01/04) — config domaine custom Resend

---

### 8. T-022 · Module Calendrier / Booking (type Calendly)
**Priorité :** Haute
**Statut :** 🔄 En cours — code implémenté, migrations SQL ✅, tests E2E restants
**Spec :** `docs/superpowers/specs/2026-03-30-agenda-booking-design.md`

- [x] Base de données + migrations
- [x] API CRUD booking-calendars + bookings
- [x] API publique booking
- [x] Agenda vues Jour/Semaine/Mois
- [x] Page booking public Calendly-style
- [x] Google Calendar sync
- [x] Planning Templates (éditeur hebdomadaire)
- [ ] Tester end-to-end
- [ ] Ajouter champ slug workspace dans page Réglages

---

### 9. T-020 · Module Emails (séquences + broadcast)
**Priorité :** Moyenne
**Statut :** 🔄 En cours (code complet, reste polish + tests)
**Spec :** `docs/superpowers/specs/2026-03-31-email-module-design.md`

**Base de données :**
- [x] Migration SQL `006_email_module.sql` — 5 tables + champs leads
- [x] **Migration exécutée dans Supabase** ✅

**Domaines custom (Resend) :**
- [x] API CRUD `/api/emails/domains` + verify
- [x] Composant `DomainSetup` — 3 états (vide → DNS pending → vérifié)
- [x] Intégré dans page Intégrations
- [ ] Tester avec un vrai domaine (ajout DNS + vérification)

**Templates email (drag & drop builder) :**
- [x] API CRUD `/api/emails/templates` + preview HTML
- [x] 6 composants blocs (Header, Text, Image, Button, Divider, Footer)
- [x] Builder drag & drop (dnd-kit) avec palette de blocs
- [x] Preview live desktop/mobile (iframe)
- [x] Compilateur JSON → HTML responsive (`src/lib/email/compiler.ts`)
- [x] Pages : liste templates + éditeur
- [ ] Polish : améliorer l'UX du builder (TipTap rich text au lieu de textarea brut)

**Séquences email :**
- [x] API CRUD `/api/emails/sequences` + enroll leads
- [x] Composant `SequenceTimeline` (emails + délais)
- [x] Pages : liste + éditeur timeline
- [ ] Connecter à l'engine workflow (exécution réelle des séquences via cron)
- [ ] Tester : inscrire un lead → vérifier envoi email 1, délai, email 2...

**Broadcasts (campagnes ponctuelles) :**
- [x] API CRUD `/api/emails/broadcasts` + send batch + preview count
- [x] Composant `BroadcastFilterBuilder` (filtres dynamiques)
- [x] Pages : liste campagnes + création
- [x] Batch sender avec rate limiting (`src/lib/email/batch-sender.ts`)
- [ ] Tester : créer campagne → filtres → envoi → vérifier logs `email_sends`

**Stats & tracking :**
- [x] Webhook Resend (`/api/webhooks/resend`) — 5 events
- [x] API stats `/api/emails/stats` (agrégations par période)
- [x] Dashboard emails avec KPIs placeholder
- [ ] Configurer le webhook dans Resend dashboard (URL production)
- [ ] Brancher les vraies stats dans le dashboard (remplacer les "—")

**Désinscription :**
- [x] API `/api/unsubscribe` (validation token + update lead)
- [x] Page publique `/unsubscribe` (confirmation)
- [x] Tokens signés HMAC (`src/lib/email/unsubscribe.ts`)
- [x] Champs `email_unsubscribed` + `email_unsubscribed_at` sur leads

**Navigation :**
- [x] Entrée "Emails" dans la sidebar (sous Acquisition)
- [x] Tabs : Dashboard / Templates / Séquences / Campagnes

---

### 10. T-021 · Instagram Automations
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
| 4 | Automations/Workflows (T-014) | Moyenne | 🔄 (branching + polish) |
| 5 | Notifications WhatsApp/Telegram (T-016) | Moyenne | ✅ |
| 6 | Paramètres Réglages (T-018) | Basse | ✅ |
| 6b | Dark/Light Mode | — | ✅ |
| 6c | Branding dynamique | — | ✅ |
| 7 | Paramètres Intégrations (T-019) | Basse | ✅ |
| 8 | Calendrier/Booking (T-022) | Haute | 🔄 (tests E2E restants) |
| 9 | Emails séquences + broadcast (T-020) | Moyenne | 🔄 (code complet, tests restants) |
| 10 | Instagram Automations (T-021) | Moyenne | ⬜ |

**Score : 8/12 terminées · 3 en cours · 1 non démarrée**

---

## Ce qui reste à faire (priorisé)

### Migrations SQL à exécuter dans Supabase
1. `007_workflow_branching.sql` — branching + wait_for_event

### Tests end-to-end à faire
1. **T-014 Automations** — branching (condition → Oui/Non) + wait_for_event
2. **T-020 Emails** — domaine custom + template builder + séquence + broadcast + stats webhook
3. **T-022 Booking** — booking public + Google Calendar sync

### Polish UI restant
1. **T-014** — connecteurs visuels entre branches
2. **T-020** — TipTap rich text dans le builder templates + stats dashboard réelles
3. **T-020** — Configurer webhook Resend en production

---

*Mis à jour le 2026-04-01 — ClosRM*

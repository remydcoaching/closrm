# Tâches Pierre — ClosRM V1

> Toutes les tâches de Pierre, dans l'ordre. Chaque module = API + Frontend, autonome.
> Dernière mise à jour : 2026-03-27

---

## Ordre de développement

### 1. T-002 · Auth — Finaliser le système
**Priorité :** Critique (débloque tout)
**Statut :** ✅ Terminé (2026-03-27)

**À faire :**
- [ ] Tester flow complet : inscription → création workspace → redirection dashboard
- [ ] Page reset password (`/reset-password`) avec `resetPasswordForEmail`
- [ ] Lien "Mot de passe oublié" sur la page login
- [ ] Hook `useUser()` → retourne user + workspace_id côté client
- [ ] Helper `getWorkspaceId()` → retourne workspace_id côté serveur (pour toutes les API routes)
- [ ] Validation inputs (email format, password 8 chars min)
- [ ] Gestion erreur "email déjà utilisé" à l'inscription
- [ ] Vérifier que le middleware protège TOUTES les routes dashboard

**Fichiers à créer :**
- `src/hooks/use-user.ts`
- `src/lib/supabase/get-workspace.ts`
- `src/app/(auth)/reset-password/page.tsx`

**Fichiers à modifier :**
- `src/app/(auth)/login/page.tsx`
- `src/app/(auth)/register/page.tsx`

---

### 2. T-007 · Module Closing — API + Frontend
**Priorité :** Haute
**Statut :** ⬜ Non démarré

**API (`/api/calls`) :**
- [ ] `GET /api/calls` — liste avec filtres (type, outcome, date range, lead_id)
- [ ] `POST /api/calls` — planifier un appel
- [ ] `GET /api/calls/[id]` — détail
- [ ] `PATCH /api/calls/[id]` — modifier (outcome, notes, reached, duration)
- [ ] `DELETE /api/calls/[id]` — supprimer

**Logique métier :**
- Créer call setting → lead passe en `setting_planifie`
- Créer call closing → lead passe en `closing_planifie`
- Outcome `done` + closing → lead passe en `clos`
- Outcome `no_show` → lead passe en `no_show_setting` ou `no_show_closing`
- `attempt_number` s'incrémente auto par lead

**Frontend (page `/closing`) :**
- [ ] 4 onglets : À venir / À actualiser / Traités / Annulés-Absents
- [ ] Toggle vue Liste ↔ Calendrier
- [ ] Par appel : nom lead, contact, closer, date/heure, statut (badge), actions
- [ ] Actions : Appeler, Reprogrammer (modale), Marquer résultat, Voir fiche
- [ ] Modale reprogrammer un appel

**Composants à créer :**
- `src/components/closing/closing-tabs.tsx`
- `src/components/closing/closing-table.tsx`
- `src/components/closing/closing-calendar.tsx`
- `src/components/closing/call-card.tsx`
- `src/components/closing/reschedule-modal.tsx`
- `src/components/closing/mark-outcome-dropdown.tsx`

---

### 3. T-008 · Module Follow-ups — API + Frontend
**Priorité :** Haute
**Statut :** ⬜ Non démarré

**API (`/api/follow-ups`) :**
- [ ] `GET /api/follow-ups` — liste avec filtres (status, channel, lead_id, date range)
- [ ] `POST /api/follow-ups` — créer
- [ ] `PATCH /api/follow-ups/[id]` — modifier (statut, notes, date)
- [ ] `DELETE /api/follow-ups/[id]` — supprimer

**Frontend (page `/follow-ups`) :**
- [ ] Tableau : nom lead, raison, date prévue, canal (icône), statut (badge), notes, actions
- [ ] Filtres : par statut, canal, date range
- [ ] Tri par date (plus urgent en premier)
- [ ] Bouton "Créer un follow-up" → modale (sélection lead, raison, canal, date)
- [ ] Actions : Marquer fait, Reprogrammer, Annuler, Voir fiche lead

**Composants à créer :**
- `src/components/follow-ups/followup-table.tsx`
- `src/components/follow-ups/followup-filters.tsx`
- `src/components/follow-ups/add-followup-modal.tsx`

---

### 4. T-014 · Module Automations — API + Frontend
**Priorité :** Moyenne
**Statut :** ⬜ Non démarré

**API (`/api/automations`) :**
- [ ] `GET /api/automations` — liste
- [ ] `POST /api/automations` — créer
- [ ] `PATCH /api/automations/[id]` — modifier / activer / désactiver
- [ ] `DELETE /api/automations/[id]` — supprimer

**Triggers :** new_lead, rdv_planifie, rdv_in_x_hours, lead_status_changed, followup_pending_x_days, à envoyer "x mot" en. story ou en dm ou a commenter sous uns post. 
**Actions :** send_whatsapp, send_email, create_followup, change_lead_status, send_notification, send message instagram

**Frontend (page `/acquisition/automations`) :**
- [ ] Liste des automations avec toggle actif/inactif
- [ ] Builder : sélection trigger + config + action + config
- [ ] Config dynamique selon trigger et action sélectionnés
- [ ] Templates de messages avec variables ({{prenom}}, {{date_rdv}}, etc.)

**Composants à créer :**
- `src/components/automations/automation-list.tsx`
- `src/components/automations/automation-builder.tsx`
- `src/components/automations/trigger-config.tsx`
- `src/components/automations/action-config.tsx`

---

### 5. T-013 · Intégration Meta Ads
**Priorité :** Moyenne
**Statut :** ⬜ Non démarré

- [ ] OAuth Meta Business (bouton "Connecter" dans Paramètres)
- [ ] Webhook `/api/webhooks/meta` pour recevoir leads en temps réel
- [ ] Mapping Meta lead → table leads (prénom, nom, email, phone, source, campaign_id, adset_id, ad_id)
- [ ] Stocker credentials chiffrés dans table integrations
- [ ] Client Meta Marketing API (`src/lib/meta/client.ts`)
- [ ] Endpoint stats campagnes (budget, dépensé, CPL)

**Fichiers à créer :**
- `src/app/api/webhooks/meta/route.ts`
- `src/app/api/integrations/meta/route.ts`
- `src/lib/meta/client.ts`

---

### 6. T-016 · Notifications WhatsApp + Telegram
**Priorité :** Moyenne
**Statut :** ⬜ Non démarré

- [ ] Client WhatsApp Meta Cloud API (`src/lib/whatsapp/client.ts`)
- [ ] Client Telegram Bot API (`src/lib/telegram/client.ts`)
- [ ] API route envoi WhatsApp (`/api/notifications/whatsapp`)
- [ ] API route envoi Telegram (`/api/notifications/telegram`)
- [ ] Templates messages avec variables dynamiques

---

### 7. T-018 · Paramètres — Réglages
**Priorité :** Basse
**Statut :** ⬜ Non démarré

**API :**
- [ ] `PATCH /api/user/profile` — modifier profil (nom, avatar)
- [ ] `PATCH /api/workspaces` — modifier workspace (nom, timezone)
- [ ] `DELETE /api/user/account` — supprimer compte + workspace

**Frontend (page `/parametres/reglages`) :**
- [ ] Formulaire profil (nom, email, photo — upload Supabase Storage)
- [ ] Formulaire workspace (nom, fuseau horaire)
- [ ] Section suppression compte avec confirmation

**Composants à créer :**
- `src/components/settings/profile-form.tsx`
- `src/components/settings/workspace-form.tsx`
- `src/components/settings/delete-account.tsx`

---

### 8. T-019 · Paramètres — Page Intégrations
**Priorité :** Basse
**Statut :** ⬜ Non démarré

**Frontend (page `/parametres/integrations`) :**
- [ ] Card par service : Google Agenda, Meta, WhatsApp, Stripe (V2 grisé), Telegram
- [ ] Chaque card : icône, nom, description, statut (connecté/non), date connexion, bouton action
- [ ] Boutons Connecter/Déconnecter (appellent les API d'intégration de Rémy pour Meta/Google)

---

## Résumé

| # | Tâche | Priorité | Statut |
|---|-------|----------|--------|
| 1 | Auth | Critique | ✅ |
| 2 | Closing (API + Frontend) | Haute | 🔄 |
| 3 | Follow-ups (API + Frontend) | Haute | 🔄 |
| 4 | Automations (API + Frontend) | Moyenne | ⬜ |
| 5 | Intégration Meta Ads | Moyenne | ⬜ |
| 6 | Notifications | Moyenne | ⬜ |
| 7 | Paramètres Réglages | Basse | ⬜ |
| 8 | Paramètres Intégrations | Basse | ⬜ |

---

*Créé le 2026-03-27 — ClosRM*

# Tâches Pierre — ClosRM V1

> Toutes les tâches de Pierre, dans l'ordre. Chaque module = API + Frontend, autonome.
> Dernière mise à jour : 2026-03-30

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

### 5. T-016 · Notifications WhatsApp + Telegram
**Priorité :** Moyenne
**Statut :** ⬜ Non démarré

- [ ] Client WhatsApp Meta Cloud API (`src/lib/whatsapp/client.ts`)
- [ ] Client Telegram Bot API (`src/lib/telegram/client.ts`)
- [ ] API route envoi WhatsApp (`/api/notifications/whatsapp`)
- [ ] API route envoi Telegram (`/api/notifications/telegram`)
- [ ] Templates messages avec variables dynamiques

---

### 6. T-021 · Instagram Automations
**Priorité :** Moyenne
**Statut :** ⬜ Non démarré

- [ ] Envoi automatique de follow en story / DM / commentaire sous un post
- [ ] Intégration Instagram Graph API
- [ ] Config des triggers : réponse à un mot-clé en story, DM, commentaire
- [ ] Actions automatisées selon le trigger
- [ ] Templates messages avec variables dynamiques

**Fichiers à créer :**
- `src/app/api/instagram/route.ts`
- `src/lib/instagram/client.ts`
- `src/components/instagram/`

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
| 1 | Auth (T-002) | Critique | ✅ |
| 2 | Closing (T-007) | Haute | ✅ |
| 3 | Follow-ups (T-008) | Haute | ✅ |
| 4 | Automations (T-014) | Moyenne | ⬜ |
| 5 | Notifications WhatsApp/Telegram (T-016) | Moyenne | ⬜ |
| 6 | Instagram Automations (T-021) | Moyenne | ⬜ |
| 7 | Paramètres Réglages (T-018) | Basse | ⬜ |
| 8 | Paramètres Intégrations (T-019) | Basse | ⬜ |

---

*Créé le 2026-03-27 — ClosRM*

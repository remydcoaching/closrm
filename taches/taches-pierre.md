# Tâches Pierre — ClosRM

> Toutes les tâches de Pierre, dans l'ordre. Chaque module = API + Frontend, autonome.
> Dernière mise à jour : 2026-04-07

---

## Tâches terminées

| # | Tâche | Statut | Date |
|---|-------|--------|------|
| T-002 | Auth + Landing + refonte visuelle | ✅ | 2026-03-27 |
| T-007 | Module Closing | ✅ | 2026-03-28 |
| T-008 | Module Follow-ups | ✅ | 2026-03-28 |
| T-014 | Automations / Workflows v1 (13 actions, branching, builder visuel refait le 01/04) | ✅ | 2026-03-30 → 2026-04-01 |
| T-016 | Notifications WhatsApp + Telegram | ✅ | 2026-03-30 |
| T-018 | Paramètres Réglages + Dark/Light Mode + Branding dynamique | ✅ | 2026-03-30 → 2026-03-31 |
| T-019 | Paramètres Intégrations | ✅ | 2026-03-30 |
| T-020 | Module Emails (séquences + broadcast + templates + domaines custom) | ✅ | 2026-04-01 |
| T-022 | Calendrier / Booking + Google Calendar sync + Planning Templates | ✅ | 2026-03-31 |
| T-023 | Module Réseaux Sociaux (Instagram) + DMs + Funnels v1 | ✅ | 2026-04-02 |
| T-024 | Audit Instagram + Performance + 90 PRs + Commentaires + Publication + Crons IG + Agenda timeline + Templates drag&drop | ✅ | 2026-04-05 → 2026-04-07 |

---

## Tâches en cours / à faire

### T-021 · Instagram Automations
**Priorité :** Moyenne
**Statut :** ⬜ Non démarré

- [ ] Trigger workflow `comment_keyword` (réponse auto à un mot-clé sous un post)
- [ ] Trigger workflow `dm_keyword`
- [ ] Compléter le stub `send_dm_instagram` dans les workflows
- [ ] Config UI dans le builder Automations

---

### T-029 · Automations v2 — Refonte / extensions ⭐ NOUVELLE
**Priorité :** Haute (en parallèle de T-028 Rémy Funnels v2)
**Statut :** ⬜ Non démarré
**Fiche détaillée :** `taches/tache-029-automations-v2.md`

**Résumé :**
- Nouveaux triggers : `lead_imported`, `lead_with_ig_handle`, `booking_no_show`, `lead_inactive_x_days`
- Nouvelles actions : `send_dm_instagram` (compléter), `create_google_meet` (T-030), `update_lead_field`, `wait_until_date`
- Builder UX : connecteurs visuels branches, dry-run, vue tableau exécutions, re-run failed
- Observability : logs détaillés, métriques par workflow, alertes
- **Coordination Rémy :** payload "workflow inline" pour T-027, trigger `lead_imported` pour T-031

---

### T-030 · Booking → création automatique d'un Google Meet ⭐ NOUVELLE
**Priorité :** Haute
**Statut :** ⬜ Non démarré
**Fiche détaillée :** `taches/tache-030-booking-auto-google-meet.md`

**Résumé :**
- Distinguer `booking_locations.location_type: 'in_person' | 'online'`
- À la création d'un booking en ligne → `events.insert` Google Calendar avec
  `conferenceData.createRequest` → Meet auto
- Stocker `bookings.meet_url`
- Diffuser le lien dans les emails de confirmation prospect + coach
- Sync annulation / reprogrammation
- Migration SQL nécessaire (colonne `location_type` + `meet_url`)

---

## Backlog / pending (déjà créé, polish restant)

- [ ] **T-014 polish** — connecteurs visuels entre branches du builder Workflows
- [ ] **T-020 polish** — TipTap rich text dans le builder templates emails
- [ ] **T-020 polish** — configurer le webhook Resend en production
- [ ] **T-020 polish** — brancher les vraies stats dans le dashboard emails
- [ ] **T-022 polish** — tests E2E booking public + sync Google Calendar
- [ ] **T-022 polish** — ajouter le slug workspace dans la page Réglages

---

## Résumé

| # | Tâche | Priorité | Statut |
|---|-------|----------|--------|
| T-021 | Instagram Automations | Moyenne | ⬜ |
| **T-029** | **Automations v2** | **Haute** | **⬜** |
| **T-030** | **Booking → auto Google Meet** | **Haute** | **⬜** |
| Polish T-014 / T-020 / T-022 | Backlog | Basse | ⬜ |

---

*Mis à jour le 2026-04-07 — ClosRM*

# État du projet — ClosRM

> Fichier mis à jour obligatoirement à la fin de chaque tâche.
> Dernière mise à jour : 2026-04-02 (T-023 Instagram Social Module — Pierre)

---

## Statut global

**Phase actuelle :** Développement V1
**Version :** 0.3
**Branche principale active :** `develop`
**Branche feature active :** `feature/pierre-funnel-builder`

---

## Modules — État d'avancement

| Module | Responsable | Statut | Tâche(s) |
|--------|-------------|--------|----------|
| Setup projet (Next.js + Supabase + Auth + Layout) | Rémy | ✅ Terminé | — |
| Auth (login, register, reset, middleware, hooks) | Pierre | ✅ Terminé | T-002 |
| Landing page | Pierre | ✅ Terminé | T-002 |
| Refonte visuelle (design system vert) | Pierre | ✅ Terminé | T-002 |
| Module Leads — Liste + API | Rémy | ✅ Terminé | T-004 |
| Module Leads — Fiche lead | Rémy | ✅ Terminé | T-004 |
| Dashboard d'accueil (vraies données) | Rémy | ✅ Terminé | T-003 |
| Module Closing — API + Frontend | Pierre | ✅ Terminé | T-007 |
| Module Follow-ups — API + Frontend | Pierre | ✅ Terminé | T-008 |
| Module Statistiques | Rémy | ✅ Terminé | T-011 |
| Base de données (vue globale) | Rémy | ✅ Terminé | T-012 |
| Module Automations (Workflows) | Pierre | 🔄 En cours (branching + polish) | T-014 |
| Notifications WhatsApp/Telegram/Email | Pierre | ✅ Terminé | T-016 |
| Paramètres Réglages | Pierre | ✅ Terminé | T-018 |
| Paramètres Intégrations | Pierre | ✅ Terminé | T-019 |
| Dark/Light Mode | Pierre | ✅ Terminé | — |
| Branding dynamique (couleur + logo) | Pierre | ✅ Terminé | — |
| Intégration Meta Ads (Bloc A — OAuth + webhook + UI) | Rémy | ✅ Terminé (webhook Meta non livré en mode Dev) | T-013 |
| Intégration Google Calendar | Pierre | ✅ Terminé | T-022 |
| Module Publicités (Meta Ads dashboard) | Rémy | ⬜ Non démarré | T-017 |
| **Module Emails (séquences + broadcast)** | **Pierre** | **🔄 En cours (code complet, tests restants)** | **T-020** |
| Module Calendrier / Booking (type Calendly) | Pierre | 🔄 En cours (tests E2E restants) | T-022 |
| Instagram Automations | Pierre | ⬜ Non démarré | T-021 |
| **Module Réseaux Sociaux (Instagram)** | **Pierre** | **✅ Terminé** | **T-023** |
| **Module Messages (DMs Instagram)** | **Pierre** | **✅ Terminé** | **T-023** |
| V2 — Tunnels | — | 🔒 Bloqué (V2) | — |
| V2 — Stripe | — | 🔒 Bloqué (V2) | — |
| V2 — Multi-membres équipe | — | 🔒 Bloqué (V2) | — |

**Légende :** ✅ Terminé · 🔄 En cours · ⬜ Non démarré · 🔒 Bloqué (V2)

---

## Historique des tâches complétées

| Date | Développeur | Tâche | Branche |
|------|-------------|-------|---------|
| 2026-03-27 | Rémy | Setup initial projet | `main` |
| 2026-03-27 | Pierre | T-001 — Roadmap & priorisation | `feature/pierre-fix-layout` |
| 2026-03-27 | Pierre | T-002 — Auth + refonte visuelle | `feature/pierre-auth-system` |
| 2026-03-27 | Rémy | T-004 — Module Leads | `feature/remy-module-leads` |
| 2026-03-28 | Pierre | T-007 — Module Closing + Follow-ups | `feature/pierre-closing` |
| 2026-03-28 | Rémy | T-003 — Dashboard d'accueil | `feature/remy-dashboard` |
| 2026-03-28 | Rémy | T-011 — Module Statistiques | `feature/remy-dashboard` |
| 2026-03-28 | Rémy | T-012 — Base de données | `feature/remy-database` |
| 2026-03-30 | Rémy | T-013 — Meta Ads Bloc A (en attente tests) | `feature/remy-meta-ads` |
| 2026-03-30 | Pierre | T-014 — Automations/Workflows v1 | `feature/pierre-automations` |
| 2026-03-30 | Pierre | T-016 — Notifications WhatsApp/Telegram | `feature/pierre-automations` |
| 2026-03-30 | Pierre | T-018 — Paramètres Réglages | `feature/pierre-automations` |
| 2026-03-30 | Pierre | T-019 — Paramètres Intégrations | `feature/pierre-automations` |
| 2026-03-31 | Pierre | T-022 — Calendrier/Booking + Google Calendar + Planning Templates | `feature/pierre-automations` |
| 2026-04-01 | Pierre | T-020 — Module Emails (domaines, templates, séquences, broadcasts, stats) | `feature/pierre-email-module` |
| 2026-04-01 | Pierre | T-014 v2 — Automations : branching, wait_for_event, 13 actions, builder refait | `feature/pierre-email-module` |
| 2026-04-02 | Pierre | T-023 — Module Réseaux Sociaux (Instagram) + Messages | `feature/pierre-funnel-builder` |

---

*Mis à jour le 2026-04-02 par Claude Code — ClosRM*

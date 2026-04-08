# État du projet — ClosRM

> Fichier mis à jour obligatoirement à la fin de chaque tâche.
> Dernière mise à jour : 2026-04-07 (planification T-027 → T-031 + abandon T-026)

---

## Statut global

**Phase actuelle :** Développement V1 (finalisation)
**Version :** 0.4
**Branche principale active :** `develop`

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
| Module Automations (Workflows) | Pierre | ✅ Terminé | T-014 |
| Notifications WhatsApp/Telegram/Email | Pierre | ✅ Terminé | T-016 |
| Paramètres Réglages | Pierre | ✅ Terminé | T-018 |
| Paramètres Intégrations | Pierre | ✅ Terminé | T-019 |
| Dark/Light Mode | Pierre | ✅ Terminé | — |
| Branding dynamique (couleur + logo) | Pierre | ✅ Terminé | — |
| Intégration Meta Ads (OAuth + webhook + UI) | Rémy | ✅ Terminé | T-013 |
| Intégration Google Calendar | Pierre | ✅ Terminé | T-022 |
| Module Publicités (Meta Ads dashboard) | Rémy | ✅ Terminé | T-017 |
| **Module Publicités v2 — Leadform/Follow Ads + santé** | **Rémy** | **✅ Terminé** | **T-025** |
| **Source `follow_ads` + channel `instagram_dm`** | **Rémy** | **✅ Terminé** | **A-007** |
| Module Emails (séquences + broadcast) | Pierre | ✅ Terminé | T-020 |
| Module Calendrier / Booking | Pierre | ✅ Terminé | T-022 |
| Module Réseaux Sociaux (Instagram) | Pierre | ✅ Terminé | T-023, T-024 |
| Module Messages (DMs Instagram) | Pierre | ✅ Terminé | T-023, T-024 |
| Module Commentaires (Instagram) | Pierre | ✅ Terminé | T-024 |
| Publication Instagram (Post/Reel/Story) | Pierre | ✅ Terminé | T-024 |
| Planification auto Instagram (cron) | Pierre | ✅ Terminé | T-024 |
| Sync auto Instagram (cron horaire) | Pierre | ✅ Terminé | T-024 |
| Performance (Server Components + optimisations) | Pierre | ✅ Terminé | T-024 |
| Agenda : ligne de temps + notifications | Pierre | ✅ Terminé | T-024 |
| Templates agenda : copier-coller + drag & drop | Pierre | ✅ Terminé | T-024 |
| Instagram Automations (trigger comment_keyword) | Pierre | ⬜ Non démarré | T-021 |
| **Lead++ (workflow inline + pseudo IG + chaîne + Messages)** ⚠️ touche module Leads de Rémy | **Pierre** (réassignée le 2026-04-07) | **⬜ Non démarré** | **T-027** |
| **Funnels v2 — Direction artistique (presets + 15 effets)** | **Rémy** | **✅ Terminé** (2026-04-07, branche pushée) | **T-028a** |
| **Funnels v2 — Migration des 12 blocs** | **Rémy** | **✅ Terminé** (2026-04-07, branche pushée) | **T-028c** |
| **Funnels v2 — Refonte builder UX** | **Rémy** | **✅ Terminé** (2026-04-07, branche pushée) | **T-028b** |
| **Automations v2 (triggers/actions, observability)** | **Pierre** | **⬜ Non démarré** | **T-029** |
| **Booking → auto Google Meet (en ligne)** | **Pierre** | **⬜ Non démarré** | **T-030** |
| **Import portefeuille leads (CSV + alternatives)** | **Rémy** | **⬜ Non démarré** | **T-031** |
| Followers-as-prospects (V2) | Rémy | ❌ Abandonné (API IG) | T-026 |
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
| 2026-03-30 | Rémy | T-013 — Meta Ads Bloc A (OAuth + webhook + UI intégrations) | `feature/remy-meta-ads` |
| 2026-03-30 | Pierre | T-014 — Automations/Workflows v1 | `feature/pierre-automations` |
| 2026-03-30 | Pierre | T-016 — Notifications WhatsApp/Telegram | `feature/pierre-automations` |
| 2026-03-30 | Pierre | T-018 — Paramètres Réglages | `feature/pierre-automations` |
| 2026-03-30 | Pierre | T-019 — Paramètres Intégrations | `feature/pierre-automations` |
| 2026-03-31 | Pierre | T-022 — Calendrier/Booking + Google Calendar + Planning Templates | `feature/pierre-automations` |
| 2026-04-01 | Pierre | T-020 — Module Emails | `feature/pierre-email-module` |
| 2026-04-01 | Pierre | T-014 v2 — Automations : branching, 13 actions, builder refait | `feature/pierre-email-module` |
| 2026-04-01 | Rémy | T-017 — Module Publicités (Meta Ads Dashboard) | `feature/remy-meta-ads` |
| 2026-04-02 | Pierre | T-023 — Module Réseaux Sociaux (Instagram) + Messages | `feature/pierre-funnel-builder` |
| 2026-04-05→07 | Pierre | T-024 — Audit Instagram + Performance + 90 PRs | `feature/pierre-funnel-builder` |
| 2026-04-04→07 | Rémy | T-025 — Follow Ads Classification + KPIs adaptés + indicateurs de santé | `feature/remy-follow-ads-classification` |
| 2026-04-07 | Rémy | A-007 — Source `follow_ads` + channel `instagram_dm` (migration 014, types, UI) | `feature/remy-follow-ads-source-channel` |

---

*Mis à jour le 2026-04-07 par Claude Code — ClosRM (planning T-027→T-031, T-026 abandonnée)*

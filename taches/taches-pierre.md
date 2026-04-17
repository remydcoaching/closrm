# Taches Pierre — ClosRM

> Toutes les taches de Pierre, dans l'ordre. Chaque module = API + Frontend, autonome.
> Derniere mise a jour : 2026-04-08

---

## Taches terminees

| # | Tache | Statut | Date |
|---|-------|--------|------|
| T-002 | Auth + Landing + refonte visuelle | ✅ | 2026-03-27 |
| T-007 | Module Closing | ✅ | 2026-03-28 |
| T-008 | Module Follow-ups | ✅ | 2026-03-28 |
| T-014 | Automations / Workflows v1 (13 actions, branching, builder visuel) | ✅ | 2026-03-30 → 2026-04-01 |
| T-016 | Notifications WhatsApp + Telegram | ✅ | 2026-03-30 |
| T-018 | Parametres Reglages + Dark/Light Mode + Branding dynamique | ✅ | 2026-03-30 → 2026-03-31 |
| T-019 | Parametres Integrations | ✅ | 2026-03-30 |
| T-020 | Module Emails (sequences + broadcast + templates) | ✅ | 2026-04-01 |
| T-022 | Calendrier / Booking + Google Calendar sync + Planning Templates | ✅ | 2026-03-31 |
| T-023 | Module Reseaux Sociaux (Instagram) + DMs + Funnels v1 | ✅ | 2026-04-02 |
| T-024 | Audit Instagram + Performance + Commentaires + Publication + Crons IG | ✅ | 2026-04-05 → 2026-04-07 |
| **T-027** | **Lead++ — pseudo IG, relances directes, saisie en chaine, onglet Messages** | **✅** | **2026-04-07** |
| **T-029** | **Automations v2 — 4 triggers, 6 actions, dry-run, historique, observability** | **✅** | **2026-04-07** |
| **T-030** | **Booking → auto Google Meet + 3 types de lieu + email confirmation** | **✅** | **2026-04-07** |
| **T-032** | **Assistant IA de Relance — Guidance + Convert + Brief coach + Self-learning** | **✅** | **2026-04-08** |

---

## Taches en cours / a faire

### T-021 · Instagram Automations
**Priorite :** Moyenne
**Statut :** ⬜ Non demarre (stub send_dm_instagram complete en T-029)

- [ ] Trigger workflow `comment_keyword` (reponse auto a un mot-cle sous un post)
- [ ] Trigger workflow `dm_keyword`
- [ ] Brancher le firing code dans le webhook Instagram
- [ ] Config UI dans le builder Automations

---

## Backlog / polish

- [ ] **A-010** — Linktree interne : liens trackables par lead
- [ ] **A-011** — ~~Champ contenus en 2 colonnes~~ ✅ FAIT (titre + lien)
- [ ] **A-012** — Trigger comment_keyword / dm_keyword (= T-021)
- [ ] **T-014 polish** — connecteurs visuels entre branches du builder Workflows
- [ ] **T-020 polish** — TipTap rich text dans le builder templates emails
- [ ] **T-020 polish** — configurer le webhook Resend en production
- [ ] **T-022 polish** — tests E2E booking public + sync Google Calendar
- [ ] **T-033** — Module Social Analytics (YouTube + TikTok + Instagram) : OAuth YouTube Data API, sync stats vidéos, poster depuis calendrier ClosRM, métriques VA (vues, watch time, CTR), extension TikTok Business API. Effort ~1-2 semaines. Note : la table `lead_magnets` d'A-010 prévoit une colonne `platform` pour être enrichie par ce module sans refactor.

---

## Resume

| # | Tache | Priorite | Statut |
|---|-------|----------|--------|
| T-021 | Instagram Automations (comment/dm keyword) | Moyenne | ⬜ |
| A-010 | Linktree interne (liens trackables) | Moyenne | ⬜ |

---

*Mis a jour le 2026-04-08 — ClosRM*

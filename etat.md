# État du projet — ClosRM

> Fichier mis à jour obligatoirement à la fin de chaque tâche.
> Dernière mise à jour : 2026-03-30 (Revue projet Pierre + Rémy)

---

## Statut global

**Phase actuelle :** Développement V1
**Version :** 0.2
**Branche principale active :** `develop`
**Palette couleur :** Noir (#09090b) + Vert (#00C853)

---

## Modules — État d'avancement

| Module | Responsable | Statut | Tâche(s) associée(s) |
|--------|-------------|--------|----------------------|
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
| Module Automations | Pierre | ⬜ Non démarré | T-014 |
| Intégration Meta Ads (Bloc A — OAuth + webhook + UI) | Rémy | 🔄 En cours (code complet, en attente env vars + tests) | T-013 |
| Intégration Google Agenda | Rémy | ⬜ Non démarré | T-015 |
| Notifications WhatsApp/Telegram | Pierre | ⬜ Non démarré | T-016 |
| Module Publicités (Meta Ads dashboard) | Rémy | ⬜ Non démarré | T-017 |
| Paramètres Réglages | Pierre | ⬜ Non démarré | T-018 |
| Paramètres Intégrations (page UI) | Rémy | 🔄 En cours (page Meta créée, autres en placeholder) | T-013/T-019 |
| Module Emails (séquences + broadcast) | Rémy | ⬜ Non démarré | T-020 |
| Instagram Automations (follow, DM, commentaires ads) | Pierre | ⬜ Non démarré | T-021 |
| Module Calendrier / Booking (type Calendly) | — | ⬜ Non démarré (post-V1) | T-022 |
| V2 — Tunnels | — | 🔒 Bloqué (V2) | — |
| V2 — Stripe | — | 🔒 Bloqué (V2) | — |
| V2 — Multi-membres équipe | — | 🔒 Bloqué (V2) | — |

**Légende :** ✅ Terminé · 🔄 En cours · ⬜ Non démarré · 🔒 Bloqué (V2)

---

## Ce qui existe actuellement

### Infrastructure
- [x] Next.js 16 (App Router + TypeScript)
- [x] Tailwind CSS v4 configuré (avec variables container)
- [x] Supabase connecté (client browser + serveur + middleware)
- [x] Schéma SQL complet (7 tables + RLS + trigger auto-création workspace)
- [x] Types TypeScript complets
- [x] Design system vert (#00C853) + noir (#09090b)

### Auth (T-002 — Pierre)
- [x] Login avec validation Zod + messages d'erreur génériques
- [x] Register avec validation Zod + mapping erreurs (pas d'info disclosure)
- [x] Reset password (demande + update + auth callback)
- [x] Middleware protège TOUTES les routes (whitelist publique)
- [x] Hook `useUser()` côté client
- [x] Helper `getWorkspaceId()` côté serveur
- [x] Try-catch sur getUser() dans middleware

### UI
- [x] Landing page (hero + particules + features + pricing + social proof + CTA + footer)
- [x] Sidebar navigation (collapsible, inline styles)
- [x] Dashboard d'accueil (KPI cards + sections)
- [x] Pages auth refaites (glass card, glow, icônes dans inputs)
- [x] Toutes les pages modules en placeholder

### Module Leads (T-004 — Rémy)
- [x] API `GET/POST /api/leads` (liste paginée + filtres + création)
- [x] API `GET/PATCH/DELETE /api/leads/[id]` (détail + calls + follow_ups + soft delete)
- [x] Validations Zod (`createLeadSchema`, `updateLeadSchema`, `leadFiltersSchema`)
- [x] Page liste `/leads` (tableau dense, filtres, pagination, toggle "joint", actions)
- [x] Fiche lead `/leads/[id]` (infos, statut, tags, notes auto-save, timeline, actions)
- [x] Composants : `StatusBadge`, `SourceBadge`, `LeadFilters`, `LeadForm`, `CallScheduleModal`, `LeadDetail`

### Dashboard (T-003 — Rémy)
- [x] KPI cards branchées Supabase (nouveaux leads, appels planifiés, deals closés, taux closing)
- [x] Sélecteur de période 7j/30j/90j (affecte KPIs uniquement)
- [x] Prochains appels (en retard + aujourd'hui + 7j à venir)
- [x] Follow-ups en retard
- [x] Activité récente (leads créés + appels loggués)
- [x] LeadSidePanel au clic lead (dashboard + liste leads)
- [x] Message de bienvenue avec prénom du coach

### Module Statistiques (T-011 — Rémy)
- [x] Page `/statistiques` branchée Supabase (vraies données)
- [x] 5 KPIs : leads totaux, calls bookés, taux de booking, deals closés, win rate
- [x] Sélecteur période 7j / 30j / 90j / Tout
- [x] Graphique leads par jour (Recharts BarChart)
- [x] Funnel de conversion en 4 étapes (Recharts BarChart)
- [x] Répartition par source (Recharts PieChart donut + légende)
- [x] Section Meta Ads (banner si non connecté, métriques si connecté)

### Ce qui manque (au 30/03/2026)
- [ ] Module Automations — API + Frontend (Pierre — T-014)
- [ ] Intégration Meta Ads — en attente env vars + tests E2E (Rémy — T-013)
- [ ] Intégration Google Agenda — OAuth + sync RDV (Rémy — T-015)
- [ ] Notifications WhatsApp + Telegram (Pierre — T-016)
- [ ] Module Publicités — dashboard Meta Ads (Rémy — T-017)
- [ ] Paramètres Réglages (Pierre — T-018)
- [ ] Paramètres Intégrations (Pierre — T-019)
- [ ] Module Emails — séquences + broadcast (à assigner — T-020)
- [ ] Instagram Automations — follow, DM, commentaires ads (à assigner — T-021)

---

## Prochaines étapes prioritaires

### Pierre (5 tâches)
1. T-014 — Module Automations (API + Frontend)
2. T-016 — Notifications WhatsApp + Telegram
3. T-021 — Instagram Automations (follow, DM, commentaires ads)
4. T-018 — Paramètres Réglages
5. T-019 — Paramètres Intégrations

### Rémy (4 tâches)
1. T-013 — Intégration Meta Ads (OAuth + webhook + stats)
2. T-015 — Intégration Google Agenda (OAuth + sync RDV)
3. T-017 — Module Publicités (dashboard Meta Ads — dépend de T-013)
4. T-020 — Module Emails (séquences + broadcast)

---

## Historique des tâches complétées

| Date | Développeur | Tâche | Branche |
|------|-------------|-------|---------|
| 2026-03-27 | Rémy | Setup initial projet | `main` |
| 2026-03-27 | Pierre | T-001 — Roadmap & priorisation | `feature/pierre-fix-layout` |
| 2026-03-27 | Pierre | T-002 — Auth + refonte visuelle | `feature/pierre-auth-system` |
| 2026-03-27 | Rémy | T-004 — Module Leads (API + Liste + Fiche lead) | `feature/remy-module-leads` |
| 2026-03-28 | Pierre | T-007 — Module Closing + Follow-ups ✅ | `feature/pierre-closing` |
| 2026-03-28 | Rémy | T-003 — Dashboard d'accueil avec vraies données Supabase | `feature/remy-dashboard` |
| 2026-03-28 | Rémy | T-011 — Module Statistiques (page + queries + 6 composants) | `feature/remy-dashboard` |
| 2026-03-28 | Rémy | T-012 — Base de données (vue globale) | `feature/remy-database` |
| 2026-03-30 | Rémy | T-013 — Meta Ads Bloc A (OAuth + webhook + UI intégrations) | `feature/remy-meta-ads` |

---

*Mis à jour par Claude Code — ClosRM*

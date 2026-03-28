# État du projet — ClosRM

> Fichier mis à jour obligatoirement à la fin de chaque tâche.
> Dernière mise à jour : 2026-03-28 (T-011 Rémy — Module Statistiques)

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
| Module Closing — API + Frontend | Pierre | 🔄 En cours (bugs à fix) | T-007 |
| Module Follow-ups — API + Frontend | Pierre | 🔄 En cours (bugs à fix) | T-007 |
| Intégration Meta Ads | Pierre | ⬜ Non démarré | T-013 |
| Module Statistiques | Rémy | ✅ Terminé | T-011 |
| Module Automations | Pierre | ⬜ Non démarré | T-014 |
| Intégration Google Agenda | Rémy | ⬜ Non démarré | — |
| Module Publicités (Meta Ads dashboard) | Rémy | ⬜ Non démarré | — |
| Base de données (vue globale) | Rémy | ✅ Terminé | T-012 |
| Paramètres Réglages | Pierre | ⬜ Non démarré | T-018 |
| Paramètres Intégrations | Pierre | ⬜ Non démarré | T-019 |
| Notifications WhatsApp/Telegram | Pierre | ⬜ Non démarré | T-016 |
| V2 — Tunnels | — | 🔒 Bloqué (V2) | — |
| V2 — Emails | — | 🔒 Bloqué (V2) | — |
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

### Ce qui manque
- [ ] API routes calls, follow-ups, automations (Pierre)
- [ ] Modules Closing, Follow-ups (Pierre)
- [ ] Intégrations tierces (Meta, Google, WhatsApp)
- [ ] Test flow inscription complet (à vérifier manuellement)

---

## Prochaines étapes prioritaires

1. **Pierre** : T-007 — Module Closing (API + Frontend) — bugs à fix
2. **Pierre** : T-008 — Module Follow-ups (API + Frontend)
3. **Rémy** : Intégration Google Agenda ou Module Publicités Meta

---

## Historique des tâches complétées

| Date | Développeur | Tâche | Branche |
|------|-------------|-------|---------|
| 2026-03-27 | Rémy | Setup initial projet | `main` |
| 2026-03-27 | Pierre | T-001 — Roadmap & priorisation | `feature/pierre-fix-layout` |
| 2026-03-27 | Pierre | T-002 — Auth + refonte visuelle | `feature/pierre-auth-system` |
| 2026-03-27 | Rémy | T-004 — Module Leads (API + Liste + Fiche lead) | `feature/remy-module-leads` |
| 2026-03-28 | Pierre | T-007 — Module Closing + Follow-ups (en cours) | `feature/pierre-closing` |
| 2026-03-28 | Rémy | T-003 — Dashboard d'accueil avec vraies données Supabase | `feature/remy-dashboard` |
| 2026-03-28 | Rémy | T-011 — Module Statistiques (page + queries + 6 composants) | `feature/remy-dashboard` |
| 2026-03-28 | Rémy | T-012 — Base de données (vue globale) | `feature/remy-database` |

---

*Mis à jour par Claude Code — ClosRM*

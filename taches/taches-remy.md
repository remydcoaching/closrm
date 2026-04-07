# Tâches Rémy — ClosRM V1

> Toutes les tâches de Rémy, dans l'ordre. Chaque module = API + Frontend, autonome.
> Dernière mise à jour : 2026-04-07

---

## Ordre de développement

### 1. T-004 · Module Leads — API + Frontend
**Priorité :** Critique (cœur du CRM)
**Statut :** ✅ Terminé (2026-03-27)

- [x] API GET/POST /api/leads (liste paginée + filtres + création)
- [x] API GET/PATCH/DELETE /api/leads/[id] (détail + calls + follow_ups + soft delete)
- [x] Page liste /leads (tableau dense, filtres, pagination, toggle joint, actions)
- [x] Fiche lead /leads/[id] (infos, statut, tags, notes, timeline, actions)
- [x] Composants : StatusBadge, SourceBadge, LeadFilters, LeadForm, CallScheduleModal, LeadDetail
- [x] LeadSidePanel au clic lead (dashboard + liste leads)

---

### 2. T-003 · Dashboard d'accueil
**Priorité :** Haute
**Statut :** ✅ Terminé (2026-03-28)

- [x] KPI cards branchées Supabase (nouveaux leads, appels planifiés, deals closés, taux closing)
- [x] Sélecteur de période 7j/30j/90j
- [x] Prochains appels (en retard + aujourd'hui + 7j à venir)
- [x] Follow-ups en retard
- [x] Activité récente (leads créés + appels loggués)
- [x] Message de bienvenue avec prénom du coach

---

### 3. T-011 · Module Statistiques
**Priorité :** Moyenne
**Statut :** ✅ Terminé (2026-03-28)

- [x] Page /statistiques branchée Supabase (vraies données)
- [x] 5 KPIs : leads totaux, calls bookés, taux de booking, deals closés, win rate
- [x] Sélecteur période 7j / 30j / 90j / Tout
- [x] Graphique leads par jour (Recharts BarChart)
- [x] Funnel de conversion 4 étapes (Recharts BarChart)
- [x] Répartition par source (Recharts PieChart donut + légende)
- [x] Section Meta Ads (banner si non connecté, métriques si connecté)

---

### 4. T-012 · Base de données (vue globale)
**Priorité :** Moyenne
**Statut :** ✅ Terminé (2026-03-28)

- [x] API GET /api/contacts (recherche + filtres)
- [x] Page /base-de-donnees (tableau complet)
- [x] Recherche full-text (nom, email, phone)
- [x] Filtres avancés : statut, source, tags, date range
- [x] Export CSV (télécharger fichier)
- [x] DatabaseFilters + DatabaseTable + ExportModal

---

### 5. T-013 · Intégration Meta Ads — Bloc A (OAuth + Webhook Leads)
**Priorité :** Haute
**Statut :** ✅ Terminé (2026-03-30)

- [x] OAuth Meta Business
- [x] Callback OAuth → access_token chiffré
- [x] Webhook /api/webhooks/meta — vérification + réception leads
- [x] Mapping Meta lead form → table leads
- [x] Page Paramètres > Intégrations

---

### 6. T-017 · Module Publicités (dashboard Meta Ads)
**Priorité :** Moyenne
**Statut :** ✅ Terminé (2026-04-01)

- [x] Client Meta Marketing API
- [x] Endpoint stats campagnes (budget, dépensé, CPL, leads générés)
- [x] Performance par plateforme / Campagne / Ad Set / Ad
- [x] Graphique leads/jour Meta + funnel marketing visuel
- [x] Section Meta Ads dans /statistiques

---

### 7. T-025 · Follow Ads Classification + KPIs adaptés + Indicateurs de santé
**Priorité :** Haute
**Statut :** ✅ Terminé (2026-04-07)

- [x] Classification campagnes Leadform vs Follow Ads (objective Meta)
- [x] Toggle 3 positions (Leadform / Follow Ads / Tout)
- [x] KPIs adaptatifs par type de campagne
- [x] Indicateurs de santé color-codés (CPL, CTR, ROAS, CPM, Coût/clic)
- [x] Encadré croissance Instagram (snapshots)
- [x] Mode "Tout" avec sections empilées

---

### 8. A-007 · Sources `follow_ads` + Channel `instagram_dm`
**Priorité :** Haute (suite directe de T-025)
**Statut :** ✅ Terminé (2026-04-07)

- [x] Migration SQL 014 (CHECK constraints leads.source + follow_ups.channel)
- [x] Types TS LeadSource + FollowUpChannel + validations Zod
- [x] SourceBadge + LeadFilters + LeadForm + DatabaseFilters/Table + ExportModal
- [x] BroadcastFilterBuilder + TriggerConfigPanel
- [x] ChannelBadge + AddFollowUpModal + ActionConfigPanel (workflows)
- [x] lib/stats/queries.ts + lib/utils.ts + lib/dashboard/queries.ts
- [x] publicites-client : inclure `follow_ads` dans le filtre lead source

---

### 9. T-026 · Vision V2 — Followers comme prospects (ManyChat-like)
**Priorité :** Moyenne (V2)
**Statut :** ⬜ Non démarré — fiche T-026 à valider

Voir `taches/tache-026-followers-as-prospects.md`.

---

## Résumé

| # | Tâche | Priorité | Statut |
|---|-------|----------|--------|
| 1 | Leads (T-004) | Critique | ✅ |
| 2 | Dashboard (T-003) | Haute | ✅ |
| 3 | Statistiques (T-011) | Moyenne | ✅ |
| 4 | Base de données (T-012) | Moyenne | ✅ |
| 5 | Intégration Meta Ads (T-013) | Haute | ✅ |
| 6 | Publicités dashboard (T-017) | Moyenne | ✅ |
| 7 | Follow Ads classification (T-025) | Haute | ✅ |
| 8 | Sources + channels A-007 | Haute | ✅ |
| 9 | Followers-as-prospects (T-026) | Moyenne | ⬜ |
| — | ~~Emails (T-020)~~ | — | → Pierre ✅ |
| — | ~~Google Agenda (T-015)~~ | — | → Pierre (T-022) ✅ |

---

*Mis à jour le 2026-04-07 — ClosRM*

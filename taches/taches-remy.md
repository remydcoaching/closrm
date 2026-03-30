# Tâches Rémy — ClosRM V1

> Toutes les tâches de Rémy, dans l'ordre. Chaque module = API + Frontend, autonome.
> Dernière mise à jour : 2026-03-30

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
**Statut :** ⬜ Non démarré

- [ ] OAuth Meta Business (bouton Connecter dans Paramètres > Intégrations)
- [ ] Callback OAuth → stocker access_token chiffré dans table integrations
- [ ] Webhook /api/webhooks/meta — vérification token (GET) + réception leads (POST)
- [ ] Mapping Meta lead form → table leads (source: facebook_ads / instagram_ads)
- [ ] Page Paramètres > Intégrations : statut Meta connecté/déconnecté + bouton

**Fichiers à créer :**
- `src/app/api/integrations/meta/route.ts` (OAuth callback)
- `src/app/api/webhooks/meta/route.ts` (webhook leads)
- `src/lib/meta/client.ts` (helpers Meta API)
- `src/app/(dashboard)/parametres/integrations/page.tsx` (page intégrations)

---

### 6. T-015 · Intégration Google Agenda
**Priorité :** Moyenne
**Statut :** ⬜ Non démarré

- [ ] OAuth Google (bouton dans Paramètres)
- [ ] Call planifié dans ClosRM → créer événement Google Agenda
- [ ] Call reprogrammé/annulé → update/delete événement
- [ ] Optionnel : lire events Google pour les afficher dans calendrier

**Fichiers à créer :**
- `src/app/api/integrations/google/route.ts`
- `src/lib/google/client.ts`

---

### 7. T-017 · Module Publicités (dashboard Meta Ads) — Bloc B Meta
**Priorité :** Moyenne (dépend de T-013)
**Statut :** ⬜ Non démarré

- [ ] Client Meta Marketing API (lib/meta/client.ts — partagé avec T-013)
- [ ] Endpoint stats campagnes (budget, dépensé, CPL, leads générés)
- [ ] Budget pub du mois + dépensé
- [ ] Performance par plateforme (Facebook / Instagram)
- [ ] Performance par Campagne / Ad Set / Ad (tableau drill-down)
- [ ] Graphique leads/jour Meta
- [ ] Funnel marketing visuel
- [ ] Brancher section Meta Ads dans /statistiques (MetaStats avec vraies données)

---

### 8. T-020 · Module Emails (séquences + broadcast)
**Priorité :** Moyenne
**Statut :** ⬜ Non démarré

- [ ] Séquences automatiques (type Mailerlite)
- [ ] Broadcast à une liste segmentée
- [ ] Templates d'emails
- [ ] Stats : taux d'ouverture, clics, désinscriptions

**Fichiers à créer :**
- `src/app/(dashboard)/acquisition/emails/`
- `src/app/api/emails/route.ts`
- `src/components/emails/`
- `src/lib/email/`

---

## Résumé

| # | Tâche | Priorité | Statut |
|---|-------|----------|--------|
| 1 | Leads (T-004) | Critique | ✅ |
| 2 | Dashboard (T-003) | Haute | ✅ |
| 3 | Statistiques (T-011) | Moyenne | ✅ |
| 4 | Base de données (T-012) | Moyenne | ✅ |
| 5 | Intégration Meta Ads (T-013) | Haute | ⬜ |
| 6 | Intégration Google Agenda (T-015) | Moyenne | ⬜ |
| 7 | Publicités dashboard (T-017) | Moyenne | ⬜ |
| 8 | Emails séquences + broadcast (T-020) | Moyenne | ⬜ |

---

*Mis à jour le 2026-03-30 — ClosRM*

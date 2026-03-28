# Tâches Rémy — ClosRM V1

> Toutes les tâches de Rémy, dans l'ordre. Chaque module = API + Frontend, autonome.
> Dernière mise à jour : 2026-03-27

---

## Ordre de développement

### 1. T-004 · Module Leads — API + Frontend
**Priorité :** Critique (cœur du CRM)
**Statut :** ⬜ Non démarré

**API (`/api/leads`) :**
- [ ] `GET /api/leads` — liste paginée + filtres (status, source, search, tags, date range)
- [ ] `POST /api/leads` — créer un lead (ajout manuel)
- [ ] `GET /api/leads/[id]` — détail avec calls et follow-ups associés
- [ ] `PATCH /api/leads/[id]` — modifier (statut, infos, tags, notes)
- [ ] `DELETE /api/leads/[id]` — supprimer / archiver
- [ ] `GET /api/leads/stats` — KPIs agrégés (count par statut, source, période)

**Spécifications API :**
- Pagination : `?page=1&per_page=25`
- Filtres : `?status=nouveau,setting_planifie&source=facebook_ads&search=dupont&tag=chaud`
- Tri : `?sort=created_at&order=desc`
- Réponse : `{ data: Lead[], meta: { total, page, per_page, total_pages } }`

**Frontend — Liste Leads (page `/leads`) :**
- [ ] Tableau avec colonnes : date création, prénom/nom, téléphone, email, source, nb tentatives, joint (toggle), statut (badge), tags, actions
- [ ] Filtres : par statut, source, tags, recherche texte
- [ ] Actions par lead : Planifier appel, Voir fiche, Archiver
- [ ] Bouton "Ajouter un lead" → modale de création
- [ ] Pagination

**Frontend — Fiche Lead (page `/leads/[id]`) :**
- [ ] Infos contact complètes (prénom, nom, phone, email, source)
- [ ] Historique de tous les appels (date, durée, résultat, notes)
- [ ] Timeline des interactions (changements statut, appels, follow-ups)
- [ ] Bouton "Appeler" → log auto tentative (incrémente call_attempts)
- [ ] Bouton "Planifier RDV" → modale
- [ ] Champ notes libre éditable
- [ ] Statut actuel + historique des changements
- [ ] Tags éditables (ajout/suppression)
- [ ] Source publicitaire (campagne, ad set, ad — si Meta connecté)

**Composants à créer :**
- `src/components/leads/leads-table.tsx`
- `src/components/leads/lead-filters.tsx`
- `src/components/leads/add-lead-modal.tsx`
- `src/components/leads/lead-status-badge.tsx`
- `src/components/leads/lead-source-badge.tsx`
- `src/components/leads/lead-info-card.tsx`
- `src/components/leads/lead-call-history.tsx`
- `src/components/leads/lead-timeline.tsx`
- `src/components/leads/lead-notes.tsx`
- `src/components/leads/lead-tags-editor.tsx`
- `src/components/leads/schedule-call-modal.tsx`

---

### 2. T-003 · Dashboard d'accueil
**Priorité :** Haute
**Statut :** ⬜ Non démarré

**Frontend (page `/dashboard`) :**
- [ ] Cards KPIs : nouveaux leads, appels planifiés, deals closés, taux closing
- [ ] Liste des prochains appels (aujourd'hui)
- [ ] Liste des follow-ups en retard
- [ ] Accès rapide aux actions (ajouter lead, planifier appel)
- [ ] Message de bienvenue avec nom du coach
- [ ] Sélecteur de période (7j / 30j / 90j)

**Composants à créer :**
- `src/components/dashboard/stats-card.tsx`
- `src/components/dashboard/upcoming-calls.tsx`
- `src/components/dashboard/pending-followups.tsx`

**Note :** Le dashboard affiche des données de plusieurs tables (leads, calls, follow_ups). Rémy crée ses propres queries Supabase directement, pas besoin de passer par les API de Pierre.

---

### 3. T-011 · Module Statistiques
**Priorité :** Moyenne
**Statut :** ⬜ Non démarré

**Frontend (page `/statistiques`) :**
- [ ] KPIs : leads totaux, calls bookés + taux, deals closés + win rate
- [ ] Sélecteur période : 7j / 30j / 90j / tout
- [ ] Graphique leads par jour (Recharts — line chart)
- [ ] Funnel conversion visuel : leads → setting → closing → closé (bar chart)
- [ ] Performance par source : Facebook vs Instagram vs Manuel (pie chart)
- [ ] Coût par lead, ROAS (si Meta connecté — masqué sinon)

**Composants à créer :**
- `src/components/stats/kpi-cards.tsx`
- `src/components/stats/leads-chart.tsx`
- `src/components/stats/funnel-chart.tsx`
- `src/components/stats/source-chart.tsx`
- `src/components/stats/period-selector.tsx`

---

### 4. T-012 · Base de données (vue globale)
**Priorité :** Moyenne
**Statut :** ⬜ Non démarré

**Frontend (page `/base-de-donnees`) :**
- [ ] Recherche full-text (nom, email, phone)
- [ ] Filtres avancés : statut, source, tags, date range, joint/pas joint
- [ ] Export CSV (téléchargement fichier)
- [ ] Historique complet par contact (lien vers fiche lead)
- [ ] Segmentation : grouper par statut, source, tags

---

### 5. T-015 · Intégration Google Agenda
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

### 6. T-017 · Module Publicités (dashboard Meta Ads)
**Priorité :** Basse
**Statut :** ⬜ Non démarré

**Frontend (page `/acquisition/publicites`) :**
- [ ] Budget pub du mois + dépensé
- [ ] Leads générés + coût par lead
- [ ] Performance par plateforme (Facebook / Instagram)
- [ ] Performance par Campagne / Ad Set / Ad (tableau drill-down)
- [ ] Graphique leads/jour
- [ ] Funnel marketing visuel

---

## Résumé

| # | Tâche | Priorité | Statut |
|---|-------|----------|--------|
| 1 | Leads — API + Liste + Fiche (cœur CRM) | Critique | ⬜ |
| 2 | Dashboard d'accueil | Haute | ⬜ |
| 3 | Statistiques | Moyenne | ⬜ |
| 4 | Base de données | Moyenne | ⬜ |
| 5 | Intégration Google Agenda | Moyenne | ⬜ |
| 6 | Publicités (dashboard Meta) | Basse | ⬜ |

---

## Note importante

Pour les API routes, Rémy utilise le même pattern que Pierre :
- Importer `getWorkspaceId()` depuis `src/lib/supabase/get-workspace.ts` (créé par Pierre dans T-002)
- Si Pierre n'a pas encore push ce fichier, créer une version locale temporaire

---

*Créé le 2026-03-27 — ClosRM*

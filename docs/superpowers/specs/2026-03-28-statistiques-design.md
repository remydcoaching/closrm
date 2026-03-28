# Spec — T-011 Module Statistiques

**Date :** 2026-03-28
**Auteur :** Rémy (via brainstorming Claude Code)
**Statut :** Validé — prêt pour implémentation

---

## Contexte

Page `/statistiques` dédiée aux coachs pour analyser leurs performances de vente. Distinct du dashboard (résumé opérationnel) : les stats apportent une vue analytique complète avec graphiques et funnel de conversion.

---

## Architecture

### Pattern
Identique au dashboard existant : **Server Component** pour le fetching + **Client Component** pour l'interactivité.

### Fichiers à créer

```
src/
├── app/(dashboard)/statistiques/
│   └── page.tsx                        # Server Component (fetching + rendu)
├── components/stats/
│   ├── stats-client.tsx                # Client Component (layout, PeriodSelector)
│   ├── kpi-cards.tsx                   # 5 cartes KPI
│   ├── leads-chart.tsx                 # Graphique leads/jour (Recharts)
│   ├── funnel-chart.tsx                # Funnel conversion (Recharts BarChart)
│   ├── source-chart.tsx                # Répartition par source (Recharts PieChart)
│   └── meta-section.tsx               # Section Meta Ads (banner ou métriques)
└── lib/stats/
    └── queries.ts                      # Toutes les queries Supabase stats
```

### Flux de données

```
page.tsx (Server Component)
  ├── lit searchParams.period (défaut: 30)
  ├── getWorkspaceId()
  ├── fetchStatsKpis(workspaceId, period)
  ├── fetchLeadsPerDay(workspaceId, period)
  ├── fetchFunnelData(workspaceId, period)
  ├── fetchSourceData(workspaceId, period)
  ├── fetchMetaStatus(workspaceId)      ← vérifie si Meta est connecté
  └── <StatsClient ... />              ← passe tout en props
```

**Changement de période** : `PeriodSelector` du dashboard est réutilisé — navigue via URL params → Server Component re-render automatique.

---

## Composants & données

### KPI Cards (5 métriques)

| Métrique | Source | Couleur |
|----------|--------|---------|
| Leads totaux | `COUNT(leads)` sur la période | blanc |
| Calls bookés | `COUNT(calls WHERE outcome='pending' OR outcome='done')` | amber `#f59e0b` |
| Taux de booking | `calls_bookés / leads_totaux * 100` | bleu `#3b82f6` |
| Deals closés | `COUNT(leads WHERE status='clos')` | vert `#00C853` |
| Win rate | `deals_closés / calls_bookés * 100` | violet `#a855f7` |

### Graphique Leads par jour (`leads-chart.tsx`)
- **Type :** Recharts `AreaChart` ou `BarChart` (barres avec bordure top verte `#00C853`)
- **Données :** `fetchLeadsPerDay` → `{date: string, count: number}[]` groupé par `DATE(created_at)`
- **Axe X :** dates formatées (ex : "1 mars", "15 mars")
- **Couleur :** `#00C853` avec fill semi-transparent

### Funnel de conversion (`funnel-chart.tsx`)
- **Type :** Recharts `BarChart` vertical (barres décroissantes)
- **Étapes :** Leads → Setting (setting_planifie + no_show_setting) → Closing (closing_planifie + no_show_closing) → Closé
- **Données :** `fetchFunnelData` → counts par groupe de statuts
- **Labels :** valeur absolue + % par rapport au total leads
- **Couleurs :** bleu → amber → violet → vert

### Répartition par source (`source-chart.tsx`)
- **Type :** Recharts `PieChart`
- **Sources :** `facebook_ads`, `instagram_ads`, `formulaire`, `manuel`
- **Couleurs :** Facebook `#1877F2` · Instagram `#E1306C` · Formulaire `#f59e0b` · Manuel `#555`
- **Légende :** inline à droite du pie (source + %)

### Section Meta Ads (`meta-section.tsx`)

**Si Meta NON connecté :**
```
Banner dashed border #1877F2
  [📊 Performance Meta Ads]
  "Connecte ton compte Meta pour voir le coût par lead et le ROAS estimé."
  [Bouton "Connecter Meta →"] → redirige vers /parametres/integrations
```

**Si Meta connecté** (`integrations WHERE type='meta' AND is_active=true`) :
```
Section avec 3 KPI cards style Meta :
  - Coût / lead   (budget_dépensé / leads_meta)
  - ROAS estimé   (revenue_estimé / budget_dépensé)
  - Budget dépensé du mois
```
> Note : les données Meta (budget, dépenses) viennent de l'API Meta Ads — non disponibles en base. Pour V1 : afficher les champs ou un placeholder "Données disponibles via Meta Ads" si l'API n'est pas encore branchée.

---

## Layout

```
[Titre "Statistiques"]          [PeriodSelector: 7j | 30j | 90j | Tout]

[KPI 1] [KPI 2] [KPI 3] [KPI 4] [KPI 5]   ← 5 colonnes

[Leads/jour]  [Funnel conversion]  [Par source]   ← 3 colonnes égales

[Section Meta Ads — banner ou métriques]
```

**Période "Tout"** : pas de filtre `gte` sur `created_at` — retourne toutes les données du workspace depuis sa création.

---

## Réutilisation

- `PeriodSelector` : réutilisé depuis `src/components/dashboard/period-selector.tsx` tel quel
- `getWorkspaceId()` : `src/lib/supabase/get-workspace.ts` (Pierre, T-002)
- Pattern inline styles : cohérent avec le dashboard existant

---

## Ce qui n'est PAS inclus (hors scope T-011)

- Graphiques par campagne/ad set/ad (module Publicités — T-017)
- Filtres avancés par setter/closer (V2)
- Export des stats en CSV (T-012 Base de données)
- Données Meta temps réel (T-017)

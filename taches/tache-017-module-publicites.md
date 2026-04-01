# Tâche 017 — Module Publicités (Meta Ads Dashboard — Bloc B)

**Développeur :** Rémy
**Date de début :** 2026-04-01
**Statut :** ✅ Terminé

## Description

Dashboard de performance Meta Ads en temps réel à `/acquisition/publicites`.

## Objectif

Permettre à un coach de visualiser les performances de ses campagnes Meta Ads (budget, CPL, ROAS, leads/jour, funnel marketing) avec drill-down par campagne, ad set et ad.

## Spec

Spec : `docs/superpowers/specs/2026-04-01-meta-ads-dashboard-design.md`
Plan : `docs/superpowers/plans/2026-04-01-meta-ads-dashboard.md`

Décisions clés :
- Données temps réel via Meta Marketing API (pas de cache V1)
- Layout avec onglets : Vue d'ensemble / Campagnes / Ad Sets / Ads
- Sélecteur de période : Aujourd'hui / 7j / 14j / 30j / 90j / Custom
- Scopes OAuth ajoutés : ads_read, read_insights
- Ad account auto-sélectionné au callback OAuth

## Fichiers créés / modifiés

### Créés
- `src/app/api/meta/insights/route.ts` — API route Marketing API
- `src/app/(dashboard)/acquisition/publicites/publicites-client.tsx` — Client orchestrator
- `src/app/(dashboard)/acquisition/publicites/ads-overview-tab.tsx` — Onglet overview (KPIs + chart + funnel)
- `src/app/(dashboard)/acquisition/publicites/ads-table-tab.tsx` — Tableau campagnes/adsets/ads
- `src/app/(dashboard)/acquisition/publicites/ads-period-selector.tsx` — Sélecteur de période
- `src/app/(dashboard)/acquisition/publicites/ads-meta-banner.tsx` — Banners d'état

### Modifiés
- `src/lib/meta/client.ts` — Scopes OAuth + getAdAccounts + getInsights + types
- `src/app/api/integrations/meta/callback/route.ts` — Ajout sélection ad account
- `src/app/(dashboard)/acquisition/publicites/page.tsx` — Server component (remplace stub)
- `src/lib/stats/queries.ts` — fetchMetaStats avec vraies données Meta

## Variables d'environnement

Même variables que T-013 (pas de nouvelle variable requise).

## Limitation connue

- ROAS affiché comme "—" en V1 (pas de suivi revenu par deal)
- Sélecteur de compte pub automatique (premier actif) — pas de choix UI
- Données Meta non disponibles si l'app est encore en mode Development

## Tâches liées

- T-013 : Meta Ads Bloc A (OAuth + webhook leads) — prérequis
- T-011 : Module Statistiques — MetaSection mise à jour avec vraies données

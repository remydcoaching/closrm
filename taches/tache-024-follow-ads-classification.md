# Tâche 024 — Séparation Leadform / Follow Ads + KPIs adaptés + Indicateurs de santé

**Développeur :** Rémy
**Date de début :** 2026-04-04
**Statut :** ✅ Terminé

## Description

Évolution du module Publicités pour distinguer les campagnes Leadform (acquisition prospects) des campagnes Follow Ads (notoriété/followers). KPIs, graphiques et funnels adaptés par type. Indicateurs de santé color-codés.

## Spec

- Spec : `docs/superpowers/specs/2026-04-04-follow-ads-classification-design.md`
- Plan : `docs/superpowers/plans/2026-04-04-follow-ads-classification.md`

## Fichiers créés / modifiés

### Créés
- `src/app/(dashboard)/acquisition/publicites/health-thresholds.ts` — config seuils + classification
- `src/app/(dashboard)/acquisition/publicites/ads-campaign-type-toggle.tsx` — toggle Leadform/Follow Ads/Tout
- `src/app/(dashboard)/acquisition/publicites/ads-instagram-growth.tsx` — encadré croissance Instagram

### Modifiés
- `src/lib/meta/client.ts` — ajout `objective` dans `MetaAdObject` et `listAdObjects` pour campagnes
- `src/app/api/meta/insights/route.ts` — filtrage par type, KPIs par type, classification
- `src/app/(dashboard)/acquisition/publicites/ads-overview-tab.tsx` — KPIs adaptatifs, points santé, sections empilées
- `src/app/(dashboard)/acquisition/publicites/ads-table-tab.tsx` — colonne Type, colonnes adaptées au mode
- `src/app/(dashboard)/acquisition/publicites/ads-chart-inner.tsx` — chart générique (leads/impressions/spend/clicks)
- `src/app/(dashboard)/acquisition/publicites/publicites-client.tsx` — state campaignType, toggle UI

## Décisions clés

- Classification basée sur `objective` Meta : `OUTCOME_LEADS`/`LEAD_GENERATION` → leadform, `OUTCOME_AWARENESS`/`BRAND_AWARENESS`/`REACH` → follow_ads, autres → other
- Toggle 3 positions (Leadform / Follow Ads / Tout) à côté du sélecteur de période
- Mode "Tout" affiche 2 sections empilées avec leurs KPIs respectifs (deux appels API filtrés en parallèle)
- Indicateurs de santé color-codés (vert/orange/rouge) sur CPL, CTR, ROAS, CPM, Coût/clic
- Croissance Instagram via API existante `/api/instagram/snapshots`

## Vision V2 — Followers comme prospects (ManyChat-like)

À documenter dans `ameliorations.md`. À terme :
- Détection automatique des nouveaux followers Instagram → création d'un lead dans le CRM
- Workflow d'automations DM (DM de bienvenue, séquence nurturing, qualification)
- Attribution follower → campagne source
- Le follower devient un prospect dans le pipeline standard

## Tâches liées

- T-013 : Meta Ads Bloc A (OAuth + webhook) — prérequis
- T-017 : Meta Ads Bloc B (dashboard) — prérequis
- T-023 : Module Instagram (Pierre) — fournit les snapshots

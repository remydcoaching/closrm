# Tâche 050 — Objectifs par horizons (façon Timestripe)

- **Développeur** : Pierre
- **Statut** : Terminée (PR à fusionner, migration 127 à appliquer)
- **Objectif** : planifier ses objectifs par jour, semaine, mois, trimestre et année dans l'app desktop. Chaque période a sa colonne, la colonne de l'horizon parent est à droite, et les sous-objectifs relient les horizons entre eux.

## Spec
`docs/specs/2026-10-objectifs-horizons.md`. On reprend le comportement de Timestripe, dans une version simple voulue par Pierre : des colonnes, sans éditeur riche ni défilement infini. Le lien entre horizons passe uniquement par `parent_id`.

## Fichiers
- `supabase/migrations/127_goals.sql` — nouveau
- `src/lib/validations/goals.ts` et `__tests__/goals.test.ts` — nouveaux
- `src/lib/goals/period.ts` et `api-errors.ts` — nouveaux
- `src/app/api/goals/route.ts` et `[id]/route.ts` — nouveaux
- `electron/renderer/src/features/goals/` — nouveau : `GoalsPage.tsx`, `use-goals.ts`, `periods.ts`, `ordering.ts`, `goals.css` et les tests
- `electron/renderer/src/app/App.tsx`, `lazy-pages.ts`, `design-system/Sidebar.tsx` — modifiés : route et entrée « Objectifs »

## Vérification
- Tests vitest : 13 côté web, 37 pour les objectifs côté desktop, dont le rendu de la page avec l'API simulée. Les 190 tests desktop passent et tsc ne signale rien.
- Route locale : 401 sans session.
- Pas encore essayée avec la vraie base : il faut d'abord appliquer la migration 127.

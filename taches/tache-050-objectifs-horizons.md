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

## Ajouts du 16 au 18 octobre
- **Onglet Horizons** :
  - les colonnes Aujourd'hui, semaine, mois, trimestre, année et Vie (migration 128) ;
  - un swipe sur une colonne change sa période, et les colonnes des horizons plus courts suivent ;
  - un point noir marque la période en cours.
- **Glisser vers un horizon plus court** crée une copie liée, qui passe par chaque niveau intermédiaire. Le parent est coché quand tous ses sous-objectifs le sont.
- **Glisser un objectif emporte ses sous-objectifs.** Un sous-objectif est toujours exactement un niveau sous son parent ; l'API refuse le reste.
- **Report automatique** des objectifs non faits à l'ouverture de la page, comme Timestripe (`POST /api/goals/rollover`). Le repère « Reporté » vient de la migration 129.
- **Objectifs récurrents** (migration 130) :
  - menu « Répéter chaque jour / semaine / mois », avec un compteur x/10 optionnel ;
  - une nouvelle occurrence est créée à chaque période ;
  - une occurrence ratée n'est pas reportée.
- **Survol** : passer la souris sur un objectif allume toute sa chaîne. Il y a une confirmation avant toute suppression qui emporte des sous-objectifs.
- **Mise en page** : même style qu'Agenda ; la page est un onglet de la page Agenda.
- **Agenda** (migration 131) : chaque jour a un bandeau « Objectifs » en haut avec ses objectifs sans heure, qu'on glisse dans la grille pour les placer. Un objectif placé se déplace, se redimensionne et se coche comme un rendez-vous ; remis dans le bandeau, il perd son heure. Un objectif reporté revient dans le bandeau sans heure. Les créneaux de réservation ne sont pas bloqués.

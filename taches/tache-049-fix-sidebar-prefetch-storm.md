# Tâche 049 — Fix rafale de prefetch sidebar (503 en prod)

## Description

L'app en production (closrm.vercel.app) était devenue extrêmement lente et les
liens de navigation ne réagissaient plus au clic ("rien ne se passe au clic").

## Investigation (systematic-debugging)

- Reproduit en direct sur closrm.vercel.app via navigation Chrome automatisée.
- Capture réseau : au chargement d'une page du dashboard, Next.js déclenche
  automatiquement le prefetch de **tous les liens visibles de la sidebar**
  (comportement par défaut de `<Link>` dans l'App Router — prefetch au moment
  où le lien entre dans le viewport).
- La sidebar contient désormais ~13 liens visibles simultanément (Montage,
  Dashboard, Agenda, Leads, Statistiques, Publicités, Funnels, Lead Magnets,
  Réseaux sociaux, Messages, Emails, Automations, Process de setting, Équipe,
  Paramètres) — elle a beaucoup grossi avec les modules récents.
- `src/middleware.ts` → `updateSession()` fait un appel Supabase
  (`auth.getUser()` + requête `workspace_members`) sur **chaque** requête, y
  compris les requêtes de prefetch RSC (`?_rsc=...`).
- Résultat observé : rafale d'une dizaine de requêtes Supabase concurrentes à
  chaque navigation → `503` intermittents capturés en direct sur `/leads`,
  `/acquisition/funnels`, `/acquisition/messages`, `/acquisition/lead-magnets`,
  `/acquisition/publicites`, `/acquisition/process-setting`, `/login`.
- Pas de changement de code récent en cause : `main` n'a pas bougé depuis juin.
  Le déploiement de production suit en réalité `develop` (pas `main` comme
  indiqué dans `docs/passage-sur-vercel.md` — à corriger, cf. ameliorations.md).
  La sidebar a simplement dépassé le seuil où la rafale de prefetch sature
  Supabase/Vercel.

## Correctif

- `src/components/layout/Sidebar.tsx` : ajout de `prefetch={false}` sur les
  `<Link>` de navigation de la sidebar. Supprime la rafale de prefetch
  automatique à la source, sans toucher au middleware ni à l'auth.

## Fichiers modifiés

- `src/components/layout/Sidebar.tsx`

## Tâches liées

- Aucune (bug de production découvert et corrigé dans la même session)

## Statut

✅ Corrigé sur la branche `feature/remy-fix-sidebar-prefetch-storm` (basée sur
`develop` à jour). En attente de PR + merge + déploiement pour confirmer la
disparition des 503 en prod.

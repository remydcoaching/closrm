# Tâche 037 — PM Kanban (suivi projet ClosRM)

## Objectif
Page interne de suivi de projet en kanban accessible via URL secrète,
sans auth, partagée entre Pierre et Rémy.

## Description
- Schéma `public.pm_boards` + `public.pm_tasks` (préfixe pm_, pas de RLS)
- Accès via slug (32 chars random) → impossible à brute-force
- 4 colonnes : À faire / En cours / Terminé / Bloqué
- Drag & drop entre/dans colonnes (@dnd-kit)
- Filtre par assignee (Tous / Pierre / Rémy)
- Modale CRUD (titre, desc, assignee, priorité, statut)
- Page noindex (robots disallow)
- Realtime exclu (économie Disk IO Supabase)

## Fichiers créés
- supabase/migrations/053_pm_kanban.sql
- src/types/pm.ts
- src/lib/pm/queries.ts
- src/app/api/pm/[slug]/tasks/route.ts
- src/app/api/pm/[slug]/tasks/[id]/route.ts
- src/app/projet/[slug]/page.tsx
- src/app/projet/[slug]/KanbanClient.tsx
- src/app/projet/[slug]/TaskCard.tsx
- src/app/projet/[slug]/TaskModal.tsx

## Fichiers modifiés
- src/middleware.ts (whitelist `/projet/*` et `/api/pm/*`)

## URL d'accès
`/projet/d522e1b9e19e4f9d74022000966e5099`

## Statut
✅ Terminé — à reviewer + jouer la migration sur Supabase prod

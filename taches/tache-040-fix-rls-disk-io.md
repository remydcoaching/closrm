# Tâche T-040 — Fix RLS billing_plans + optimisation Disk IO automations

## Description
Correction de deux alertes Supabase :
1. Table `billing_plans` sans RLS activé (vulnérabilité sécurité)
2. Disk IO budget épuisé, causé par le cron workflow-scheduler

## Objectif
- Activer le RLS sur `billing_plans` (lecture publique, écriture bloquée)
- Ajouter les index manquants sur `workflow_executions`, `workflow_execution_logs`, `leads`
- Éliminer les patterns N+1 dans le cron scheduler (batch queries au lieu de boucles individuelles)

## Fichiers créés
- `supabase/migrations/051_billing_plans_rls.sql`
- `supabase/migrations/052_workflow_performance_indexes.sql`

## Fichiers modifiés
- `src/app/api/cron/workflow-scheduler/route.ts` — refactor N+1 → batch queries + `.limit(500)`

## Impact estimé
- Réduction ~80-90% du Disk IO du cron
- Correction vulnérabilité RLS (table publiquement accessible)

## Statut
✅ Terminé — 2026-04-29 par Rémy

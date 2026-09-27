# Tâche 049 — ClosRM Desktop + Instagram Intelligence (Insyder)

**Dev :** Pierre · **Branche :** feature/pierre-lead-journey (worktree ../closrm-lead-journey) · **Statut :** 🟡 prêt pour PR

## Objectif
App desktop Electron à parité avec ClosRM web + couche Instagram Intelligence inspirée d'Insyder (Analyse/ciblage, Audience, Contenu, fiche lead avec score/confiance/parcours).

## Fait (2026-09-25)
Voir tasks/todo.md. Commits : 25c2f50, 8675273, 967c0da, f2886e5, 6b63047 (+ suivants).

## Migrations de cette branche (renumérotées après la fusion de develop, 2026-09-27)
| Fichier | Ancien n° | Appliquée en prod |
|---|---|---|
| 102_instagram_interactions_source_content | 096 | oui |
| 103_hiker_discovery_runs | 097 | oui |
| 104_lead_instagram_profile | 098 | oui |
| 105_instagram_content_view | 099 | oui |
| 106_lead_status_history | 100 | oui |
| 107_merge_duplicate_ig_leads | 101 | oui |
| 108_discovery_profiles | 102 | oui |
| 109_discovery_contents | 103 | oui |
| 110_discovery_interactions | 104 | oui |
| 111_workspace_instagram_username | 105 | oui |
| 112_story_viewers | 106 | oui |
| 113_story_viewer_likes | 108 | oui |
| 114_instagram_aggregates | 109 | oui |
| 115_highlight_story_viewers | 110 | **non** |

L'ancien 107_backfill_setting_processes (copie de develop 100) est supprimé.

## Performance (2026-09-27)
- Cause de la panne/lenteur Supabase : `cron.job_run_details` = 288 Mo sur 326 Mo (cron booking-reminders chaque minute depuis mars, journal jamais purgé). Purgé + cron `purge-cron-logs` quotidien. Base 31 Mo, API 0,2 s.
- Fiche lead : 914 ms (4 appels séquentiels) → 382-557 ms (1 appel agrégé), revisite instantanée (cache Electron).

## Tâches liées
T-046 lead journey, T-047 meta capi, Session DM (develop).

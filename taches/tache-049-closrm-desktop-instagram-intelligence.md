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
| 115_highlight_story_viewers | 110 | oui (vérifié 2026-09-27) |

L'ancien 107_backfill_setting_processes (copie de develop 100) est supprimé.

## Performance (2026-09-27)
- Cause de la panne/lenteur Supabase : `cron.job_run_details` = 288 Mo sur 326 Mo (cron booking-reminders chaque minute depuis mars, journal jamais purgé). Purgé + cron `purge-cron-logs` quotidien. Base 31 Mo, API 0,2 s.
- Fiche lead : 914 ms (4 appels séquentiels) → 382-557 ms (1 appel agrégé), revisite instantanée (cache Electron).

## Stories à la une, photos IG, logo (2026-09-27 soir)
- **Constat vérifié** : Instagram ne liste les spectateurs d'une story que 48 h après publication. Les 29 stories à la une du compte (juin 2026 → oct. 2024) ont été lues après ce délai → liste vide. Insyder a la même limite (sa page Méthode : « sur une à la une, Instagram n'expose ni vues ni compteur ») : il ne montre que les **j'aime** des stories à la une, jamais des vues.
- Collecte sur toute la fenêtre de 48 h : les stories expirées (> 24 h) mais < 48 h sont relues toutes les 2 h + lecture finale après 44 h (`storiesToRecheck`, `collectStoryViewers(recheck)`), erreur isolée par story (`status: 'error'`, jamais 0).
- Une relecture n'écrase plus vignette / collection / compteurs (colonnes omises au lieu de null, upsert groupé par jeu de colonnes).
- `POST/GET /api/instagram/story-views/highlights` : rattache les stories stockées à leur collection ; spectateurs agrégés par personne (clé instagram_user_id), nb de stories vues, lead.
- UI « Vos stories à la une » : état par story (N spectateurs / non fournis par Instagram > 48 h / lecture échouée / en attente), toutes les stories de la collection, tableau « Spectateurs de « X » ».
- Leads enrichis depuis les listes de spectateurs (instagram_user_id + photo) ; un handle déjà lié à un autre id n'est plus rattaché.
- Photos IG : le CDN renvoie `Cross-Origin-Resource-Policy: same-origin` → images bloquées dans l'app. En-tête retiré pour cdninstagram/fbcdn dans le main (vérifié : bloquée sans, 150 px avec).
- macOS : fermer la fenêtre la masque (collecte continue), Cmd+Q quitte.
- Logo : `electron/build/icon.png` + `icon.icns` (dégradé de marque, « C » + pastille), icône Dock en dev, même marque dans la sidebar.

## Tâches liées
T-046 lead journey, T-047 meta capi, Session DM (develop).

# État ClosRM Mobile

> Suivi global d'avancement de l'app mobile React Native.

## Conventions
- Branche : `feature/pierre-mobile-app` (Pierre)
- Plan : `docs/superpowers/plans/2026-05-08-mobile-app.md`
- Spec : `docs/superpowers/specs/2026-05-08-mobile-app-design.md`

## ⚠️ Écart vs spec
**Switch vers Expo** (spec dit React Native CLI). Décision Pierre 2026-05-08 :
build dev infiniment plus rapide (Expo Go, pas de Xcode/pods en local).
À valider avec Rémy. Conséquences : libs `expo-*` autorisées, build natif via
EAS Build au lieu de Xcode/Android Studio direct.

## Phase 1 — Fondations

| # | Task | Statut | Notes |
|---|------|--------|-------|
| 1 | Setup RN CLI + NativeWind | 🟡 en cours | init lancé |
| 2 | Dossier `shared/` | ⏳ | |
| 3 | Services Supabase + API | ⏳ | |
| 4 | Navigation (tab + stacks) | ⏳ | |
| 5 | Design system (composants UI) | ⏳ | |
| 6 | LoginScreen + auth flow | ⏳ | |

## Phase 2 — Écrans

| # | Task | Statut |
|---|------|--------|
| 7 | Leads List flat | ⏳ |
| 8 | Leads List groupée + priorité | ⏳ |
| 9 | Lead Detail | ⏳ |
| 10 | Calls Day | ⏳ |
| 11 | Call Detail | ⏳ |
| 12 | Schedule Sheet | ⏳ |
| 13 | Inbox | ⏳ |
| 14 | Conversation | ⏳ |
| 15 | Notifications + table SQL | ⏳ |
| 16 | Push notifications | ⏳ |
| 17 | Pulse Dashboard | ⏳ |

## Historique

- **2026-05-08** : worktree `closrm-mobile` créé sur `feature/pierre-mobile-app` depuis `develop`. Démarrage Task 1.

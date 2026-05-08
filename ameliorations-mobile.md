# Améliorations identifiées — ClosRM Mobile

> Toute amélioration listée ici doit être validée explicitement par le développeur avant implémentation.

## Format
- **Titre** — proposition + justification + priorité (P0 critique / P1 nice-to-have / P2 plus tard)

---

## Décision : Switch RN CLI → Expo (P0 — à valider avec Rémy)

**Contexte :** la spec Rémy dit explicitement « PAS Expo, jamais de librairie expo-* ».
Pierre a basculé sur Expo pour Task 1 (2026-05-08).

**Justification Pierre :**
- Build dev infiniment plus rapide (Expo Go en 30 sec, pas de Xcode/CocoaPods en local)
- Itération sur iPhone physique sans cable
- EAS Build pour les builds natifs prod (gratos sur free tier)

**Conséquences :**
- Libs `expo-*` autorisées (expo-status-bar, expo-secure-store, etc.)
- Build natif via `eas build` (cloud) au lieu de Xcode/Android Studio direct
- Push notifs : `expo-notifications` au lieu de `react-native-push-notification`
- SecureStore : `expo-secure-store` au lieu de `react-native-keychain`
- Bottom sheet : `@gorhom/bottom-sheet` reste compatible
- Le plan v1 (1615L) référence des libs RN CLI — adaptations à faire au fil du dev

**À valider avec Rémy avant Phase 2 :** est-ce qu'il est OK avec ce switch ?
S'il dit non, retour en arrière coûteux mais possible.

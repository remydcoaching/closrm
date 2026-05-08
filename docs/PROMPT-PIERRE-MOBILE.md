# Prompt pour Pierre — Démarrer l'implémentation mobile ClosRM

> Copier-coller ce message dans Claude Code pour démarrer.

---

## Prompt à copier :

```
Je démarre l'implémentation de l'application mobile React Native pour ClosRM.

## Contexte
Rémy a validé la spec et le plan d'implémentation. Tout est documenté :

1. **Spec complète** : `docs/superpowers/specs/2026-05-08-mobile-app-design.md`
   → Architecture, scope (9 écrans), design system, tokens, chaque écran en détail
   
2. **Plan d'implémentation** : `docs/superpowers/plans/2026-05-08-mobile-app.md`
   → 17 tâches ordonnées, Phase 1 (fondations) puis Phase 2 (écrans), avec code et commandes

3. **Maquettes high-fidelity** : `C:\Users\remyd\Downloads\ClosRM Mobile High fidelity-handoff\closrm-mobile-high-fidelity\project\screens\`
   → 10 fichiers JSX (00 à 10) avec le design exact de chaque écran

## Règles importantes
- **React Native CLI** — PAS Expo, jamais de librairie expo-*
- **NativeWind** pour le styling (Tailwind pour RN)
- **Mono-repo** : le code mobile va dans `mobile/`, les types partagés dans `shared/`
- **Ne PAS toucher** au code web dans `src/` 
- L'app se connecte à la **même base Supabase** que le web
- **Lectures** : client Supabase direct avec subscriptions temps réel
- **Écritures** : API routes Next.js existantes sur Vercel
- **Pas d'IA** dans cette version : skip les briefs IA, suggestions, prep cards
- **Pas de Call Live** (écran 05)

## Ce que tu dois faire
1. Lis la spec en entier : `docs/superpowers/specs/2026-05-08-mobile-app-design.md`
2. Lis le plan : `docs/superpowers/plans/2026-05-08-mobile-app.md`
3. Crée une branche `feature/pierre-mobile-setup`
4. Commence par la Task 1 du plan et avance tâche par tâche
5. À chaque tâche terminée, mets à jour `etat-mobile.md` (à créer lors de la Task 1)
6. Note les améliorations identifiées dans `ameliorations-mobile.md`

## Workflow git
- Branche : `feature/pierre-mobile-*` (une branche par groupe de tâches ou par tâche)
- Commits fréquents avec le format : `feat(mobile): description`
- PR vers `develop` quand un groupe de tâches est complet
- Ne jamais push sur `main` ou `develop` directement

Commence maintenant par lire la spec et le plan, puis démarre la Task 1.
```

# Tâche 048 — 4 nouveaux modules landing page (Problèmes, Programme, Qualifier, Coach)

## Description

Ajout de 4 nouveaux types de blocs au builder de funnels existant : Problèmes,
Programme / Méthode, C'est pour toi / Pas pour toi, Présentation du coach.
Intégrés au système existant (13 blocs) sans registry central factorisé,
en suivant exactement le pattern d'enregistrement déjà en place.

## Objectif

Permettre à un coach de construire une landing page marketing complète
(reconnaissance du problème, méthode, qualification, autorité) directement
depuis l'éditeur ClosRM, avec un contenu 100% personnalisable et aucune
limite arbitraire sur le nombre d'éléments par section.

## Spec

`docs/superpowers/specs/2026-09-09-landing-page-4-modules-design.md`

Décisions clés : reorder intra-liste en drag & drop (dnd-kit, cohérent avec
le reorder de blocs existant), sélecteur d'icônes Lucide curaté (aucun
n'existait avant), pattern d'intégration identique aux 13 blocs existants
(pas de refactor du registry — noté en amélioration), layout unique
"cartes" pour Programme/Méthode en V1.

## Fichiers créés

- `src/components/funnels/config/IconPicker.tsx`
- `src/components/funnels/config/ReorderableItemList.tsx`
- `src/components/funnels/config/ProblemsConfig.tsx`
- `src/components/funnels/config/ProgramConfig.tsx`
- `src/components/funnels/config/QualifierConfig.tsx`
- `src/components/funnels/config/AboutCoachConfig.tsx`
- `src/components/funnels/blocks/ProblemsBlock.tsx`
- `src/components/funnels/blocks/ProgramBlock.tsx`
- `src/components/funnels/blocks/QualifierBlock.tsx`
- `src/components/funnels/blocks/AboutCoachBlock.tsx`

## Fichiers modifiés

- `src/types/index.ts` — 4 nouveaux types de blocs
- `src/lib/funnels/defaults.ts` — configs par défaut
- `src/components/funnels/FunnelBlockConfig.tsx` — branchement config
- `src/components/funnels/v2/sidebar/SectionsListPanel.tsx` — menu d'ajout
- `src/components/funnels/v2/FunnelBuilderV2.tsx` — labels inspector
- `src/app/f/[workspaceSlug]/[funnelSlug]/[pageSlug]/page.tsx` — rendu public
- `src/components/funnels/FunnelPagePreview.tsx` — rendu preview builder

## Tâches liées

Aucune (nouvelle feature indépendante).

## Statut

Implémenté. PR à ouvrir depuis `feature/remy-landing-page-modules`.

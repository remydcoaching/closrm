# Tâche 028 — Funnels v2 : refonte builder + design system + migration blocs

> **Statut :** ⬜ Non démarré (planification validée le 2026-04-07)
> **Développeur :** Rémy
> **Type :** Fiche **parente** — pointe vers les 3 sous-tâches T-028a/b/c

---

## Contexte

Le module Funnels existe (livré par Pierre en T-023) mais reste "clairement améliorable" :
- Le rendu public des pages est jugé esthétiquement faible
- Le builder a des bugs et une UX peu fluide
- Pas de système de presets de couleurs cohérent
- Effets visuels (shimmer, glow, shine, lightbox...) absents ou mal intégrés

L'objectif de T-028 est une **refonte qualitative** pour atteindre un niveau "production" comparable à Systeme.io / GoHighLevel / l'app concurrente Uptrainer (inspiration uniquement, le nom ne doit jamais apparaître dans ClosRM).

---

## Découpage en 3 sous-tâches

> Initialement prévue comme une seule grosse tâche, T-028 a été découpée en 3 sous-tâches pour rester pilotable. Les fiches détaillées sont chacune dans leur propre fichier.

| # | Sous-tâche | Périmètre court | Fiche |
|---|---|---|---|
| **T-028a** | **Direction artistique** | 20 presets de couleurs + 15 effets visuels (CSS modules) + design tokens CSS vars `--fnl-*` + sandbox de test | [tache-028a-direction-artistique.md](tache-028a-direction-artistique.md) |
| **T-028c** | **Migration des blocs** | Porter les 12 blocs Funnels existants au nouveau design system de T-028a + nettoyer ancien CSS | [tache-028c-blocks-migration.md](tache-028c-blocks-migration.md) |
| **T-028b** | **Builder UX** | Refonte de l'éditeur : sidebar gauche presets + toggles effets, preview live, drag&drop amélioré, undo/redo, inspector latéral | [tache-028b-builder-ux.md](tache-028b-builder-ux.md) |

**Ordre d'exécution validé :** **T-028a → T-028c → T-028b**
La raison : T-028b (builder) a besoin d'afficher les nouveaux blocs migrés, donc T-028c doit passer avant T-028b. T-028a est le prérequis design system de tout le reste.

---

## Référence visuelle

Le fichier [mockups/t028a-preview.html](../mockups/t028a-preview.html) est la **source de vérité visuelle** pour T-028a. Il contient déjà les 20 presets + 8 effets implémentés en HTML/CSS pur. C'est l'artefact issu de la phase de planification.

Pour le visualiser : `npx http-server mockups -p 8889` puis ouvrir `http://localhost:8889/t028a-preview.html`.

L'autre référence est le PDF [Prompt — Tunnel de vente.pdf](../Prompt — Tunnel de vente.pdf) à la racine du projet, qui définit les effets CSS de référence (Poppins, glow radial, shimmer animé, shine boutons, lightbox, etc.).

---

## Décisions structurantes (validées le 2026-04-07)

1. **20 presets** au total (fusion des anciens "Presets" et "Palettes par niche", suppression de "UpTrainer", des doublons et de la "Palette IA personnalisée")
2. **15 effets visuels** numérotés E1 à E15, dont :
   - **5 forcés** (toujours actifs, intégrés au design system) : hover boutons, hover images, lightbox, ombres colorées, badge pulse
   - **10 toggleables** (case à cocher dans la sidebar, **granularité globale au funnel**) : E1 shimmer, E2 hero glow, E3 button shine, E7 count-up, E8 reveal scroll, E9 marquee logos, E10 countdown, E11 avant/après slider, E12 noise overlay, E13 parallax, E14 cursor glow, E15 sticky CTA mobile, E_underline (rare, OFF par défaut)
   - Liste exhaustive dans la fiche T-028a
3. **Tweak post-preset** : on peut ajuster la couleur principale d'un preset après l'avoir appliqué (preset = base + overrides utilisateur)
4. **Pas de "Palette IA personnalisée"** — trop compliqué, retiré du périmètre
5. **Drag & drop des sections** — à garder (ça marche bien dans l'existant), mais à améliorer (snap visuel, drop zones plus claires) → T-028b
6. **Granularité des toggles d'effets** : globale au funnel (option (a)). Pas de toggle par bloc en V1.
7. **Bugs de l'ancien builder** : à NE PAS fixer pendant T-028. L'ancien builder sera remplacé par T-028b. Patcher = perte de temps.

---

## Tâches liées

| Relation | Tâche | Description |
|---|---|---|
| Refonte de | T-023 (Pierre) | Module Funnels initial — c'est le code qu'on refacto |
| Liée à | T-022 | Module Booking (bloc Booking dans funnel à conserver) |
| Liée à | T-020 | Module Emails (sync soumission funnel → séquence email) |

---

## Coordination Pierre

- Pierre a livré T-023 funnel-builder. Le valider qu'il accepte que Rémy refasse une grosse partie du code. **À faire avant de pousser T-028a.**
- Aligner la convention de stockage des `FunnelBlockConfig` (déjà typée dans `src/types/index.ts`)
- Vérifier qu'aucun commit récent de Pierre sur sa branche `feature/pierre-funnel-builder` ne touche aux fichiers funnels (au 2026-04-07 : non, Pierre travaille sur Instagram + Booking)

---

## Résultat final

_À remplir une fois les 3 sous-tâches terminées._

---

## Améliorations identifiées pendant la planification

- Galerie de templates par niche (coaching biz / sport / mindset / immo / formation / mastermind / bootcamp) → reportée hors V1, voir si pertinent en V2
- Analytics par funnel (vues, leads, taux conversion par étape, A/B test) → reportée hors V1
- Domaines custom + page de remerciement configurable → existe déjà côté Email, à brancher en V2
- Heatmap de scroll → V2.1 optionnel

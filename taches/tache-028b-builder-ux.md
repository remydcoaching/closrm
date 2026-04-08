# Tâche 028b — Refonte du Builder Funnels (UX, sidebar, preview, drag&drop)

> **Statut :** ⬜ Non démarré (bloquée par T-028a et T-028c)
> **Développeur :** Rémy
> **Sous-tâche de :** [T-028](tache-028-funnels-v2.md)
> **Branche Git prévue :** `feature/remy-funnels-v2-builder`
> **Date de planification :** 2026-04-07

---

## Objectif

Refondre l'éditeur de funnels (`FunnelBuilder.tsx`) pour atteindre une UX comparable aux apps concurrentes (Systeme.io / GoHighLevel / Uptrainer-like) :
- **Sidebar gauche** avec la sélection de presets, les toggles d'effets, et la liste des sections drag&drop
- **Preview live au centre** qui consomme directement le design system de T-028a et les blocs migrés de T-028c
- **Inspector latéral droit** pour éditer les propriétés du bloc/section sélectionné(e)
- **Undo/Redo** + raccourcis clavier
- **Drag & drop amélioré** (snap visuel, drop zones claires, réorganisation)
- **Preview multi-device** (desktop / tablet / mobile)

---

## Périmètre

### Inclus

#### 1. Architecture du builder

- Nouveau composant racine `<FunnelBuilderV2>` qui remplace `FunnelBuilder.tsx`
- Layout 3 colonnes : sidebar gauche (280px) | preview centrale (flex) | inspector droit (320px, collapsible)
- Topbar : nom du funnel + sauvegarde + preview public + retour

#### 2. Sidebar gauche

**Section "Direction artistique" :**
- Sélecteur de preset (grille de cards avec swatches couleurs, identique au mockup [mockups/t028a-preview.html](../mockups/t028a-preview.html) preset-bar)
- **4 color pickers d'override** (post-preset) :
  - `primary` (couleur principale — boutons, accents, ombres colorées)
  - `heroBg` (fond de la section hero)
  - `sectionBg` (fond des sections de contenu)
  - `footerBg` (fond du footer)
- **Toggle "Lier les fonds" 🔗 / 🔓** au-dessus des 3 pickers de fond : quand activé, modifier n'importe lequel des 3 fonds propage la couleur aux 3 (cohérence visuelle one-shot). Quand désactivé (par défaut), chaque fond reste indépendant. Activer le toggle aligne immédiatement les 3 fonds sur la valeur actuelle du `heroBg` pour éviter l'effet "rien ne se passe". Cette UX a été validée par Rémy en T-028a (sandbox `/dev/funnels-sandbox`) et **doit être portée à l'identique** dans le vrai builder.
- ⚠️ **Avertissement de contraste** : avec 4 couleurs overridables, on multiplie les combinaisons → risque de mauvais contraste texte/fond (par ex. texte light sur heroBg blanc). Calculer le ratio WCAG AA via `luminance()` (déjà dans `src/lib/funnels/color-utils.ts`) et afficher un badge ⚠️ orange si le contraste tombe sous 4.5:1.
- Liste des 10 effets toggleables avec un switch chacun (granularité globale au funnel — pas par bloc)
- Petite légende effet → description courte au survol

**Section "Sections" :**
- Liste des sections du funnel avec drag handle
- Bouton "Ajouter une section" qui ouvre le sélecteur de bloc
- Click sur une section → la sélectionne et scroll dans le preview
- Click droit ou icône → menu contextuel (dupliquer, supprimer, monter, descendre)

#### 3. Preview centrale

- Iframe ou container isolé qui rend le funnel via les composants de T-028c
- Réagit en temps réel aux changements de preset / effets / contenu
- Toggle desktop / tablet (768px) / mobile (375px)
- Indicateur de section sélectionnée (border ou outline)
- Click sur une section dans le preview → la sélectionne dans la sidebar et l'inspector

#### 4. Inspector latéral (droite)

- Quand un bloc est sélectionné → affiche tous ses props éditables (texte, image URL, vidéo URL, etc.)
- Sections du PDF reproductibles : badge text, headline parts, hook, button text, etc.
- Panneau collapsible pour libérer l'espace preview

#### 5. Undo/Redo

- Stack d'historique en mémoire (~50 actions)
- Raccourcis Cmd+Z / Cmd+Shift+Z
- Bouton dans la topbar
- Persistance : non (volatile par session, on save explicitement)

#### 6. Drag & drop amélioré

- Bibliothèque : `dnd-kit` (déjà utilisée dans le projet ?) ou conserver l'existante si elle suffit
- Drop zones visuelles claires entre chaque section
- Snap au drop, animation fluide
- Drag des blocs depuis la palette → drop dans le preview

#### 7. Persistance

- Sauvegarde automatique (debounce 1.5s) des changements
- Indicateur visuel "Sauvegardé" / "Modifications non sauvegardées"
- Sur changement de preset/effets : update `preset_id`, `preset_override`, `effects_config` du funnel via API existante

### Exclus

- ❌ Galerie de templates par niche → reportée hors V1
- ❌ A/B testing intégré → reporté hors V1
- ❌ Analytics par funnel → reporté hors V1
- ❌ Toggles d'effets par bloc → V2 (V1 = global au funnel)
- ❌ Création de nouveaux blocs (Quizz, Logo bar, etc.) → V2

---

## Fichiers concernés

### Fichiers à créer

| Fichier | Description |
|---|---|
| `src/components/funnels/v2/FunnelBuilderV2.tsx` | Nouveau composant racine |
| `src/components/funnels/v2/sidebar/PresetSelector.tsx` | Grille de presets cliquables |
| `src/components/funnels/v2/sidebar/EffectsToggleList.tsx` | Liste des switches d'effets |
| `src/components/funnels/v2/sidebar/SectionsList.tsx` | Liste drag&drop des sections |
| `src/components/funnels/v2/preview/PreviewFrame.tsx` | Container preview avec toggle device |
| `src/components/funnels/v2/inspector/Inspector.tsx` | Panneau latéral droit d'édition |
| `src/components/funnels/v2/inspector/blocks/*` | 1 fichier d'éditeur par type de bloc |
| `src/lib/funnels/v2/use-undo-redo.ts` | Hook stack undo/redo |
| `src/lib/funnels/v2/use-autosave.ts` | Hook autosave debounced |

### Fichiers à modifier

| Fichier | Nature |
|---|---|
| `src/app/(dashboard)/acquisition/funnels/[id]/page.tsx` | Remplacer `<FunnelBuilder>` par `<FunnelBuilderV2>` |
| `src/app/api/funnels/[id]/route.ts` | Vérifier que PATCH supporte tous les champs design v2 (déjà fait en T-028c en théorie) |

### Fichiers à supprimer (en fin de tâche)

| Fichier | Raison |
|---|---|
| `src/components/funnels/FunnelBuilder.tsx` | Remplacé par v2 |
| `src/components/funnels/FunnelBlockPalette.tsx` | Intégrée à `SectionsList` |
| `src/components/funnels/FunnelBlockConfig.tsx` | Remplacée par `Inspector` |

→ **À ne supprimer qu'après validation Rémy** que tout fonctionne en v2.

---

## Phases d'exécution

### Phase 1 — Layout 3 colonnes vide
- Squelette `FunnelBuilderV2` avec les 3 zones, topbar, état de sélection vide

### Phase 2 — Sidebar Direction artistique
- `PresetSelector` (réutilise les composants visuels du mockup)
- `EffectsToggleList`
- Branchement preview live (via context ou store léger)

### Phase 3 — Preview centrale
- `PreviewFrame` avec toggle device
- Rendu d'un funnel test via les composants migrés de T-028c
- Réactivité aux changements preset/effets

### Phase 4 — Sidebar Sections + drag&drop
- `SectionsList` avec dnd-kit
- Ajout / suppression / réorganisation
- Sélection bidirectionnelle preview ↔ liste

### Phase 5 — Inspector latéral
- 1 éditeur par type de bloc
- Édition inline qui se reflète en preview en temps réel

### Phase 6 — Undo/Redo + autosave
- Stack history
- Raccourcis clavier
- Indicateur de sauvegarde

### Phase 7 — Polish + transitions
- Animations d'apparition de l'inspector
- Smooth scroll preview ↔ section
- Loading states
- Empty states

### Phase 8 — Suppression du legacy + tests utilisateur Rémy

---

## Tâches liées

| Relation | Tâche | Description |
|---|---|---|
| Sous-tâche de | [T-028](tache-028-funnels-v2.md) | Tâche parente |
| Dépend de | [T-028a](tache-028a-direction-artistique.md) | Consomme presets + effects |
| Dépend de | [T-028c](tache-028c-blocks-migration.md) | Doit afficher les blocs migrés en preview |

---

## Notes techniques (décisions prises pendant l'implémentation)

- **dnd-kit confirmé** : Pierre l'utilisait déjà en T-023 (`@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities` dans `package.json`). On a réutilisé le `useSortable` hook pour les rangs de la liste de sections, et le `DndContext` du legacy reste en place pour le drag end handler. Pas besoin de switcher de lib.
- **Preview en container, pas iframe** : tenté container directement, fonctionne parfaitement. Le risque de fuite de styles est mitigé par le scope `.fnl-root` mis en place en T-028a (toutes les classes sont préfixées `.fnl-*`). On garde container pour le hot-reload rapide, on switcherait iframe seulement en cas de souci futur.
- **Undo/Redo en stack par référence, pas immer** : V1 simple, on stocke des références d'arrays et on compare par ref. Limite à 50 entrées (shift sur dépassement). Pas de coalesce des keystrokes — chaque setState = entrée. À polir en V2 si nécessaire (debounce 300ms avant push history).
- **Autosave debounced 1.5s** : seul `pages` est autosave. Le design (preset/override/effects) est PATCH immédiatement parce qu'il change lentement et que le coach attend un retour visuel instantané. Si Phase 6 trop agressive sur les pages, on debouncera plus long.
- **Réutilisation des 12 éditeurs `config/*`** : décision majeure de Phase 5. Au lieu de réécrire 12 forms d'édition (~2-3h de travail), on a connecté `FunnelBlockConfig` dispatcher existant via le composant React `FunnelBlockConfigPanel`. Tous les éditeurs sont compatibles avec les types `FunnelBlockConfig` existants — la migration T-028c n'a touché que le rendu des blocs, pas leur structure de données. Si les éditeurs vieillissent mal, on les réécrira un par un en V2 sans bloquer T-028b.
- **Booking + Form gardés affichables** : dans le menu d'ajout `SectionsListPanel`, ils sont visibles avec un tag "À venir" non-cliquable. Si un coach a déjà ces blocs dans un funnel pré-T-028c, ils restent éditables dans la liste — c'est juste l'ajout de NOUVEAUX qui est bloqué (cf. A-028a-01/02 dans `ameliorations.md`).
- **`useUndoRedo` vs callback signature** : le hook expose `setState(value)` sans callback signature `(prev) => next`. Ça a forcé un refactor de `handleAddPage` / `handleDeletePage` dans la page admin pour qu'ils lisent `pages` via la closure plutôt que via prev. Plus simple à maintenir.
- **Rules React 19 strictes** : on a hit la règle `react-hooks/refs-in-render` (ref assignée dans le body) et `react-hooks/set-state-in-effect` (setState dans body d'effet) sur `use-autosave.ts`. Patches : refs synchronisées en `useEffect`, setState pending déplacé en `Promise.resolve().then()` microtask. Même pattern qu'on avait utilisé sur `CountUp` / `Reveal` en T-028a.
- **Légère duplication** : `getDefaultConfig()` est dupliqué entre `FunnelBuilder.tsx` (legacy supprimé en Phase 8) et `FunnelBuilderV2.tsx`. Maintenant que le legacy est dégagé, on pourrait l'extraire dans `src/lib/funnels/default-block-config.ts`. Pas urgent — laissé en place pour limiter le scope de Phase 8.

---

## Résultat final

✅ **Phases 1-8 terminées le 2026-04-07.**

### Fichiers créés (7 nouveaux)

| Fichier | Phase | Description |
|---|---|---|
| `src/components/funnels/v2/FunnelBuilderV2.tsx` | 1 | Composant racine du nouveau builder, layout 3 colonnes |
| `src/components/funnels/v2/sidebar/DirectionArtistiquePanel.tsx` | 2 | Panneau preset + 4 color pickers + toggle 🔗 + 15 effets |
| `src/components/funnels/v2/sidebar/SectionsListPanel.tsx` | 3 | Liste drag&drop des sections + menu d'ajout 12 types (Booking/Form en "À venir") |
| `src/components/funnels/v2/use-undo-redo.ts` | 6 | Hook stack historique + raccourcis Cmd+Z / Cmd+Shift+Z |
| `src/components/funnels/v2/use-autosave.ts` | 6 | Hook autosave debounced 1.5s avec status idle/pending/saving/saved/error |

(+ les composants utilitaires `Lightbox.tsx`, `CountUp.tsx`, `Reveal.tsx`, `Countdown.tsx`, `BeforeAfter.tsx`, `use-parallax.ts`, `use-cursor-glow.ts` créés en T-028a sont aussi sous `src/components/funnels/v2/`)

### Fichiers modifiés

| Fichier | Phase | Nature |
|---|---|---|
| `src/app/(dashboard)/acquisition/funnels/[id]/page.tsx` | 1, 4, 6 | Bascule vers `<FunnelBuilderV2>`, ajout du toggle device tablet, intégration `useUndoRedo` + `useAutosave` + topbar Undo/Redo + status indicator autosave |
| `src/components/funnels/FunnelPagePreview.tsx` | 4 | Export du type `FunnelPreviewMode`, support du mode `tablet` (768px) |

### Fichiers supprimés (Phase 8)

| Fichier | Raison |
|---|---|
| `src/components/funnels/FunnelBuilder.tsx` | Remplacé par `FunnelBuilderV2` |
| `src/components/funnels/FunnelBlockPalette.tsx` | Intégré à `SectionsListPanel` (Phase 3) |

`src/components/funnels/FunnelBlockConfig.tsx` est **conservé** car réutilisé par `FunnelBuilderV2` pour l'inspector. Idem pour les 12 éditeurs `src/components/funnels/config/*`.

### Validation

- ✅ `npm run lint` : 84 problèmes (vs 85 baseline T-028c → -1, 0 nouvelle erreur sur les fichiers livrés). La diminution vient de la suppression du legacy `FunnelBuilder.tsx` qui contenait au moins 1 warning préexistant.
- ✅ `npm run build` : `Compiled successfully`
- ✅ Branche `feature/remy-funnels-v2-builder` pushée à chaque phase (8 commits successifs : `da55d01`, `79335b2`, `4074d50`, `e37864d`, `34c3131`, `ab4937f`, `a9beb76`, + commit Phase 8 final)
- ✅ Validation visuelle Rémy au fil des phases (Phase 1 layout vide, Phase 2 sidebar Direction artistique fonctionnelle, etc.)

### Décisions structurantes (validées avec Rémy)

- **Granularité globale au funnel** : preset + effects, pas d'override par bloc en V1 (porte ouverte pour V2)
- **Toggle 🔗 lier les fonds** : porté à l'identique de la sandbox T-028a
- **Réutilisation des 12 éditeurs config/* existants** : pas de réécriture, gain ~2-3h
- **`pages` autosave debounced 1.5s, design fields PATCH immédiat** : 2 stratégies différentes selon la fréquence des modifs

---

## Améliorations identifiées pendant cette tâche

- **(idée future)** Extraire `getDefaultConfig()` dans `src/lib/funnels/default-block-config.ts` pour éviter la duplication (actuellement uniquement dans `FunnelBuilderV2.tsx` après suppression du legacy). Trivial, à faire à la prochaine touche du builder.
- **(idée future)** Coalesce des keystrokes dans `useUndoRedo` pour qu'un undo restaure une frappe entière au lieu d'un caractère à la fois. Pattern : debounce 300ms avant push history. À faire si feedback coach négatif sur le ratio undo/keystrokes.
- **(idée future)** Indicateur "Modifications non sauvegardées" sur la fermeture d'onglet quand `autosaveStatus` est `pending` ou `saving`. Le hook a déjà un `beforeunload` handler best-effort, mais on pourrait afficher un confirm dialog. Pas urgent — risque très faible avec le debounce 1.5s.
- **(idée future)** Permettre au coach de **renommer une page** depuis le `FunnelPageTabs` (actuellement noms générés `Page 1`, `Page 2`, etc.). Petit ajout UX, à scope dans une mini-tâche dédiée.
- **(idée future)** Sticky sidebar — quand le funnel a beaucoup de sections, la sidebar Direction artistique scroll avec, au lieu de rester accessible. Dépendra des feedbacks coach.

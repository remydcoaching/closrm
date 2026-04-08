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

## Notes techniques

- **dnd-kit vs solution actuelle** : à décider en Phase 4 selon ce que Pierre a déjà utilisé dans T-023.
- **Preview iframe vs container ?** Iframe = isolation CSS parfaite mais hot-reload plus lent. Container = simple mais risque de fuites de styles. → Tenter container en premier, basculer iframe si problème.
- **Undo/Redo** : ne pas serializer tout l'état à chaque action — utiliser un diff (immer + patches ?)
- **Performance** : si autosave ralentit l'UX, debouncer plus long ou batch les patches.
- **Bug builder existant** : référence au feedback mémoire `feedback_t028_skip_old_builder_bugs` — on n'a pas patché l'ancien builder pendant T-028a/c, donc en commençant T-028b il faut probablement repartir de zéro pour le builder, pas étendre l'existant.

---

## Résultat final

_À remplir à la fin de la tâche._

---

## Améliorations identifiées pendant cette tâche

_À remplir au fil de l'eau._

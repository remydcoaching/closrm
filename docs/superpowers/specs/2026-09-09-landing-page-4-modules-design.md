---
name: landing-page-4-modules
description: Ajout de 4 nouveaux types de blocs au builder de landing pages (Problèmes, Programme/Méthode, C'est pour toi/Pas pour toi, Présentation du coach) + composants partagés ReorderableItemList et IconPicker
metadata:
  type: project
---

# 4 nouveaux modules de landing page

## Objectif

Ajouter 4 nouveaux types de blocs au builder de funnels existant, pour permettre à un coach de construire une landing page marketing complète (problèmes de la cible, méthode, qualification, présentation du coach) sans sortir de l'éditeur actuel. Ces modules doivent être génériques — utilisables sur n'importe quelle landing page, pas seulement celle de Rémy — et s'intégrer au système existant sans le dupliquer ni le casser.

## Contexte

Audit du système de funnels existant (lecture seule, aucun fichier modifié) :

- **13 types de blocs** déjà implémentés (`hero`, `video`, `testimonials`, `form`, `booking`, `booking_actions`, `pricing`, `faq`, `countdown`, `cta`, `text`, `image`, `spacer`, `footer`), définis dans `src/types/index.ts` (`FunnelBlockType`, une interface `*BlockConfig` par type, union `FunnelBlockConfig`).
- Aucun registry central : chaque type de bloc est enregistré manuellement dans **7 fichiers** (type + config par défaut + menu d'ajout + label inspector + composant de config + rendu public + rendu preview). C'est un pattern répétitif mais mécanique et bien rodé sur les 13 blocs existants.
- Le réordonnancement **entre blocs** (drag & drop de sections) est déjà câblé via `dnd-kit` (`@dnd-kit/core` + `@dnd-kit/sortable`) dans `SectionsListPanel.tsx` — s'applique automatiquement à tout nouveau type de bloc, rien à faire.
- **Aucun reorder à l'intérieur d'une liste d'items** : les blocs FAQ, Testimonials et Image (galerie) n'ont que add/remove sur leurs items, pas de drag & drop interne.
- **Aucun sélecteur d'icônes** : les icônes visibles dans le menu du builder sont des imports `lucide-react` codés en dur par les devs, pas un choix utilisateur.
- Stockage : colonne `funnel_pages.blocks JSONB`, aucune validation de schéma (ni Zod, ni contrainte DB) — la route `PUT /api/funnels/[id]/pages/[pageId]` écrit `body.blocks` tel quel. Les nouveaux blocs suivent ce même pattern (pas de nouvelle validation à ajouter, cohérence avec l'existant).
- Design tokens réutilisables : **correction post-lecture du code réel** — les blocs de contenu (`FaqBlock`, `TestimonialsBlock`, `PricingBlock`, etc.) n'utilisent PAS les classes `.fnl-section`/`.fnl-headline`/`.fnl-hook` (réservées à Hero/Footer qui ont un fond de section spécifique). Le pattern réel et dominant : styles inline (`padding: '60px 20px'`, `maxWidth: N`, `margin: '0 auto'`) + variables CSS `--fnl-text`, `--fnl-text-secondary`, `--fnl-primary`, `--fnl-primary-rgb`, `--fnl-section-bg`. Seule `.fnl-btn` (classe partagée, gradient + ombre + hover) est réellement réutilisée pour les CTA (`CtaBlock`, `PricingBlock`, `HeroBlock`). Les 4 nouveaux blocs suivent ce pattern inline + vars — pas de nouvelles classes CSS globales à créer.
- Grilles responsives existantes (ex. `TestimonialsBlock`) : `grid-template-columns: repeat(auto-fit, minmax(Npx, 1fr))` — dégrade nativement sur mobile sans media query dédiée. Même technique réutilisée pour les 4 nouveaux blocs (y compris pour les 2 colonnes du Qualifier : avec exactement 2 enfants dans la grille, l'auto-fit donne naturellement 2 colonnes sur desktop et 1 colonne empilée sur mobile).
- `ImageUploadField` (`config/ImageUploadField.tsx`) + `useImageUpload` (upload R2 présigné, compression client) sont directement réutilisables pour toute image (Coach, illustrations de cartes).
- `getDefaultBlockConfig()` (`src/lib/funnels/defaults.ts`) pré-remplit chaque nouveau bloc avec du contenu réaliste éditable — pattern validé par Rémy le 2026-04-07 ("le coach n'a jamais une page vide"). Ça ne contredit pas la consigne "ne pas hardcoder de texte d'exemple" : cette dernière vise le composant de **rendu**, pas les valeurs par défaut à la création, qui sont éditables immédiatement.

## Décisions validées avec l'utilisateur

- Réordonnancement intra-liste (cartes, étapes, points) : **drag & drop**, même lib `dnd-kit` que le reorder de blocs.
- Icônes optionnelles : **sélecteur d'icônes Lucide** (jeu curaté), nouveau petit composant.
- Intégration des 4 nouveaux types : **suivre le pattern existant à 7 fichiers**, pas de refactor du registry (idée notée dans `ameliorations.md` pour validation future séparée).
- Module Programme/Méthode : **un seul layout pour la V1 — cartes** (pas de sélecteur vertical/horizontal/timeline pour l'instant).

## Périmètre

### Inclus

- 4 nouveaux types de blocs : `problems`, `program`, `qualifier`, `about_coach`
- 2 composants partagés : `ReorderableItemList` (drag & drop générique pour listes d'items en config), `IconPicker` (grille d'icônes Lucide curatée)
- Intégration complète dans le builder existant (menu d'ajout, config, rendu public, rendu preview)
- Contenu de chaque bloc entièrement personnalisable dans l'éditeur (aucun texte codé en dur dans le rendu)
- Responsive mobile/tablette/desktop pour les 4 modules
- Non-régression totale sur les 13 blocs et les landing pages existantes

### Exclus (hors scope, à discuter séparément si besoin)

- Refactor du registry central des types de blocs (noté en amélioration)
- Layouts alternatifs pour Programme/Méthode (vertical, horizontal, timeline) — V2 si besoin, le composant sera conçu extensible
- Nouvelle validation Zod sur les blocs (cohérence avec le pattern JSONB libre existant)
- Migration de données : aucune nécessaire (ajout de littéraux TypeScript = additif pur, colonne JSONB déjà générique)

## Architecture

### 1. Types — `src/types/index.ts`

Ajout de 4 littéraux à `FunnelBlockType` : `'problems' | 'program' | 'qualifier' | 'about_coach'`.

```ts
export interface ProblemItem {
  id: string
  title: string
  description: string
  showNumber: boolean
  icon?: { name: string } | null
  imageUrl?: string | null
}

export interface ProblemsBlockConfig {
  title: string
  subtitle?: string
  items: ProblemItem[]
  columns: 1 | 2 | 3
}

export interface ProgramStep {
  id: string
  number: string
  title: string
  description: string
  icon?: { name: string } | null
  imageUrl?: string | null
}

export interface ProgramBlockConfig {
  title: string
  subtitle?: string
  items: ProgramStep[]
  columns: 2 | 3 | 4
}

export interface QualifierPoint {
  id: string
  text: string
}

export interface QualifierColumn {
  title: string
  subtitle?: string
  icon?: { name: string } | null
  items: QualifierPoint[]
}

export interface QualifierBlockConfig {
  yes: QualifierColumn
  no: QualifierColumn
}

export interface CoachStat {
  id: string
  value: string
  label: string
}

export interface AboutCoachBlockConfig {
  imageUrl: string | null
  title: string
  subtitle?: string
  text: string
  ctaText?: string
  ctaUrl?: string
  stats: CoachStat[]
  layout: 'image-left' | 'image-right'
}
```

Ajout des 4 interfaces à l'union `FunnelBlockConfig`. `id` sur chaque item = `crypto.randomUUID()` à la création (cohérent avec le pattern d'`id` déjà utilisé sur `FunnelBlock`).

### 2. Composants partagés

**`src/components/funnels/config/ReorderableItemList.tsx`**

Wrapper générique autour de `DndContext` + `SortableContext` (mêmes imports `@dnd-kit/core`/`@dnd-kit/sortable`/`@dnd-kit/utilities` que `SectionsListPanel.tsx`), scope local (pas de conflit avec le `DndContext` du reorder de blocs qui vit dans `FunnelBuilderV2`).

```ts
interface Props<T extends { id: string }> {
  items: T[]
  onChange: (items: T[]) => void
  renderItem: (item: T, index: number, dragHandleProps: object) => React.ReactNode
  onAdd: () => void
  addLabel: string
}
```

Gère : drag handle, `arrayMove` au drop, bouton "+ Ajouter" en bas (délègue la création de l'item vide/par défaut à l'appelant via `onAdd`), suppression déléguée au `renderItem` (chaque config passe son propre bouton "Supprimer" comme aujourd'hui dans `FaqConfig`). Remplace le pattern actuel de `FaqConfig`/`TestimonialsConfig` (qui restent inchangés — pas de migration forcée des blocs existants vers ce composant, hors scope).

**`src/components/funnels/config/IconPicker.tsx`**

Grille d'un jeu curaté d'icônes `lucide-react` pertinentes pour du contenu coaching/marketing (~40-50 : `CheckCircle2, XCircle, Target, TrendingUp, Dumbbell, Utensils, Clock, Brain, Heart, Zap, Award, Users, Calendar, BarChart3, Flame, ShieldCheck, Star, ThumbsUp, AlertTriangle, Compass, Rocket, Trophy, Scale, Activity, Lightbulb, ...`). Stocke `{ name: string }`. Un mapping `ICONS_BY_NAME: Record<string, LucideIcon>` construit une fois en haut du fichier fait le lookup au rendu (côté config **et** côté bloc public).

```ts
interface Props {
  value: { name: string } | null
  onChange: (icon: { name: string } | null) => void
}
```

UI : petit bouton "Choisir une icône" ouvrant une grille en popover, + option "Aucune icône" pour repasser sur `null` (l'image uploadée prend le relais visuellement si présente).

### 3. Defaults — `src/lib/funnels/defaults.ts`

4 nouveaux `case` dans `getDefaultBlockConfig()`, contenu réaliste pré-rempli (3 items par défaut pour `problems`/`program`, 4 points par colonne pour `qualifier`, 2 stats pour `about_coach`), même pattern que les 13 blocs existants.

### 4. Menu d'ajout — `src/components/funnels/v2/sidebar/SectionsListPanel.tsx`

4 entrées ajoutées à `BLOCK_TYPES` :

```ts
{ type: 'problems', label: 'Problèmes', icon: <AlertCircle size={ICON_SIZE} /> },
{ type: 'program', label: 'Programme / Méthode', icon: <ListChecks size={ICON_SIZE} /> },
{ type: 'qualifier', label: "C'est pour toi / Pas pour toi", icon: <CheckCheck size={ICON_SIZE} /> },
{ type: 'about_coach', label: 'Présentation du coach', icon: <UserCircle size={ICON_SIZE} /> },
```

Pas de flag `comingSoon` — les 4 modules sont disponibles immédiatement.

### 5. Label inspector — `src/components/funnels/v2/FunnelBuilderV2.tsx`

Mêmes 4 entrées ajoutées au `BLOCK_LABELS` dupliqué localement (cohérence avec le pattern existant, pas de factorisation hors scope).

### 6. Panneaux de config — `src/components/funnels/config/`

4 nouveaux fichiers : `ProblemsConfig.tsx`, `ProgramConfig.tsx`, `QualifierConfig.tsx`, `AboutCoachConfig.tsx`, branchés dans `FunnelBlockConfig.tsx` (`block.type === 'xxx' && <XxxConfig .../>` + entrée `LABELS`).

Chaque panneau organisé selon la règle "options visibles seulement si pertinentes" (§14 de la demande) :
- **Contenu** : titre, sous-titre, liste d'items via `ReorderableItemList`
- **Media** : `IconPicker` + `ImageUploadField` par item (les deux optionnels, l'un ou l'autre)
- **Design** : `columns` (Problèmes/Programme uniquement)
- **CTA** : uniquement sur `AboutCoachConfig` (`ctaText`/`ctaUrl` optionnels)

Pas de section "Responsive" dédiée dans l'éditeur — comportement mobile automatique via le CSS (grille `auto-fit`), cohérent avec les blocs existants qui n'ont pas ce contrôle non plus.

### 7. Rendu — public + preview

4 nouveaux fichiers dans `src/components/funnels/blocks/` : `ProblemsBlock.tsx`, `ProgramBlock.tsx`, `QualifierBlock.tsx`, `AboutCoachBlock.tsx`. Branchés dans les **deux** switch existants :
- `src/app/f/[workspaceSlug]/[funnelSlug]/[pageSlug]/page.tsx` (rendu public SSR)
- `src/components/funnels/FunnelPagePreview.tsx` (aperçu live builder)

Aucun texte codé en dur — tout vient de `block.config`.

### 8. Style des 4 nouveaux blocs

Pas de nouvelles classes CSS globales — chaque bloc suit le pattern réel de `PricingBlock`/`FaqBlock`/`TestimonialsBlock` : styles inline dans le composant, couleurs via `var(--fnl-text)`, `var(--fnl-text-secondary)`, `var(--fnl-primary)`, `rgba(var(--fnl-primary-rgb), N)`, fond via `var(--fnl-section-bg)`. Cartes (Problèmes/Programme) : même look que les cards `PricingBlock` (`borderRadius: 20`, `border` + `boxShadow` teintés `--fnl-primary-rgb`). Grilles en `repeat(auto-fit, minmax(Npx, 1fr))`, dégradent nativement sur mobile sans media query (y compris le Qualifier à 2 colonnes). CTA optionnel du bloc Coach via la classe partagée `.fnl-btn`. Couleurs vert/rouge des colonnes Qualifier : valeurs sémantiques fixes (cohérentes avec l'exemple ✓/✕ de la demande), pas liées au thème primary qui peut changer.

## Compatibilité / non-régression

- Aucune migration DB : colonne `blocks JSONB` déjà générique.
- Ajout de littéraux à `FunnelBlockType` et d'interfaces à l'union `FunnelBlockConfig` = **additif pur**, ne touche aucun bloc existant.
- Les 13 blocs et leurs fichiers ne sont pas modifiés (sauf les 3 fichiers "liste" où on *ajoute* une entrée : `BLOCK_TYPES`, `BLOCK_LABELS`, `LABELS`, et les 2 `switch` de rendu où on *ajoute* un `case`).
- Vérification prévue : build TypeScript propre, une landing page existante rechargée avant/après sans diff visuel ni fonctionnel.

## Tests

Pour chacun des 4 modules : ajout depuis le menu, édition du contenu, add/remove/reorder (drag & drop) d'items, choix d'icône, upload d'image, sauvegarde (autosave existant) + rechargement de page pour vérifier la persistence JSONB, vérification visuelle desktop/tablette/mobile (pas d'overflow horizontal, cartes lisibles, boutons cliquables). Puis vérification qu'une landing page existante (avec les 13 blocs actuels) n'est pas affectée.

## Fichiers créés / modifiés

| Fichier | Type |
|---------|------|
| `src/types/index.ts` | Modifié |
| `src/lib/funnels/defaults.ts` | Modifié |
| `src/components/funnels/config/ReorderableItemList.tsx` | Nouveau |
| `src/components/funnels/config/IconPicker.tsx` | Nouveau |
| `src/components/funnels/config/ProblemsConfig.tsx` | Nouveau |
| `src/components/funnels/config/ProgramConfig.tsx` | Nouveau |
| `src/components/funnels/config/QualifierConfig.tsx` | Nouveau |
| `src/components/funnels/config/AboutCoachConfig.tsx` | Nouveau |
| `src/components/funnels/FunnelBlockConfig.tsx` | Modifié |
| `src/components/funnels/v2/sidebar/SectionsListPanel.tsx` | Modifié |
| `src/components/funnels/v2/FunnelBuilderV2.tsx` | Modifié |
| `src/components/funnels/blocks/ProblemsBlock.tsx` | Nouveau |
| `src/components/funnels/blocks/ProgramBlock.tsx` | Nouveau |
| `src/components/funnels/blocks/QualifierBlock.tsx` | Nouveau |
| `src/components/funnels/blocks/AboutCoachBlock.tsx` | Nouveau |
| `src/app/f/[workspaceSlug]/[funnelSlug]/[pageSlug]/page.tsx` | Modifié |
| `src/components/funnels/FunnelPagePreview.tsx` | Modifié |

## Tâche associée

Tâche N° suivante dans la numérotation séquentielle globale (à vérifier dans `taches/`).

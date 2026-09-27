# 4 nouveaux modules landing page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter 4 nouveaux types de blocs au builder de funnels ClosRM (Problèmes, Programme/Méthode, C'est pour toi/Pas pour toi, Présentation du coach) intégrés au système existant, sans casser les 13 blocs actuels.

**Architecture:** Chaque nouveau type de bloc suit exactement le pattern des 13 blocs existants (littéral `FunnelBlockType` + interface `*BlockConfig` + config par défaut + entrée menu + panneau de config + rendu public + rendu preview). Deux composants partagés nouveaux (`ReorderableItemList`, `IconPicker`) comblent les deux vrais manques identifiés à l'audit (pas de reorder intra-liste, pas de sélecteur d'icône).

**Tech Stack:** Next.js 14 (App Router) + TypeScript, React (client components), `@dnd-kit/core`/`@dnd-kit/sortable` (déjà une dépendance), `lucide-react`, styles inline + variables CSS `--fnl-*`. Pas de framework de test automatisé sur les composants React dans ce repo (seul `src/lib/agenda/positioning.test.ts` existe, pour de la logique pure exécutée via `npx tsx`) — vérification par `npx tsc --noEmit` à chaque tâche + test manuel en navigateur (`npm run dev`).

**Spec:** `docs/superpowers/specs/2026-09-09-landing-page-4-modules-design.md`

## Global Constraints

- Suivre exactement le pattern d'enregistrement des 13 blocs existants (pas de registry central factorisé — décision validée avec l'utilisateur).
- Réordonnancement intra-liste (cartes, étapes, points) = drag & drop via `dnd-kit` (même lib que le reorder de blocs).
- Icônes optionnelles = sélecteur `IconPicker` (jeu curaté de `lucide-react`, pas de recherche libre).
- Module Programme/Méthode : un seul layout pour la V1 (cartes), pas de sélecteur de layout.
- Aucune migration DB (colonne `funnel_pages.blocks JSONB` déjà générique).
- Aucun texte codé en dur dans les composants de **rendu** — tout vient de `block.config`. Les valeurs par défaut pré-remplies dans `getDefaultBlockConfig()` sont attendues et éditables (pattern validé le 2026-04-07, ne pas le remettre en cause).
- Style des 4 nouveaux blocs : styles inline + variables CSS `var(--fnl-text)`, `var(--fnl-text-secondary)`, `var(--fnl-primary)`, `rgba(var(--fnl-primary-rgb), N)`, `var(--fnl-section-bg)` — PAS les classes `.fnl-section`/`.fnl-headline`/`.fnl-hook` (non utilisées par les blocs de contenu existants, réservées à Hero/Footer). `.fnl-btn` reste la classe partagée pour tout CTA.
- Grilles responsives : `grid-template-columns: repeat(auto-fit, minmax(Npx, 1fr))` — pas de nouvelle media query, dégrade nativement sur mobile (pattern `TestimonialsBlock`).
- Panneaux de config (UI admin du builder, pas la page publique) : utiliser les tokens `var(--bg-input)`, `var(--border-primary)`, `var(--text-primary)`, `var(--text-secondary)`, `var(--text-muted)`, `var(--bg-elevated)`, `var(--color-primary)` définis dans `src/app/globals.css` (pattern le plus récent, ex. `ImageUploadField.tsx`), plutôt que les hex codés en dur des plus anciens panneaux (`FaqConfig.tsx`) — sauf pour le bouton "Supprimer" qui reste `#E53E3E` fixe (couleur sémantique de suppression, indépendante du thème, cohérente avec tous les panneaux existants).
- IDs des nouveaux items créés dans l'éditeur : `crypto.randomUUID()` côté composants client (pattern `RemindersEditor.tsx`). IDs générés dans `src/lib/funnels/defaults.ts` (valeurs par défaut à la création d'un bloc) : petit helper local `generateItemId()` façon `Date.now()-random`, cohérent avec `generateBlockId()` déjà présent dans ce fichier.
- Ne pas toucher aux 13 blocs existants ni à leurs fichiers, sauf les endroits où on **ajoute** une entrée (jamais de suppression/modification de ce qui existe).

---

## Task 1: Types & valeurs par défaut des 4 nouveaux blocs

**Files:**
- Modify: `src/types/index.ts` (ajout après la ligne 595 `FunnelBlockType`, et après la ligne 798 pour l'union `FunnelBlockConfig`)
- Modify: `src/lib/funnels/defaults.ts` (ajout de 4 `case` dans `getDefaultBlockConfig()`)
- Modify: `src/components/funnels/v2/FunnelBuilderV2.tsx` (ajout de 4 entrées à `BLOCK_LABELS`, `Record<FunnelBlockType, string>` — sans ça le fichier ne compile plus dès que les littéraux sont ajoutés au type)
- Modify: `src/components/funnels/config/RedirectPicker.tsx` (ajout de 4 entrées à `BLOCK_TYPE_LABELS`, même raison — `Record<FunnelBlockType, string>` littéral, utilisé par HeroConfig/CtaConfig/PricingConfig/ImageConfig/FormConfig pour le sélecteur "vers un bloc de la page")

**Interfaces:**
- Produces (utilisé par toutes les tâches suivantes) :
  - Types : `ProblemItem`, `ProblemsBlockConfig`, `ProgramStep`, `ProgramBlockConfig`, `QualifierPoint`, `QualifierColumn`, `QualifierBlockConfig`, `CoachStat`, `AboutCoachBlockConfig`
  - `FunnelBlockType` inclut désormais `'problems' | 'program' | 'qualifier' | 'about_coach'`
  - `getDefaultBlockConfig('problems' | 'program' | 'qualifier' | 'about_coach')` retourne une config par défaut valide

- [ ] **Step 1: Ajouter les littéraux de type dans `src/types/index.ts`**

Modifier le bloc à la ligne 581 :

```ts
export type FunnelBlockType =
  | 'hero'
  | 'video'
  | 'testimonials'
  | 'form'
  | 'booking'
  | 'booking_actions'
  | 'pricing'
  | 'faq'
  | 'countdown'
  | 'cta'
  | 'text'
  | 'image'
  | 'spacer'
  | 'footer'
  | 'problems'
  | 'program'
  | 'qualifier'
  | 'about_coach'
```

- [ ] **Step 2: Ajouter les 9 nouvelles interfaces dans `src/types/index.ts`**

Juste avant `export type FunnelBlockConfig =` (ligne 800), ajouter :

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

- [ ] **Step 3: Ajouter les 4 interfaces à l'union `FunnelBlockConfig`**

```ts
export type FunnelBlockConfig =
  | HeroBlockConfig
  | VideoBlockConfig
  | TestimonialsBlockConfig
  | FormBlockConfig
  | BookingBlockConfig
  | BookingActionsBlockConfig
  | PricingBlockConfig
  | FaqBlockConfig
  | CountdownBlockConfig
  | CtaBlockConfig
  | FunnelTextBlockConfig
  | FunnelImageBlockConfig
  | SpacerBlockConfig
  | FunnelFooterBlockConfig
  | ProblemsBlockConfig
  | ProgramBlockConfig
  | QualifierBlockConfig
  | AboutCoachBlockConfig
```

- [ ] **Step 4: Ajouter le helper `generateItemId` et les 4 `case` dans `src/lib/funnels/defaults.ts`**

Juste avant `function generateBlockId()` (ligne 178), ajouter :

```ts
/**
 * Génère un ID unique pour un item à l'intérieur d'une liste de bloc
 * (cartes Problèmes, étapes Programme, points Qualifier, stats Coach).
 * Même pattern que `generateBlockId` ci-dessous.
 */
function generateItemId(): string {
  return `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}
```

Puis, dans `getDefaultBlockConfig()`, juste avant la fermeture du `switch` (avant la ligne `}` qui suit `case 'footer':`), ajouter :

```ts
    case 'problems':
      return {
        title: 'Tu fais tout ça, mais rien ne change ?',
        subtitle: "Voici pourquoi tu n'avances pas malgré tes efforts.",
        items: [
          {
            id: generateItemId(),
            title: 'Tu t\'entraînes sans réelle stratégie',
            description: 'Tu enchaînes les séances sans progression mesurable, sans savoir si tu avances vraiment.',
            showNumber: true,
            icon: { name: 'Dumbbell' },
            imageUrl: null,
          },
          {
            id: generateItemId(),
            title: 'Tu ne sais pas quoi manger',
            description: 'Tu changes de régime toutes les semaines sans jamais obtenir de résultat durable.',
            showNumber: true,
            icon: { name: 'Utensils' },
            imageUrl: null,
          },
          {
            id: generateItemId(),
            title: 'Tu manques de constance',
            description: 'Motivé quelques semaines, puis tu abandonnes — le cycle recommence.',
            showNumber: true,
            icon: { name: 'Flame' },
            imageUrl: null,
          },
        ],
        columns: 3,
      }
    case 'program':
      return {
        title: 'Comment fonctionne l\'accompagnement',
        subtitle: 'Une méthode structurée en 4 étapes, du diagnostic aux résultats.',
        items: [
          {
            id: generateItemId(),
            number: '01',
            title: 'Analyse',
            description: 'On fait le point sur ton niveau, ton objectif, ton alimentation et ta situation actuelle.',
            icon: { name: 'Compass' },
            imageUrl: null,
          },
          {
            id: generateItemId(),
            number: '02',
            title: 'Plan personnalisé',
            description: 'Tu reçois un plan d\'entraînement et une stratégie nutritionnelle adaptés à ton objectif.',
            icon: { name: 'Target' },
            imageUrl: null,
          },
          {
            id: generateItemId(),
            number: '03',
            title: 'Suivi',
            description: 'On analyse tes données chaque semaine et on ajuste ton plan en conséquence.',
            icon: { name: 'BarChart3' },
            imageUrl: null,
          },
          {
            id: generateItemId(),
            number: '04',
            title: 'Progression',
            description: 'Tu avances avec une méthode structurée plutôt que de fonctionner au hasard.',
            icon: { name: 'TrendingUp' },
            imageUrl: null,
          },
        ],
        columns: 4,
      }
    case 'qualifier':
      return {
        yes: {
          title: 'C\'est pour toi si',
          icon: { name: 'CheckCircle2' },
          items: [
            { id: generateItemId(), text: 'Tu veux réellement transformer ton physique' },
            { id: generateItemId(), text: 'Tu es prêt à t\'investir' },
            { id: generateItemId(), text: 'Tu acceptes de suivre un cadre' },
            { id: generateItemId(), text: 'Tu veux être accompagné' },
          ],
        },
        no: {
          title: 'Ce n\'est pas pour toi si',
          icon: { name: 'XCircle' },
          items: [
            { id: generateItemId(), text: 'Tu cherches une solution miracle' },
            { id: generateItemId(), text: 'Tu ne veux rien changer à tes habitudes' },
            { id: generateItemId(), text: 'Tu n\'es pas prêt à t\'investir' },
            { id: generateItemId(), text: 'Tu veux des résultats sans effort' },
          ],
        },
      }
    case 'about_coach':
      return {
        imageUrl: null,
        title: 'Qui suis-je ?',
        subtitle: 'Coach certifié, 5 ans d\'expérience',
        text: 'Depuis 5 ans, j\'accompagne des dizaines de personnes à transformer leur physique et leur discipline grâce à une méthode structurée, sans injonction ni solution miracle.',
        ctaText: 'Réserve ton appel',
        ctaUrl: '#',
        stats: [
          { id: generateItemId(), value: '100+', label: 'Clients accompagnés' },
          { id: generateItemId(), value: '5+', label: 'Années d\'expérience' },
        ],
        layout: 'image-left',
      }
```

- [ ] **Step 5: Ajouter les 4 labels dans `BLOCK_LABELS` de `src/components/funnels/v2/FunnelBuilderV2.tsx`**

```ts
const BLOCK_LABELS: Record<FunnelBlockType, string> = {
  hero: 'Hero',
  video: 'Vidéo',
  text: 'Texte',
  image: 'Image',
  cta: 'Bouton CTA',
  pricing: 'Tarification',
  testimonials: 'Témoignages',
  faq: 'FAQ',
  countdown: 'Compte à rebours',
  spacer: 'Espacement',
  footer: 'Footer',
  booking: 'Réservation',
  booking_actions: 'Actions calendrier',
  form: 'Formulaire',
  problems: 'Problèmes',
  program: 'Programme / Méthode',
  qualifier: 'C\'est pour toi / Pas pour toi',
  about_coach: 'Présentation du coach',
}
```

- [ ] **Step 6: Ajouter les 4 labels dans `BLOCK_TYPE_LABELS` de `src/components/funnels/config/RedirectPicker.tsx`**

```ts
const BLOCK_TYPE_LABELS: Record<FunnelBlockType, string> = {
  hero: 'Hero',
  video: 'Vidéo',
  text: 'Texte',
  image: 'Image',
  cta: 'Bouton CTA',
  pricing: 'Tarification',
  testimonials: 'Témoignages',
  faq: 'FAQ',
  countdown: 'Compte à rebours',
  spacer: 'Espacement',
  footer: 'Footer',
  booking: 'Réservation',
  booking_actions: 'Actions calendrier',
  form: 'Formulaire',
  problems: 'Problèmes',
  program: 'Programme / Méthode',
  qualifier: 'C\'est pour toi / Pas pour toi',
  about_coach: 'Présentation du coach',
}
```

- [ ] **Step 7: Vérifier la compilation TypeScript**

Run: `npx tsc --noEmit`
Expected: 0 erreur. Les 4 nouveaux types sont définis, `getDefaultBlockConfig` est exhaustif, et les deux `Record<FunnelBlockType, string>` littéraux du repo (`FunnelBuilderV2.tsx` et `RedirectPicker.tsx`) sont complets. Les autres fichiers qui référencent `FunnelBlockType` sans les 4 nouveaux cas (`SectionsListPanel.tsx` — construit via `.reduce()` + cast, pas de vérification stricte —, `FunnelBlockConfig.tsx` — `Record<string, string>` non typé —, les 2 switch de rendu — pas de check d'exhaustivité, juste un `default`) ne cassent rien tant qu'ils n'ont pas de branche pour ces types : cf. tâches suivantes.

- [ ] **Step 8: Commit**

```bash
git add src/types/index.ts src/lib/funnels/defaults.ts src/components/funnels/v2/FunnelBuilderV2.tsx \
  src/components/funnels/config/RedirectPicker.tsx
git commit -m "feat(funnels): ajoute les types et defaults des 4 nouveaux blocs landing page"
```

---

## Task 2: Composant partagé `IconPicker`

**Files:**
- Create: `src/components/funnels/config/IconPicker.tsx`

**Interfaces:**
- Consumes: rien (composant autonome)
- Produces: `export default function IconPicker({ value, onChange }: { value: {name:string}|null|undefined, onChange: (icon: {name:string}|null) => void })`, et `export const ICON_PICKER_ICONS: Record<string, LucideIcon>` (réutilisé par les composants de rendu des blocs pour résoudre `icon.name` → composant Lucide).

- [ ] **Step 1: Créer `src/components/funnels/config/IconPicker.tsx`**

```tsx
'use client'

// T-048 — Sélecteur d'icônes Lucide pour le contenu des blocs (cartes
// Problèmes/Programme, colonnes Qualifier). Jeu curaté plutôt qu'une
// recherche libre : évite de complexifier l'éditeur pour un usage occasionnel.

import { useState } from 'react'
import {
  CheckCircle2, XCircle, Target, TrendingUp, TrendingDown, Dumbbell, Utensils,
  Clock, Brain, Heart, Zap, Award, Users, Calendar, BarChart3, Flame,
  ShieldCheck, Star, ThumbsUp, AlertTriangle, Compass, Rocket, Trophy, Scale,
  Activity, Lightbulb, Timer, Sun, Moon, MapPin, Sparkles, Smile, Frown,
  Battery, Gauge, Salad,
  type LucideIcon,
} from 'lucide-react'

export const ICON_PICKER_ICONS: Record<string, LucideIcon> = {
  CheckCircle2, XCircle, Target, TrendingUp, TrendingDown, Dumbbell, Utensils,
  Clock, Brain, Heart, Zap, Award, Users, Calendar, BarChart3, Flame,
  ShieldCheck, Star, ThumbsUp, AlertTriangle, Compass, Rocket, Trophy, Scale,
  Activity, Lightbulb, Timer, Sun, Moon, MapPin, Sparkles, Smile, Frown,
  Battery, Gauge, Salad,
}

interface Props {
  value: { name: string } | null | undefined
  onChange: (icon: { name: string } | null) => void
}

export default function IconPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const SelectedIcon = value?.name ? ICON_PICKER_ICONS[value.name] : null

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          padding: '7px 10px', fontSize: 12, background: 'var(--bg-input)',
          border: '1px solid var(--border-primary)', borderRadius: 8,
          color: 'var(--text-primary)', cursor: 'pointer',
        }}
      >
        {SelectedIcon ? (
          <SelectedIcon size={16} />
        ) : (
          <span style={{ width: 16, height: 16, display: 'inline-block', border: '1px dashed var(--border-secondary)', borderRadius: 4 }} />
        )}
        <span>{value?.name || 'Aucune icône'}</span>
      </button>

      {open && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 10 }}
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            style={{
              position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 11,
              display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4,
              padding: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)',
              borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
              width: 240,
            }}
          >
            <button
              type="button"
              onClick={() => { onChange(null); setOpen(false) }}
              title="Aucune icône"
              style={iconBtnStyle(!value?.name)}
            >
              <XCircle size={16} />
            </button>
            {Object.entries(ICON_PICKER_ICONS).map(([name, Icon]) => (
              <button
                key={name}
                type="button"
                onClick={() => { onChange({ name }); setOpen(false) }}
                title={name}
                style={iconBtnStyle(value?.name === name)}
              >
                <Icon size={16} />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function iconBtnStyle(active: boolean): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 32, height: 32, borderRadius: 6, cursor: 'pointer',
    background: active ? 'var(--bg-active)' : 'transparent',
    border: active ? '1px solid var(--color-primary)' : '1px solid transparent',
    color: 'var(--text-primary)',
  }
}
```

- [ ] **Step 2: Vérifier la compilation**

Run: `npx tsc --noEmit`
Expected: 0 erreur (tous les noms d'icônes importés existent dans `lucide-react` — une faute de frappe ici lèverait une erreur "has no exported member").

Note : ce composant n'a pas encore de consommateur — son rendu visuel/comportemental sera vérifié manuellement en Tâche 4 quand `ProblemsConfig` l'utilise pour la première fois.

- [ ] **Step 3: Commit**

```bash
git add src/components/funnels/config/IconPicker.tsx
git commit -m "feat(funnels): ajoute IconPicker — sélecteur d'icônes Lucide curaté"
```

---

## Task 3: Composant partagé `ReorderableItemList`

**Files:**
- Create: `src/components/funnels/config/ReorderableItemList.tsx`

**Interfaces:**
- Consumes: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` (déjà des dépendances du projet, déjà utilisées dans `SectionsListPanel.tsx`)
- Produces: `export default function ReorderableItemList<T extends {id:string}>({ items, onChange, onAdd, addLabel, renderItem }: Props<T>)` — `renderItem: (item: T, index: number) => React.ReactNode` doit inclure son propre bouton de suppression (délégué à l'appelant, comme dans `FaqConfig`/`TestimonialsConfig` existants).

- [ ] **Step 1: Créer `src/components/funnels/config/ReorderableItemList.tsx`**

```tsx
'use client'

// T-048 — Wrapper générique drag & drop pour les listes d'items dans les
// panneaux de config (cartes Problèmes/Programme, points Qualifier, stats
// Coach). Même lib (dnd-kit) que le réordonnancement des blocs dans
// SectionsListPanel, mais scopée localement à une seule liste — chaque
// instance a son propre DndContext, pas de conflit entre elles ni avec
// celui des blocs.

import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { arrayMove, useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'

interface Props<T extends { id: string }> {
  items: T[]
  onChange: (items: T[]) => void
  onAdd: () => void
  addLabel: string
  /** Doit inclure son propre contrôle de suppression (bouton "Supprimer"). */
  renderItem: (item: T, index: number) => React.ReactNode
}

export default function ReorderableItemList<T extends { id: string }>({
  items, onChange, onAdd, addLabel, renderItem,
}: Props<T>) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex(i => i.id === active.id)
    const newIndex = items.findIndex(i => i.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    onChange(arrayMove(items, oldIndex, newIndex))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
          {items.map((item, i) => (
            <SortableItemRow key={item.id} id={item.id}>
              {renderItem(item, i)}
            </SortableItemRow>
          ))}
        </SortableContext>
      </DndContext>
      <button
        type="button"
        onClick={onAdd}
        style={{
          padding: '6px 12px', fontSize: 12, background: '#1a1a1a', border: '1px dashed #444',
          borderRadius: 8, color: '#aaa', cursor: 'pointer',
        }}
      >
        + {addLabel}
      </button>
    </div>
  )
}

function SortableItemRow({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition } = useSortable({ id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: transition || undefined,
    display: 'flex',
    alignItems: 'flex-start',
    gap: 6,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <button
        ref={setActivatorNodeRef}
        {...listeners}
        type="button"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 20, height: 28, flexShrink: 0, marginTop: 8,
          background: 'none', border: 'none', color: '#555', cursor: 'grab',
        }}
        title="Glisser pour réorganiser"
        aria-label="Glisser pour réorganiser"
      >
        <GripVertical size={14} />
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  )
}
```

- [ ] **Step 2: Vérifier la compilation**

Run: `npx tsc --noEmit`
Expected: 0 erreur.

Note : comme `IconPicker`, ce composant n'a pas encore de consommateur — comportement (drag réel, reorder) vérifié manuellement en Tâche 4.

- [ ] **Step 3: Commit**

```bash
git add src/components/funnels/config/ReorderableItemList.tsx
git commit -m "feat(funnels): ajoute ReorderableItemList — drag & drop générique pour listes d'items en config"
```

---

## Task 4: Module "Problèmes"

**Files:**
- Create: `src/components/funnels/config/ProblemsConfig.tsx`
- Create: `src/components/funnels/blocks/ProblemsBlock.tsx`
- Modify: `src/components/funnels/FunnelBlockConfig.tsx`
- Modify: `src/components/funnels/v2/sidebar/SectionsListPanel.tsx`
- Modify: `src/app/f/[workspaceSlug]/[funnelSlug]/[pageSlug]/page.tsx`
- Modify: `src/components/funnels/FunnelPagePreview.tsx`

**Interfaces:**
- Consumes: `ProblemsBlockConfig`, `ProblemItem` (Task 1), `ReorderableItemList` (Task 3), `IconPicker`/`ICON_PICKER_ICONS` (Task 2), `ImageUploadField` (existant, props `{value, onChange, funnelId, label?}`)
- Produces: `ProblemsConfig` (props `{config: ProblemsBlockConfig, onChange: (c: ProblemsBlockConfig)=>void, funnelId: string}`), `ProblemsBlock` (props `{config: ProblemsBlockConfig}`) — utilisés par les tâches de wiring ci-dessous et par aucune tâche suivante.

- [ ] **Step 1: Créer `src/components/funnels/config/ProblemsConfig.tsx`**

```tsx
'use client'

// T-048 — Panneau de config du bloc "Problèmes".

import type { ProblemsBlockConfig, ProblemItem } from '@/types'
import ReorderableItemList from './ReorderableItemList'
import IconPicker from './IconPicker'
import ImageUploadField from './ImageUploadField'

interface Props {
  config: ProblemsBlockConfig
  onChange: (config: ProblemsBlockConfig) => void
  funnelId: string
}

export default function ProblemsConfig({ config, onChange, funnelId }: Props) {
  const items = config.items || []

  const updateItem = (index: number, patch: Partial<ProblemItem>) => {
    const next = items.map((item, i) => (i === index ? { ...item, ...patch } : item))
    onChange({ ...config, items: next })
  }

  const addItem = () => onChange({
    ...config,
    items: [
      ...items,
      { id: crypto.randomUUID(), title: '', description: '', showNumber: true, icon: null, imageUrl: null },
    ],
  })

  const removeItem = (index: number) => onChange({ ...config, items: items.filter((_, i) => i !== index) })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <label style={labelStyle}>Titre de la section</label>
        <input
          type="text"
          value={config.title}
          onChange={e => onChange({ ...config, title: e.target.value })}
          style={inputStyle}
        />
      </div>
      <div>
        <label style={labelStyle}>Sous-titre (optionnel)</label>
        <input
          type="text"
          value={config.subtitle || ''}
          onChange={e => onChange({ ...config, subtitle: e.target.value || undefined })}
          style={inputStyle}
        />
      </div>
      <div>
        <label style={labelStyle}>Colonnes (desktop)</label>
        <select
          value={config.columns}
          onChange={e => onChange({ ...config, columns: Number(e.target.value) as 1 | 2 | 3 })}
          style={inputStyle}
        >
          <option value={1}>1 colonne</option>
          <option value={2}>2 colonnes</option>
          <option value={3}>3 colonnes</option>
        </select>
      </div>

      <ReorderableItemList
        items={items}
        onChange={next => onChange({ ...config, items: next })}
        onAdd={addItem}
        addLabel="Ajouter un problème"
        renderItem={(item, i) => (
          <div style={{ background: '#111', borderRadius: 8, padding: 10, border: '1px solid #262626' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: '#555' }}>Problème {i + 1}</span>
              <button
                type="button"
                onClick={() => removeItem(i)}
                style={{ background: 'none', border: 'none', color: '#E53E3E', fontSize: 12, cursor: 'pointer' }}
              >
                Supprimer
              </button>
            </div>
            <div style={{ marginBottom: 6 }}>
              <label style={labelStyle}>Titre</label>
              <input
                type="text"
                value={item.title}
                onChange={e => updateItem(i, { title: e.target.value })}
                style={inputStyle}
              />
            </div>
            <div style={{ marginBottom: 6 }}>
              <label style={labelStyle}>Description</label>
              <textarea
                value={item.description}
                onChange={e => updateItem(i, { description: e.target.value })}
                rows={2}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#aaa', cursor: 'pointer', marginBottom: 8 }}>
              <input
                type="checkbox"
                checked={item.showNumber}
                onChange={e => updateItem(i, { showNumber: e.target.checked })}
                style={{ accentColor: 'var(--color-primary)' }}
              />
              Afficher le numéro
            </label>
            <div style={{ marginBottom: 6 }}>
              <label style={labelStyle}>Icône (optionnelle)</label>
              <IconPicker value={item.icon} onChange={icon => updateItem(i, { icon })} />
            </div>
            <ImageUploadField
              value={item.imageUrl || ''}
              onChange={url => updateItem(i, { imageUrl: url || null })}
              funnelId={funnelId}
              label="Image (optionnelle)"
            />
          </div>
        )}
      />
    </div>
  )
}

const labelStyle: React.CSSProperties = { fontSize: 11, color: '#555', display: 'block', marginBottom: 4 }
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px', fontSize: 13,
  background: '#0a0a0a', border: '1px solid #333', borderRadius: 8,
  color: '#fff', outline: 'none',
}
```

- [ ] **Step 2: Créer `src/components/funnels/blocks/ProblemsBlock.tsx`**

```tsx
'use client'

// T-048 — Bloc "Problèmes" : grille de cartes présentant les problèmes de
// la cible, pour qu'elle se reconnaisse dans sa situation actuelle.

import type { ProblemsBlockConfig } from '@/types'
import { ICON_PICKER_ICONS } from '../config/IconPicker'

interface Props {
  config: ProblemsBlockConfig
}

const MINMAX_BY_COLUMNS: Record<1 | 2 | 3, number> = { 1: 480, 2: 320, 3: 260 }

export default function ProblemsBlock({ config }: Props) {
  const items = config.items || []
  if (items.length === 0) return null

  return (
    <div style={{ padding: '60px 20px', maxWidth: 1100, margin: '0 auto' }}>
      {config.title && (
        <h2 style={{ fontSize: 32, fontWeight: 800, color: 'var(--fnl-text)', margin: '0 0 12px', textAlign: 'center', lineHeight: 1.3 }}>
          {config.title}
        </h2>
      )}
      {config.subtitle && (
        <p style={{ fontSize: 16, color: 'var(--fnl-text-secondary)', textAlign: 'center', margin: '0 0 36px' }}>
          {config.subtitle}
        </p>
      )}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(auto-fit, minmax(${MINMAX_BY_COLUMNS[config.columns]}px, 1fr))`,
          gap: 24,
        }}
      >
        {items.map((item, i) => {
          const Icon = item.icon?.name ? ICON_PICKER_ICONS[item.icon.name] : null
          return (
            <div
              key={item.id}
              style={{
                background: 'var(--fnl-section-bg)',
                borderRadius: 20,
                padding: '28px 24px',
                border: '1px solid rgba(var(--fnl-primary-rgb), 0.15)',
                boxShadow: '0 8px 30px rgba(var(--fnl-primary-rgb), 0.1), 0 2px 10px rgba(0, 0, 0, 0.05)',
                textAlign: 'left',
              }}
            >
              {item.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.imageUrl} alt="" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 12, marginBottom: 16 }} />
              ) : Icon ? (
                <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(var(--fnl-primary-rgb), 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                  <Icon size={24} color="var(--fnl-primary)" />
                </div>
              ) : null}
              {item.showNumber && (
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fnl-primary)', letterSpacing: '0.05em', marginBottom: 6 }}>
                  PROBLÈME {String(i + 1).padStart(2, '0')}
                </div>
              )}
              <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--fnl-text)', margin: '0 0 8px' }}>
                {item.title}
              </h3>
              <p style={{ fontSize: 14, color: 'var(--fnl-text-secondary)', margin: 0, lineHeight: 1.6 }}>
                {item.description}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Brancher dans `src/components/funnels/FunnelBlockConfig.tsx`**

Ajouter l'import (après `import FooterConfig from './config/FooterConfig'`) :

```ts
import ProblemsConfig from './config/ProblemsConfig'
```

Ajouter dans `LABELS` :

```ts
problems: 'Problèmes',
```

Ajouter après le bloc `{block.type === 'footer' && (...)}` :

```tsx
{block.type === 'problems' && (
  <ProblemsConfig
    config={block.config as Parameters<typeof ProblemsConfig>[0]['config']}
    onChange={c => handleConfigChange(c)}
    funnelId={funnelId}
  />
)}
```

- [ ] **Step 4: Ajouter l'entrée menu dans `src/components/funnels/v2/sidebar/SectionsListPanel.tsx`**

Ajouter `AlertCircle` à l'import `lucide-react` existant (ligne ~30-34) :

```ts
import {
  GripVertical, X, Plus,
  Crosshair, Video, Type, ImageIcon, MousePointerClick, DollarSign,
  MessageSquareQuote, HelpCircle, Timer, ArrowUpDown, PanelBottom,
  Calendar, FileText, CalendarPlus, AlertCircle,
} from 'lucide-react'
```

Ajouter l'entrée dans `BLOCK_TYPES`, juste après `testimonials` :

```ts
{ type: 'problems', label: 'Problèmes', icon: <AlertCircle size={ICON_SIZE} /> },
```

- [ ] **Step 5: Brancher le rendu public dans `src/app/f/[workspaceSlug]/[funnelSlug]/[pageSlug]/page.tsx`**

Ajouter `ProblemsBlockConfig` à l'import de types (ligne 18-37) et `import ProblemsBlock from '@/components/funnels/blocks/ProblemsBlock'` après l'import de `FooterBlock` (ligne 52).

Ajouter un `case` dans `renderBlock()`, avant `default:` :

```tsx
    case 'problems':
      content = <ProblemsBlock config={block.config as ProblemsBlockConfig} />; break
```

- [ ] **Step 6: Brancher le rendu preview dans `src/components/funnels/FunnelPagePreview.tsx`**

Ajouter `import ProblemsBlock from './blocks/ProblemsBlock'` après l'import de `FooterBlock` (ligne 66).

Ajouter un `case` dans `renderBlockContent()`, avant `default:` :

```tsx
    case 'problems': return <ProblemsBlock config={block.config as Parameters<typeof ProblemsBlock>[0]['config']} />
```

- [ ] **Step 7: Vérifier la compilation**

Run: `npx tsc --noEmit`
Expected: 0 erreur.

- [ ] **Step 8: Test manuel en navigateur**

Run: `npm run dev`, ouvrir l'éditeur d'un funnel de test.

1. Cliquer "+ Ajouter une section" → "Problèmes" doit apparaître dans le menu avec l'icône `AlertCircle` et s'ajouter à la page avec le contenu par défaut (3 cartes pré-remplies).
2. Éditer le titre/sous-titre de section → le rendu preview se met à jour en temps réel.
3. Sur une carte : changer le titre, la description, choisir une icône via `IconPicker`, uploader une image (l'image doit remplacer l'icône dans le rendu), décocher "Afficher le numéro" (le badge "PROBLÈME 0X" doit disparaître).
4. Ajouter une 4e carte, la faire glisser en 1re position via le drag handle → l'ordre doit se refléter dans le preview.
5. Supprimer une carte.
6. Changer "Colonnes" de 3 à 1 → la grille doit passer à 1 colonne dans le preview desktop.
7. Sauvegarder (autosave), recharger la page de l'éditeur → le contenu doit être identique après rechargement (persistence JSONB).
8. Basculer le mode preview desktop/tablette/mobile → pas d'overflow horizontal, cartes lisibles, texte non tronqué.

- [ ] **Step 9: Commit**

```bash
git add src/components/funnels/config/ProblemsConfig.tsx src/components/funnels/blocks/ProblemsBlock.tsx \
  src/components/funnels/FunnelBlockConfig.tsx src/components/funnels/v2/sidebar/SectionsListPanel.tsx \
  "src/app/f/[workspaceSlug]/[funnelSlug]/[pageSlug]/page.tsx" src/components/funnels/FunnelPagePreview.tsx
git commit -m "feat(funnels): ajoute le module de bloc Problèmes"
```

---

## Task 5: Module "Programme / Méthode"

**Files:**
- Create: `src/components/funnels/config/ProgramConfig.tsx`
- Create: `src/components/funnels/blocks/ProgramBlock.tsx`
- Modify: `src/components/funnels/FunnelBlockConfig.tsx`
- Modify: `src/components/funnels/v2/sidebar/SectionsListPanel.tsx`
- Modify: `src/app/f/[workspaceSlug]/[funnelSlug]/[pageSlug]/page.tsx`
- Modify: `src/components/funnels/FunnelPagePreview.tsx`

**Interfaces:**
- Consumes: `ProgramBlockConfig`, `ProgramStep` (Task 1), `ReorderableItemList` (Task 3), `IconPicker`/`ICON_PICKER_ICONS` (Task 2), `ImageUploadField` (existant)
- Produces: `ProgramConfig`, `ProgramBlock` — utilisés uniquement par le wiring de cette tâche.

- [ ] **Step 1: Créer `src/components/funnels/config/ProgramConfig.tsx`**

```tsx
'use client'

// T-048 — Panneau de config du bloc "Programme / Méthode".

import type { ProgramBlockConfig, ProgramStep } from '@/types'
import ReorderableItemList from './ReorderableItemList'
import IconPicker from './IconPicker'
import ImageUploadField from './ImageUploadField'

interface Props {
  config: ProgramBlockConfig
  onChange: (config: ProgramBlockConfig) => void
  funnelId: string
}

export default function ProgramConfig({ config, onChange, funnelId }: Props) {
  const items = config.items || []

  const updateItem = (index: number, patch: Partial<ProgramStep>) => {
    const next = items.map((item, i) => (i === index ? { ...item, ...patch } : item))
    onChange({ ...config, items: next })
  }

  const addItem = () => onChange({
    ...config,
    items: [
      ...items,
      {
        id: crypto.randomUUID(),
        number: String(items.length + 1).padStart(2, '0'),
        title: '',
        description: '',
        icon: null,
        imageUrl: null,
      },
    ],
  })

  const removeItem = (index: number) => onChange({ ...config, items: items.filter((_, i) => i !== index) })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <label style={labelStyle}>Titre de la section</label>
        <input
          type="text"
          value={config.title}
          onChange={e => onChange({ ...config, title: e.target.value })}
          style={inputStyle}
        />
      </div>
      <div>
        <label style={labelStyle}>Sous-titre (optionnel)</label>
        <input
          type="text"
          value={config.subtitle || ''}
          onChange={e => onChange({ ...config, subtitle: e.target.value || undefined })}
          style={inputStyle}
        />
      </div>
      <div>
        <label style={labelStyle}>Colonnes (desktop)</label>
        <select
          value={config.columns}
          onChange={e => onChange({ ...config, columns: Number(e.target.value) as 2 | 3 | 4 })}
          style={inputStyle}
        >
          <option value={2}>2 colonnes</option>
          <option value={3}>3 colonnes</option>
          <option value={4}>4 colonnes</option>
        </select>
      </div>

      <ReorderableItemList
        items={items}
        onChange={next => onChange({ ...config, items: next })}
        onAdd={addItem}
        addLabel="Ajouter une étape"
        renderItem={(item, i) => (
          <div style={{ background: '#111', borderRadius: 8, padding: 10, border: '1px solid #262626' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: '#555' }}>Étape {i + 1}</span>
              <button
                type="button"
                onClick={() => removeItem(i)}
                style={{ background: 'none', border: 'none', color: '#E53E3E', fontSize: 12, cursor: 'pointer' }}
              >
                Supprimer
              </button>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
              <div style={{ width: 70 }}>
                <label style={labelStyle}>Numéro</label>
                <input
                  type="text"
                  value={item.number}
                  onChange={e => updateItem(i, { number: e.target.value })}
                  style={inputStyle}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Titre</label>
                <input
                  type="text"
                  value={item.title}
                  onChange={e => updateItem(i, { title: e.target.value })}
                  style={inputStyle}
                />
              </div>
            </div>
            <div style={{ marginBottom: 6 }}>
              <label style={labelStyle}>Description</label>
              <textarea
                value={item.description}
                onChange={e => updateItem(i, { description: e.target.value })}
                rows={2}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>
            <div style={{ marginBottom: 6 }}>
              <label style={labelStyle}>Icône (optionnelle)</label>
              <IconPicker value={item.icon} onChange={icon => updateItem(i, { icon })} />
            </div>
            <ImageUploadField
              value={item.imageUrl || ''}
              onChange={url => updateItem(i, { imageUrl: url || null })}
              funnelId={funnelId}
              label="Image (optionnelle)"
            />
          </div>
        )}
      />
    </div>
  )
}

const labelStyle: React.CSSProperties = { fontSize: 11, color: '#555', display: 'block', marginBottom: 4 }
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px', fontSize: 13,
  background: '#0a0a0a', border: '1px solid #333', borderRadius: 8,
  color: '#fff', outline: 'none',
}
```

- [ ] **Step 2: Créer `src/components/funnels/blocks/ProgramBlock.tsx`**

```tsx
'use client'

// T-048 — Bloc "Programme / Méthode" : grille de cartes numérotées
// présentant les étapes de l'accompagnement.

import type { ProgramBlockConfig } from '@/types'
import { ICON_PICKER_ICONS } from '../config/IconPicker'

interface Props {
  config: ProgramBlockConfig
}

const MINMAX_BY_COLUMNS: Record<2 | 3 | 4, number> = { 2: 380, 3: 280, 4: 220 }

export default function ProgramBlock({ config }: Props) {
  const items = config.items || []
  if (items.length === 0) return null

  return (
    <div style={{ padding: '60px 20px', maxWidth: 1100, margin: '0 auto' }}>
      {config.title && (
        <h2 style={{ fontSize: 32, fontWeight: 800, color: 'var(--fnl-text)', margin: '0 0 12px', textAlign: 'center', lineHeight: 1.3 }}>
          {config.title}
        </h2>
      )}
      {config.subtitle && (
        <p style={{ fontSize: 16, color: 'var(--fnl-text-secondary)', textAlign: 'center', margin: '0 0 36px' }}>
          {config.subtitle}
        </p>
      )}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(auto-fit, minmax(${MINMAX_BY_COLUMNS[config.columns]}px, 1fr))`,
          gap: 24,
        }}
      >
        {items.map(item => {
          const Icon = item.icon?.name ? ICON_PICKER_ICONS[item.icon.name] : null
          return (
            <div
              key={item.id}
              style={{
                background: 'var(--fnl-section-bg)',
                borderRadius: 20,
                padding: '28px 24px',
                border: '1px solid rgba(var(--fnl-primary-rgb), 0.15)',
                boxShadow: '0 8px 30px rgba(var(--fnl-primary-rgb), 0.1), 0 2px 10px rgba(0, 0, 0, 0.05)',
                textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <span style={{ fontSize: 32, fontWeight: 900, color: 'var(--fnl-primary)', lineHeight: 1, fontFamily: 'Poppins, sans-serif' }}>
                  {item.number}
                </span>
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.imageUrl} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 10 }} />
                ) : Icon ? (
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(var(--fnl-primary-rgb), 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={20} color="var(--fnl-primary)" />
                  </div>
                ) : null}
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--fnl-text)', margin: '0 0 8px' }}>
                {item.title}
              </h3>
              <p style={{ fontSize: 14, color: 'var(--fnl-text-secondary)', margin: 0, lineHeight: 1.6 }}>
                {item.description}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Brancher dans `src/components/funnels/FunnelBlockConfig.tsx`**

Import : `import ProgramConfig from './config/ProgramConfig'`
`LABELS` : `program: 'Programme / Méthode',`
Branche :

```tsx
{block.type === 'program' && (
  <ProgramConfig
    config={block.config as Parameters<typeof ProgramConfig>[0]['config']}
    onChange={c => handleConfigChange(c)}
    funnelId={funnelId}
  />
)}
```

- [ ] **Step 4: Ajouter l'entrée menu dans `SectionsListPanel.tsx`**

Ajouter `ListChecks` à l'import `lucide-react`. Ajouter après l'entrée `problems` :

```ts
{ type: 'program', label: 'Programme / Méthode', icon: <ListChecks size={ICON_SIZE} /> },
```

- [ ] **Step 5: Brancher le rendu public dans `page.tsx`**

Ajouter `ProgramBlockConfig` à l'import de types, `import ProgramBlock from '@/components/funnels/blocks/ProgramBlock'`, et le `case` :

```tsx
    case 'program':
      content = <ProgramBlock config={block.config as ProgramBlockConfig} />; break
```

- [ ] **Step 6: Brancher le rendu preview dans `FunnelPagePreview.tsx`**

`import ProgramBlock from './blocks/ProgramBlock'`, puis :

```tsx
    case 'program': return <ProgramBlock config={block.config as Parameters<typeof ProgramBlock>[0]['config']} />
```

- [ ] **Step 7: Vérifier la compilation**

Run: `npx tsc --noEmit`
Expected: 0 erreur.

- [ ] **Step 8: Test manuel en navigateur**

Mêmes vérifications que Task 4 Step 8, adaptées : ajout du bloc "Programme / Méthode" depuis le menu, édition numéro/titre/description/icône/image par étape, ajout/suppression/reorder d'étapes, changement du nombre de colonnes (2/3/4), persistence après reload, vérif desktop/tablette/mobile. Vérifier spécifiquement que le composant supporte plus de 4 étapes (en ajouter une 5e) sans limite artificielle.

- [ ] **Step 9: Commit**

```bash
git add src/components/funnels/config/ProgramConfig.tsx src/components/funnels/blocks/ProgramBlock.tsx \
  src/components/funnels/FunnelBlockConfig.tsx src/components/funnels/v2/sidebar/SectionsListPanel.tsx \
  "src/app/f/[workspaceSlug]/[funnelSlug]/[pageSlug]/page.tsx" src/components/funnels/FunnelPagePreview.tsx
git commit -m "feat(funnels): ajoute le module de bloc Programme / Méthode"
```

---

## Task 6: Module "C'est pour toi / Pas pour toi"

**Files:**
- Create: `src/components/funnels/config/QualifierConfig.tsx`
- Create: `src/components/funnels/blocks/QualifierBlock.tsx`
- Modify: `src/components/funnels/FunnelBlockConfig.tsx`
- Modify: `src/components/funnels/v2/sidebar/SectionsListPanel.tsx`
- Modify: `src/app/f/[workspaceSlug]/[funnelSlug]/[pageSlug]/page.tsx`
- Modify: `src/components/funnels/FunnelPagePreview.tsx`

**Interfaces:**
- Consumes: `QualifierBlockConfig`, `QualifierColumn`, `QualifierPoint` (Task 1), `ReorderableItemList` (Task 3), `IconPicker`/`ICON_PICKER_ICONS` (Task 2)
- Produces: `QualifierConfig`, `QualifierBlock` — utilisés uniquement par le wiring de cette tâche.

- [ ] **Step 1: Créer `src/components/funnels/config/QualifierConfig.tsx`**

```tsx
'use client'

// T-048 — Panneau de config du bloc "C'est pour toi / Pas pour toi".
// Deux colonnes indépendantes (yes/no), chacune avec sa propre liste de
// points réordonnable.

import type { QualifierBlockConfig, QualifierColumn, QualifierPoint } from '@/types'
import ReorderableItemList from './ReorderableItemList'
import IconPicker from './IconPicker'

interface Props {
  config: QualifierBlockConfig
  onChange: (config: QualifierBlockConfig) => void
}

function ColumnEditor({
  column, onChange, addLabel,
}: {
  column: QualifierColumn
  onChange: (column: QualifierColumn) => void
  addLabel: string
}) {
  const items = column.items || []

  const updateItem = (index: number, patch: Partial<QualifierPoint>) => {
    const next = items.map((item, i) => (i === index ? { ...item, ...patch } : item))
    onChange({ ...column, items: next })
  }

  const addItem = () => onChange({ ...column, items: [...items, { id: crypto.randomUUID(), text: '' }] })
  const removeItem = (index: number) => onChange({ ...column, items: items.filter((_, i) => i !== index) })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: '#0d0d0d', border: '1px solid #262626', borderRadius: 8, padding: 10 }}>
      <div>
        <label style={labelStyle}>Titre de la colonne</label>
        <input
          type="text"
          value={column.title}
          onChange={e => onChange({ ...column, title: e.target.value })}
          style={inputStyle}
        />
      </div>
      <div>
        <label style={labelStyle}>Sous-titre (optionnel)</label>
        <input
          type="text"
          value={column.subtitle || ''}
          onChange={e => onChange({ ...column, subtitle: e.target.value || undefined })}
          style={inputStyle}
        />
      </div>
      <div>
        <label style={labelStyle}>Icône (optionnelle)</label>
        <IconPicker value={column.icon} onChange={icon => onChange({ ...column, icon })} />
      </div>
      <ReorderableItemList
        items={items}
        onChange={next => onChange({ ...column, items: next })}
        onAdd={addItem}
        addLabel={addLabel}
        renderItem={(item, i) => (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="text"
              value={item.text}
              onChange={e => updateItem(i, { text: e.target.value })}
              style={{ ...inputStyle, flex: 1 }}
            />
            <button
              type="button"
              onClick={() => removeItem(i)}
              style={{ background: 'none', border: 'none', color: '#E53E3E', fontSize: 12, cursor: 'pointer', flexShrink: 0 }}
            >
              ✕
            </button>
          </div>
        )}
      />
    </div>
  )
}

export default function QualifierConfig({ config, onChange }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <ColumnEditor
        column={config.yes}
        onChange={yes => onChange({ ...config, yes })}
        addLabel="Ajouter un critère"
      />
      <ColumnEditor
        column={config.no}
        onChange={no => onChange({ ...config, no })}
        addLabel="Ajouter un critère"
      />
    </div>
  )
}

const labelStyle: React.CSSProperties = { fontSize: 11, color: '#555', display: 'block', marginBottom: 4 }
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px', fontSize: 13,
  background: '#0a0a0a', border: '1px solid #333', borderRadius: 8,
  color: '#fff', outline: 'none',
}
```

- [ ] **Step 2: Créer `src/components/funnels/blocks/QualifierBlock.tsx`**

```tsx
'use client'

// T-048 — Bloc "C'est pour toi / Pas pour toi" : deux colonnes de
// qualification. Couleurs vert/rouge fixes (sémantiques), indépendantes
// du thème --fnl-primary — cohérent avec l'exemple ✓/✕ de la demande.

import type { QualifierBlockConfig, QualifierColumn } from '@/types'
import { ICON_PICKER_ICONS } from '../config/IconPicker'

interface Props {
  config: QualifierBlockConfig
}

function ColumnCard({ column, variant }: { column: QualifierColumn; variant: 'yes' | 'no' }) {
  const accent = variant === 'yes' ? '#38A169' : '#E53E3E'
  const mark = variant === 'yes' ? '✓' : '✕'
  const Icon = column.icon?.name ? ICON_PICKER_ICONS[column.icon.name] : null
  const items = column.items || []

  return (
    <div
      style={{
        background: 'var(--fnl-section-bg)',
        borderRadius: 20,
        padding: '32px 28px',
        border: `1px solid ${accent}33`,
        textAlign: 'left',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        {Icon && <Icon size={22} color={accent} />}
        <h3 style={{ fontSize: 20, fontWeight: 800, color: accent, margin: 0 }}>{column.title}</h3>
      </div>
      {column.subtitle && (
        <p style={{ fontSize: 14, color: 'var(--fnl-text-secondary)', margin: '0 0 20px' }}>{column.subtitle}</p>
      )}
      <ul style={{ listStyle: 'none', padding: 0, margin: column.subtitle ? 0 : '20px 0 0' }}>
        {items.map(item => (
          <li key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0' }}>
            <span style={{ color: accent, fontWeight: 900, fontSize: 16, flexShrink: 0, lineHeight: 1.5 }}>{mark}</span>
            <span style={{ fontSize: 15, color: 'var(--fnl-text)', lineHeight: 1.5 }}>{item.text}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function QualifierBlock({ config }: Props) {
  return (
    <div style={{ padding: '60px 20px', maxWidth: 1000, margin: '0 auto' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: 24,
        }}
      >
        <ColumnCard column={config.yes} variant="yes" />
        <ColumnCard column={config.no} variant="no" />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Brancher dans `FunnelBlockConfig.tsx`**

Import : `import QualifierConfig from './config/QualifierConfig'`
`LABELS` : `qualifier: 'C\'est pour toi / Pas pour toi',`
Branche :

```tsx
{block.type === 'qualifier' && (
  <QualifierConfig
    config={block.config as Parameters<typeof QualifierConfig>[0]['config']}
    onChange={c => handleConfigChange(c)}
  />
)}
```

- [ ] **Step 4: Ajouter l'entrée menu dans `SectionsListPanel.tsx`**

Ajouter `CheckCheck` à l'import `lucide-react`. Ajouter après l'entrée `program` :

```ts
{ type: 'qualifier', label: 'C\'est pour toi / Pas pour toi', icon: <CheckCheck size={ICON_SIZE} /> },
```

- [ ] **Step 5: Brancher le rendu public dans `page.tsx`**

Ajouter `QualifierBlockConfig` à l'import de types, `import QualifierBlock from '@/components/funnels/blocks/QualifierBlock'`, et le `case` :

```tsx
    case 'qualifier':
      content = <QualifierBlock config={block.config as QualifierBlockConfig} />; break
```

- [ ] **Step 6: Brancher le rendu preview dans `FunnelPagePreview.tsx`**

`import QualifierBlock from './blocks/QualifierBlock'`, puis :

```tsx
    case 'qualifier': return <QualifierBlock config={block.config as Parameters<typeof QualifierBlock>[0]['config']} />
```

- [ ] **Step 7: Vérifier la compilation**

Run: `npx tsc --noEmit`
Expected: 0 erreur.

- [ ] **Step 8: Test manuel en navigateur**

Ajout du bloc depuis le menu, édition des titres/sous-titres/icônes de chaque colonne, ajout/suppression/reorder de points dans chaque colonne indépendamment (vérifier que réordonner la colonne "Oui" n'affecte pas la colonne "Non"), persistence après reload. Vérifier le responsive : sur mobile (largeur 375 dans le preview), les 2 colonnes doivent s'empiler verticalement sans overflow horizontal.

- [ ] **Step 9: Commit**

```bash
git add src/components/funnels/config/QualifierConfig.tsx src/components/funnels/blocks/QualifierBlock.tsx \
  src/components/funnels/FunnelBlockConfig.tsx src/components/funnels/v2/sidebar/SectionsListPanel.tsx \
  "src/app/f/[workspaceSlug]/[funnelSlug]/[pageSlug]/page.tsx" src/components/funnels/FunnelPagePreview.tsx
git commit -m "feat(funnels): ajoute le module de bloc C'est pour toi / Pas pour toi"
```

---

## Task 7: Module "Présentation du coach"

**Files:**
- Create: `src/components/funnels/config/AboutCoachConfig.tsx`
- Create: `src/components/funnels/blocks/AboutCoachBlock.tsx`
- Modify: `src/components/funnels/FunnelBlockConfig.tsx`
- Modify: `src/components/funnels/v2/sidebar/SectionsListPanel.tsx`
- Modify: `src/app/f/[workspaceSlug]/[funnelSlug]/[pageSlug]/page.tsx`
- Modify: `src/components/funnels/FunnelPagePreview.tsx`

**Interfaces:**
- Consumes: `AboutCoachBlockConfig`, `CoachStat` (Task 1), `ReorderableItemList` (Task 3), `ImageUploadField` (existant), `resolveFunnelUrl` (existant, `src/lib/funnels/resolve-url.ts`)
- Produces: `AboutCoachConfig`, `AboutCoachBlock` — dernier module, aucune tâche suivante n'en dépend.

- [ ] **Step 1: Créer `src/components/funnels/config/AboutCoachConfig.tsx`**

```tsx
'use client'

// T-048 — Panneau de config du bloc "Présentation du coach".

import type { AboutCoachBlockConfig, CoachStat } from '@/types'
import ReorderableItemList from './ReorderableItemList'
import ImageUploadField from './ImageUploadField'

interface Props {
  config: AboutCoachBlockConfig
  onChange: (config: AboutCoachBlockConfig) => void
  funnelId: string
}

export default function AboutCoachConfig({ config, onChange, funnelId }: Props) {
  const stats = config.stats || []

  const updateStat = (index: number, patch: Partial<CoachStat>) => {
    const next = stats.map((s, i) => (i === index ? { ...s, ...patch } : s))
    onChange({ ...config, stats: next })
  }

  const addStat = () => onChange({ ...config, stats: [...stats, { id: crypto.randomUUID(), value: '', label: '' }] })
  const removeStat = (index: number) => onChange({ ...config, stats: stats.filter((_, i) => i !== index) })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <ImageUploadField
        value={config.imageUrl || ''}
        onChange={url => onChange({ ...config, imageUrl: url || null })}
        funnelId={funnelId}
        label="Photo du coach"
      />
      <div>
        <label style={labelStyle}>Titre</label>
        <input
          type="text"
          value={config.title}
          onChange={e => onChange({ ...config, title: e.target.value })}
          style={inputStyle}
        />
      </div>
      <div>
        <label style={labelStyle}>Sous-titre (optionnel)</label>
        <input
          type="text"
          value={config.subtitle || ''}
          onChange={e => onChange({ ...config, subtitle: e.target.value || undefined })}
          style={inputStyle}
        />
      </div>
      <div>
        <label style={labelStyle}>Texte de présentation</label>
        <textarea
          value={config.text}
          onChange={e => onChange({ ...config, text: e.target.value })}
          rows={4}
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </div>
      <div>
        <label style={labelStyle}>Disposition</label>
        <select
          value={config.layout}
          onChange={e => onChange({ ...config, layout: e.target.value as 'image-left' | 'image-right' })}
          style={inputStyle}
        >
          <option value="image-left">Image à gauche</option>
          <option value="image-right">Image à droite</option>
        </select>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Texte du bouton (optionnel)</label>
          <input
            type="text"
            value={config.ctaText || ''}
            onChange={e => onChange({ ...config, ctaText: e.target.value || undefined })}
            style={inputStyle}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Lien du bouton</label>
          <input
            type="text"
            value={config.ctaUrl || ''}
            onChange={e => onChange({ ...config, ctaUrl: e.target.value || undefined })}
            placeholder="#, page:slug ou URL"
            style={inputStyle}
          />
        </div>
      </div>

      <div>
        <label style={labelStyle}>Statistiques</label>
        <ReorderableItemList
          items={stats}
          onChange={next => onChange({ ...config, stats: next })}
          onAdd={addStat}
          addLabel="Ajouter une statistique"
          renderItem={(stat, i) => (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                type="text"
                value={stat.value}
                onChange={e => updateStat(i, { value: e.target.value })}
                placeholder="100+"
                style={{ ...inputStyle, width: 70 }}
              />
              <input
                type="text"
                value={stat.label}
                onChange={e => updateStat(i, { label: e.target.value })}
                placeholder="Clients accompagnés"
                style={{ ...inputStyle, flex: 1 }}
              />
              <button
                type="button"
                onClick={() => removeStat(i)}
                style={{ background: 'none', border: 'none', color: '#E53E3E', fontSize: 12, cursor: 'pointer', flexShrink: 0 }}
              >
                ✕
              </button>
            </div>
          )}
        />
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = { fontSize: 11, color: '#555', display: 'block', marginBottom: 4 }
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px', fontSize: 13,
  background: '#0a0a0a', border: '1px solid #333', borderRadius: 8,
  color: '#fff', outline: 'none',
}
```

- [ ] **Step 2: Créer `src/components/funnels/blocks/AboutCoachBlock.tsx`**

```tsx
'use client'

// T-048 — Bloc "Présentation du coach" : image + texte + stats
// d'autorité, layout image-gauche/droite. Utilise flex-wrap plutôt qu'une
// media query dédiée — même logique de dégradation douce que les grilles
// auto-fit des autres blocs.

import type { AboutCoachBlockConfig } from '@/types'
import { resolveFunnelUrl } from '@/lib/funnels/resolve-url'

interface Props {
  config: AboutCoachBlockConfig
}

export default function AboutCoachBlock({ config }: Props) {
  const isImageRight = config.layout === 'image-right'
  const stats = config.stats || []

  const imageEl = config.imageUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={config.imageUrl}
      alt={config.title}
      style={{ width: '100%', height: 'auto', borderRadius: 20, display: 'block', objectFit: 'cover' }}
    />
  ) : null

  const textEl = (
    <div style={{ flex: '1 1 360px', minWidth: 0 }}>
      {config.title && (
        <h2 style={{ fontSize: 28, fontWeight: 800, color: 'var(--fnl-text)', margin: '0 0 8px', lineHeight: 1.3 }}>
          {config.title}
        </h2>
      )}
      {config.subtitle && (
        <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--fnl-primary)', margin: '0 0 16px' }}>
          {config.subtitle}
        </p>
      )}
      {config.text && (
        <p style={{ fontSize: 15, color: 'var(--fnl-text-secondary)', lineHeight: 1.7, margin: '0 0 24px', whiteSpace: 'pre-wrap' }}>
          {config.text}
        </p>
      )}
      {stats.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, margin: '0 0 24px' }}>
          {stats.map(stat => (
            <div key={stat.id}>
              <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--fnl-primary)', lineHeight: 1, fontFamily: 'Poppins, sans-serif' }}>
                {stat.value}
              </div>
              <div style={{ fontSize: 13, color: 'var(--fnl-text-secondary)', marginTop: 4 }}>{stat.label}</div>
            </div>
          ))}
        </div>
      )}
      {config.ctaText && (
        <a href={resolveFunnelUrl(config.ctaUrl)} className="fnl-btn">
          {config.ctaText}
        </a>
      )}
    </div>
  )

  return (
    <div style={{ padding: '60px 20px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 40, alignItems: 'center' }}>
        {imageEl && (
          <div style={{ flex: '1 1 320px', minWidth: 0, order: isImageRight ? 2 : 0 }}>
            {imageEl}
          </div>
        )}
        {textEl}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Brancher dans `FunnelBlockConfig.tsx`**

Import : `import AboutCoachConfig from './config/AboutCoachConfig'`
`LABELS` : `about_coach: 'Présentation du coach',`
Branche :

```tsx
{block.type === 'about_coach' && (
  <AboutCoachConfig
    config={block.config as Parameters<typeof AboutCoachConfig>[0]['config']}
    onChange={c => handleConfigChange(c)}
    funnelId={funnelId}
  />
)}
```

- [ ] **Step 4: Ajouter l'entrée menu dans `SectionsListPanel.tsx`**

Ajouter `UserCircle` à l'import `lucide-react`. Ajouter après l'entrée `qualifier` :

```ts
{ type: 'about_coach', label: 'Présentation du coach', icon: <UserCircle size={ICON_SIZE} /> },
```

- [ ] **Step 5: Brancher le rendu public dans `page.tsx`**

Ajouter `AboutCoachBlockConfig` à l'import de types, `import AboutCoachBlock from '@/components/funnels/blocks/AboutCoachBlock'`, et le `case` :

```tsx
    case 'about_coach':
      content = <AboutCoachBlock config={block.config as AboutCoachBlockConfig} />; break
```

- [ ] **Step 6: Brancher le rendu preview dans `FunnelPagePreview.tsx`**

`import AboutCoachBlock from './blocks/AboutCoachBlock'`, puis :

```tsx
    case 'about_coach': return <AboutCoachBlock config={block.config as Parameters<typeof AboutCoachBlock>[0]['config']} />
```

- [ ] **Step 7: Vérifier la compilation**

Run: `npx tsc --noEmit`
Expected: 0 erreur.

- [ ] **Step 8: Test manuel en navigateur**

Ajout du bloc depuis le menu, upload de l'image du coach, édition titre/sous-titre/texte, changement de disposition (image-left ↔ image-right — vérifier que l'ordre visuel change), ajout/suppression/reorder de statistiques, configuration du CTA (avec une URL `page:slug` d'une autre page du funnel pour vérifier que `resolveFunnelUrl` fonctionne), persistence après reload. Vérifier le responsive : sur mobile, image et texte doivent s'empiler proprement sans overflow.

- [ ] **Step 9: Commit**

```bash
git add src/components/funnels/config/AboutCoachConfig.tsx src/components/funnels/blocks/AboutCoachBlock.tsx \
  src/components/funnels/FunnelBlockConfig.tsx src/components/funnels/v2/sidebar/SectionsListPanel.tsx \
  "src/app/f/[workspaceSlug]/[funnelSlug]/[pageSlug]/page.tsx" src/components/funnels/FunnelPagePreview.tsx
git commit -m "feat(funnels): ajoute le module de bloc Présentation du coach"
```

---

## Task 8: Régression, build, fichiers de suivi

**Files:**
- Create: `taches/tache-048-landing-page-4-modules.md`
- Modify: `etat.md`
- Modify: `ameliorations.md`

**Interfaces:**
- Consumes: rien de nouveau — vérifie l'ensemble du travail des tâches 1-7.
- Produces: rien — tâche de clôture.

- [ ] **Step 1: Build de production**

Run: `npm run build`
Expected: build réussi, 0 erreur TypeScript, 0 erreur de lint bloquante.

- [ ] **Step 2: Non-régression sur une landing page existante**

Run: `npm run dev`, ouvrir dans le navigateur une page de funnel existante (créée avant cette feature, avec des blocs parmi les 13 d'origine — ex. la landing page personnelle de Rémy).

Vérifier : rendu visuel identique à avant (pas de diff), aucune erreur dans la console navigateur, tous les blocs existants s'éditent normalement dans le builder.

- [ ] **Step 3: Test bout-en-bout combinant les 4 nouveaux modules + blocs existants**

Sur une page de funnel de test, construire une séquence combinant Hero → Problèmes → Programme/Méthode → Qualifier → Présentation du coach → FAQ → Footer. Vérifier :
- Le drag & drop **entre blocs** (réordonner les sections dans la sidebar) fonctionne normalement avec les nouveaux types mélangés aux anciens.
- La sauvegarde persiste bien les 4 nouveaux types de blocs après un rechargement complet de la page (`Cmd+R`), pas seulement un re-render React.
- Le mode preview desktop/tablette/mobile est correct sur toute la page assemblée.

- [ ] **Step 4: Créer `taches/tache-048-landing-page-4-modules.md`**

```markdown
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
```

- [ ] **Step 5: Ajouter une entrée dans `etat.md`**

Ajouter avant la ligne finale `*Mis a jour le ... par Claude Code — ClosRM*` :

```markdown
## Session 2026-09-09 — 4 nouveaux modules landing page (Rémy)

### T-048 · Problèmes / Programme / Qualifier / Présentation du coach

**Statut :** Implémenté. PR à ouvrir depuis `feature/remy-landing-page-modules`.

**Pourquoi :**
Le builder de funnels ne couvrait pas les sections marketing essentielles
d'une landing page de coaching : présenter les problèmes de la cible, la
méthode, qualifier le prospect, présenter le coach. Ces 4 modules
complètent les 13 blocs existants sans les dupliquer.

**Ce qui a été livré :**
- 4 nouveaux types de blocs (`problems`, `program`, `qualifier`, `about_coach`), intégrés au menu "+ Ajouter une section" existant
- 2 composants partagés nouveaux : `ReorderableItemList` (drag & drop d'items en config, gap identifié à l'audit) et `IconPicker` (sélecteur d'icônes Lucide, inexistant avant)
- Contenu 100% personnalisable, sans limite de nombre d'éléments par section
- Responsive géré via `grid-template-columns: repeat(auto-fit, ...)` / `flex-wrap`, cohérent avec les blocs existants (pas de nouvelle media query)
- Aucune migration DB (colonne JSONB déjà générique)

> Detail complet : `taches/tache-048-landing-page-4-modules.md`
> Spec : `docs/superpowers/specs/2026-09-09-landing-page-4-modules-design.md`

---

*Mis a jour le 2026-09-09 par Claude Code — ClosRM*
```

(Remplacer l'ancienne ligne finale par la nouvelle, comme pour les sessions précédentes.)

- [ ] **Step 6: Ajouter les améliorations identifiées dans `ameliorations.md`**

Ajouter avant la ligne finale `*Mis à jour le ... par Claude Code — ClosRM*` :

```markdown
### A-FUN-04 · Registry central des types de blocs de funnel
- **Contexte :** Tâche 048 — ajouter un type de bloc touche aujourd'hui 7 fichiers différents à chaque fois (aucun registry factorisé, pattern répété pour les 17 types désormais). Décision prise avec Rémy de garder le pattern existant pour cette tâche plutôt que de refactorer.
- **Description :** Factoriser l'enregistrement d'un bloc (type, config par défaut, label, icône, composant config, composant rendu public, composant rendu preview) dans un unique fichier registry, pour qu'ajouter un futur type de bloc ne touche qu'un seul endroit.
- **Priorité estimée :** Moyenne
- **Effort estimé :** Élevé (touche les 17 blocs existants, gros diff, risque de régression sur de l'existant qui fonctionne)
- **Statut :** En attente de validation

### A-FUN-05 · Layouts alternatifs pour le bloc Programme / Méthode
- **Contexte :** Tâche 048 — la demande initiale mentionnait plusieurs dispositions possibles (vertical, horizontal, timeline, cartes). V1 livrée avec cartes uniquement (décision validée avec Rémy).
- **Description :** Ajouter un sélecteur de layout dans `ProgramConfig` (vertical/horizontal/timeline en plus de cartes), en réutilisant `config.items` tel quel.
- **Priorité estimée :** Basse
- **Effort estimé :** Moyen
- **Statut :** En attente de validation (V2 si besoin)

### A-FUN-06 · Vérification tactile du drag & drop intra-liste sur mobile
- **Contexte :** Tâche 048 — `ReorderableItemList` utilise `PointerSensor` de dnd-kit (supporte en théorie souris + tactile), mais le builder est surtout utilisé desktop. Pas de test manuel effectué sur device tactile réel pour le reorder de cartes/étapes/points en config.
- **Description :** Tester sur un vrai device tactile (tablette/mobile) que le drag & drop des items en config fonctionne correctement ; ajuster `activationConstraint` si besoin.
- **Priorité estimée :** Basse
- **Effort estimé :** Faible
- **Statut :** En attente de validation
```

- [ ] **Step 7: Commit final**

```bash
git add taches/tache-048-landing-page-4-modules.md etat.md ameliorations.md
git commit -m "docs(taches): T-048 4 nouveaux modules landing page — suivi + ameliorations"
```

- [ ] **Step 8: Proposer le push**

Ne pas pousser automatiquement — demander confirmation à l'utilisateur avant `git push -u origin feature/remy-landing-page-modules` (action visible sur GitHub, cf. protocole du projet).

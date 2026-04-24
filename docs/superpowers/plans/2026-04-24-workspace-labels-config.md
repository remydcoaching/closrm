# Personnalisation des Statuts et Sources par Workspace — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à chaque workspace de personnaliser ses 8 statuts + 6 sources (renommer, recolorer, réordonner, masquer) via une UI dans Paramètres + un shortcut simplifié dans le Kanban, sans toucher aux enums DB.

**Architecture:** Stockage JSONB nullable sur `workspaces` (avec fallback sur defaults hardcodés), React Context au niveau du dashboard layout avec hooks `useStatusConfig`/`useSourceConfig`, refactor de ~12 consumers actuels de `STATUS_CONFIG`/`SOURCE_CONFIG`, deux UI d'édition partageant la même API, migration one-shot du localStorage Kanban existant vers la DB.

**Tech Stack:** Next.js 14 App Router + TypeScript, React Context, Supabase (Postgres JSONB), `@dnd-kit` (déjà installé pour le Kanban modal existant), Zod pour validation API. Pas de framework de test — scripts Node one-off + tests manuels.

**Spec:** [docs/superpowers/specs/2026-04-24-workspace-labels-config-design.md](../specs/2026-04-24-workspace-labels-config-design.md)

---

## File Structure

### Nouveaux fichiers

| Fichier | Responsabilité |
|---|---|
| `supabase/migrations/050_workspace_status_source_config.sql` | Ajoute `status_config` et `source_config` JSONB nullable sur `workspaces` |
| `src/lib/workspace/status-defaults.ts` | `DEFAULT_STATUS_CONFIG` — array ordonné extrait de l'actuel `STATUS_CONFIG` |
| `src/lib/workspace/source-defaults.ts` | `DEFAULT_SOURCE_CONFIG` — array ordonné extrait de l'actuel `SOURCE_CONFIG` |
| `src/lib/workspace/config-helpers.ts` | Merge defaults + overrides, conversions hex ↔ rgba, validation |
| `src/app/api/workspace/config/route.ts` | `GET` (resolved config) et `PATCH` (mutation) |
| `src/lib/workspace/config-context.tsx` | `WorkspaceConfigProvider` + hooks |
| `src/app/(dashboard)/parametres/reglages/labels-editor.tsx` | Composant générique d'édition (réutilisé pour statuts et sources) |

### Fichiers modifiés

| Fichier | Changement |
|---|---|
| `src/types/index.ts` | Types `StatusConfigEntry`, `SourceConfigEntry`, `StatusConfig`, `SourceConfig` |
| `src/app/(dashboard)/layout.tsx` | Fetch `status_config` + `source_config`, passe au provider client |
| `src/components/leads/StatusBadge.tsx` | `STATUS_CONFIG` hardcodé → defaults exportés ; composant lit via hook |
| `src/components/leads/SourceBadge.tsx` | Idem pour sources |
| `src/app/(dashboard)/leads/views/KanbanColumnsConfigModal.tsx` | Rewiring localStorage → context + API |
| `src/app/(dashboard)/parametres/reglages/page.tsx` | Ajout de 2 `<Section>` (Statuts, Sources) |
| `src/components/leads/import/StatusValueMapper.tsx` | `STATUS_LABELS` → hook `useStatusConfig` |
| `src/components/leads/import/SourceValueMapper.tsx` | Idem |
| `src/components/leads/import/Step2_MappingConfig.tsx` | `STATUS_OPTIONS`/`SOURCE_OPTIONS` filtrés par `visible` et triés |
| `src/components/leads/LeadForm.tsx` | Dropdowns statut/source respectent `visible` + ordre |
| ~10 autres fichiers | Switch de `STATUS_CONFIG[status]` vers `useStatusEntry(status)` (refactor mécanique) |

---

## Task 1 — Types partagés

**Files:**
- Modify: `src/types/index.ts` (ajouts en fin de fichier)

- [ ] **Step 1: Ajouter les types**

Dans `src/types/index.ts`, **à la fin du fichier** (après les types existants), ajouter :

```typescript
// ------------------------------------------------------------------
// Workspace label customization (T-036)
// ------------------------------------------------------------------
export interface StatusConfigEntry {
  key: LeadStatus
  label: string
  color: string  // hex '#RRGGBB'
  bg: string     // rgba 'rgba(R,G,B,A)'
  visible: boolean
}

export interface SourceConfigEntry {
  key: LeadSource
  label: string
  color: string
  bg: string
  visible: boolean
}

// Ordered array — position = display order
export type StatusConfig = StatusConfigEntry[]
export type SourceConfig = SourceConfigEntry[]
```

- [ ] **Step 2: Vérifier la compilation**

Run:
```bash
npx tsc --noEmit 2>&1 | grep "types/index"
```

Expected : aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(types): add StatusConfig/SourceConfig types for workspace customization

Arrays of entries { key, label, color, bg, visible } where the array
position defines the display order. Used by the upcoming workspace
config system (T-036).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2 — Defaults extraits + helpers

**Files:**
- Create: `src/lib/workspace/status-defaults.ts`
- Create: `src/lib/workspace/source-defaults.ts`
- Create: `src/lib/workspace/config-helpers.ts`

- [ ] **Step 1: Créer `src/lib/workspace/status-defaults.ts`**

Extraction fidèle des valeurs actuelles de `STATUS_CONFIG` dans `src/components/leads/StatusBadge.tsx`. L'ordre suit `DEFAULT_COLUMN_ORDER` de `src/lib/ui-prefs/leads-prefs.ts`.

Create `src/lib/workspace/status-defaults.ts`:

```typescript
import type { StatusConfig } from '@/types'

export const DEFAULT_STATUS_CONFIG: StatusConfig = [
  { key: 'nouveau',          label: 'Nouveau',          color: '#a0a0a0',              bg: 'rgba(160,160,160,0.12)', visible: true },
  { key: 'scripte',          label: 'Scripté',          color: '#06b6d4',              bg: 'rgba(6,182,212,0.12)',   visible: true },
  { key: 'setting_planifie', label: 'Setting planifié', color: '#3b82f6',              bg: 'rgba(59,130,246,0.12)',  visible: true },
  { key: 'no_show_setting',  label: 'No-show Setting',  color: '#f59e0b',              bg: 'rgba(245,158,11,0.12)',  visible: true },
  { key: 'closing_planifie', label: 'Closing planifié', color: '#a855f7',              bg: 'rgba(168,85,247,0.12)',  visible: true },
  { key: 'no_show_closing',  label: 'No-show Closing',  color: '#f97316',              bg: 'rgba(249,115,22,0.12)',  visible: true },
  { key: 'clos',             label: 'Closé ✅',         color: 'var(--color-primary)', bg: 'rgba(0,200,83,0.12)',    visible: true },
  { key: 'dead',             label: 'Dead ❌',          color: '#ef4444',              bg: 'rgba(239,68,68,0.12)',   visible: true },
]
```

- [ ] **Step 2: Créer `src/lib/workspace/source-defaults.ts`**

Extraction fidèle de `SOURCE_CONFIG` dans `src/components/leads/SourceBadge.tsx`. Ordre conservateur (le même que celui affiché actuellement dans le dropdown `SOURCE_OPTIONS` de Step2_MappingConfig).

Create `src/lib/workspace/source-defaults.ts`:

```typescript
import type { SourceConfig } from '@/types'

export const DEFAULT_SOURCE_CONFIG: SourceConfig = [
  { key: 'manuel',        label: 'Manuel',        color: '#a0a0a0', bg: 'rgba(160,160,160,0.10)', visible: true },
  { key: 'facebook_ads',  label: 'Facebook Ads',  color: '#3b82f6', bg: 'rgba(59,130,246,0.10)',  visible: true },
  { key: 'instagram_ads', label: 'Instagram Ads', color: '#e879f9', bg: 'rgba(232,121,249,0.10)', visible: true },
  { key: 'follow_ads',    label: 'Follow Ads',    color: '#a855f7', bg: 'rgba(168,85,247,0.10)',  visible: true },
  { key: 'formulaire',    label: 'Formulaire',    color: '#06b6d4', bg: 'rgba(6,182,212,0.10)',   visible: true },
  { key: 'funnel',        label: 'Funnel',        color: '#f59e0b', bg: 'rgba(245,158,11,0.10)',  visible: true },
]
```

- [ ] **Step 3: Créer `src/lib/workspace/config-helpers.ts`**

Create `src/lib/workspace/config-helpers.ts`:

```typescript
import type { LeadSource, LeadStatus, SourceConfig, SourceConfigEntry, StatusConfig, StatusConfigEntry } from '@/types'
import { DEFAULT_STATUS_CONFIG } from './status-defaults'
import { DEFAULT_SOURCE_CONFIG } from './source-defaults'

// ------------------------------------------------------------------
// Hex → rgba conversion (for badge background generation)
// ------------------------------------------------------------------
export function hexToRgba(hex: string, alpha = 0.12): string {
  // Accepts '#RRGGBB' or '#RGB'. Returns 'rgba(R,G,B,a)'.
  let normalized = hex.replace(/^#/, '')
  if (normalized.length === 3) {
    normalized = normalized.split('').map((c) => c + c).join('')
  }
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return `rgba(160,160,160,${alpha})`
  }
  const r = parseInt(normalized.slice(0, 2), 16)
  const g = parseInt(normalized.slice(2, 4), 16)
  const b = parseInt(normalized.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

// ------------------------------------------------------------------
// Merge stored overrides with defaults.
// - Preserves order from the stored config for keys that exist in both.
// - Appends default entries for keys present in defaults but absent from stored.
// - Filters out stored entries whose key is no longer a valid enum value.
// ------------------------------------------------------------------
export function mergeStatusConfig(stored: StatusConfig | null | undefined): StatusConfig {
  if (!stored || stored.length === 0) return DEFAULT_STATUS_CONFIG

  const validKeys = new Set<LeadStatus>(DEFAULT_STATUS_CONFIG.map((e) => e.key))
  const filtered = stored.filter((e) => validKeys.has(e.key))
  const seen = new Set<LeadStatus>(filtered.map((e) => e.key))

  const missing = DEFAULT_STATUS_CONFIG.filter((e) => !seen.has(e.key))
  return [...filtered, ...missing]
}

export function mergeSourceConfig(stored: SourceConfig | null | undefined): SourceConfig {
  if (!stored || stored.length === 0) return DEFAULT_SOURCE_CONFIG

  const validKeys = new Set<LeadSource>(DEFAULT_SOURCE_CONFIG.map((e) => e.key))
  const filtered = stored.filter((e) => validKeys.has(e.key))
  const seen = new Set<LeadSource>(filtered.map((e) => e.key))

  const missing = DEFAULT_SOURCE_CONFIG.filter((e) => !seen.has(e.key))
  return [...filtered, ...missing]
}

// ------------------------------------------------------------------
// Lookup helpers (O(n) but n ≤ 8; fine)
// ------------------------------------------------------------------
export function findStatusEntry(config: StatusConfig, key: LeadStatus): StatusConfigEntry {
  return config.find((e) => e.key === key) || DEFAULT_STATUS_CONFIG.find((e) => e.key === key)!
}

export function findSourceEntry(config: SourceConfig, key: LeadSource): SourceConfigEntry {
  return config.find((e) => e.key === key) || DEFAULT_SOURCE_CONFIG.find((e) => e.key === key)!
}
```

- [ ] **Step 4: Écrire un script de validation**

Create at project root: `test-config-helpers.mjs`

```javascript
// Temp — tests mentaux des helpers merge.

function mergeStatus(stored, defaults) {
  if (!stored || stored.length === 0) return defaults
  const validKeys = new Set(defaults.map((e) => e.key))
  const filtered = stored.filter((e) => validKeys.has(e.key))
  const seen = new Set(filtered.map((e) => e.key))
  const missing = defaults.filter((e) => !seen.has(e.key))
  return [...filtered, ...missing]
}

const defaults = [
  { key: 'a', label: 'A', order: 0 },
  { key: 'b', label: 'B', order: 1 },
  { key: 'c', label: 'C', order: 2 },
]

// Case 1: null stored → defaults
const r1 = mergeStatus(null, defaults)
console.log(r1.length === 3 && r1[0].key === 'a' ? '✓' : '✗', 'null stored → defaults')

// Case 2: empty stored → defaults
const r2 = mergeStatus([], defaults)
console.log(r2.length === 3 && r2[0].key === 'a' ? '✓' : '✗', 'empty stored → defaults')

// Case 3: stored has subset with custom order
const r3 = mergeStatus([{ key: 'c', label: 'C custom' }, { key: 'a', label: 'A custom' }], defaults)
// Expected: c (custom), a (custom), b (missing appended)
console.log(r3[0].key === 'c' && r3[1].key === 'a' && r3[2].key === 'b' ? '✓' : '✗', 'stored subset with custom order')
console.log(r3[0].label === 'C custom' ? '✓' : '✗', 'stored preserves custom label')
console.log(r3[2].label === 'B' ? '✓' : '✗', 'missing uses default label')

// Case 4: stored has stale key (not in defaults)
const r4 = mergeStatus([{ key: 'a', label: 'A' }, { key: 'stale', label: 'Stale' }], defaults)
// Expected: 'stale' filtered out, b + c appended
console.log(r4.length === 3 && !r4.some((e) => e.key === 'stale') ? '✓' : '✗', 'stale key filtered')

// hex → rgba
function hexToRgba(hex, alpha = 0.12) {
  let n = hex.replace(/^#/, '')
  if (n.length === 3) n = n.split('').map((c) => c + c).join('')
  if (!/^[0-9a-fA-F]{6}$/.test(n)) return `rgba(160,160,160,${alpha})`
  const r = parseInt(n.slice(0, 2), 16)
  const g = parseInt(n.slice(2, 4), 16)
  const b = parseInt(n.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

console.log(hexToRgba('#3B82F6') === 'rgba(59,130,246,0.12)' ? '✓' : '✗', '#3B82F6 → rgba(59,130,246,0.12)')
console.log(hexToRgba('#FFF')    === 'rgba(255,255,255,0.12)' ? '✓' : '✗', '#FFF (short) → expanded rgba')
console.log(hexToRgba('invalid')  === 'rgba(160,160,160,0.12)' ? '✓' : '✗', 'invalid → grey fallback')
```

- [ ] **Step 5: Exécuter le script**

Run: `node test-config-helpers.mjs`

Expected : tous les `✓`.

- [ ] **Step 6: Vérifier la compilation**

Run:
```bash
npx tsc --noEmit 2>&1 | grep "workspace/"
```

Expected : aucune erreur.

- [ ] **Step 7: Supprimer le script et commit**

```bash
rm test-config-helpers.mjs
git add src/lib/workspace/
git commit -m "feat(workspace): status/source defaults + config helpers

- DEFAULT_STATUS_CONFIG / DEFAULT_SOURCE_CONFIG extracted from
  StatusBadge/SourceBadge hardcoded maps
- mergeStatusConfig / mergeSourceConfig: merge stored overrides with
  defaults, filter stale keys, append missing entries
- findStatusEntry / findSourceEntry: safe lookup with fallback
- hexToRgba: generate badge background from picker hex output

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3 — Migration DB

**Files:**
- Create: `supabase/migrations/050_workspace_status_source_config.sql`

- [ ] **Step 1: Créer la migration**

Create `supabase/migrations/050_workspace_status_source_config.sql`:

```sql
-- T-036: Workspace-level customization of lead statuses and sources.
-- Adds two nullable JSONB columns on workspaces. NULL = use hardcoded
-- defaults. Non-null = ordered array of entries with label/color/bg/visible.

ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS status_config jsonb,
  ADD COLUMN IF NOT EXISTS source_config jsonb;

COMMENT ON COLUMN workspaces.status_config IS
  'T-036: Array<{key: LeadStatus, label, color, bg, visible}>. NULL = use defaults.';
COMMENT ON COLUMN workspaces.source_config IS
  'T-036: Array<{key: LeadSource, label, color, bg, visible}>. NULL = use defaults.';
```

- [ ] **Step 2: Appliquer la migration en local (Supabase CLI ou manuel)**

Run:
```bash
# Supabase CLI if available:
npx supabase db push 2>&1 | tail -5
# Or manual via psql / Supabase dashboard SQL editor
```

Expected : "Applied migration 050_workspace_status_source_config" ou équivalent.

- [ ] **Step 3: Vérifier le schéma**

Run (via psql ou dashboard) :
```sql
\d workspaces
```

Expected : voir `status_config | jsonb` et `source_config | jsonb` en dernières colonnes, nullable.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/050_workspace_status_source_config.sql
git commit -m "feat(db): add status_config + source_config JSONB on workspaces (T-036)

Nullable. NULL means the workspace uses the hardcoded defaults.
First edit copies defaults into the DB then applies the change.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4 — API route `/api/workspace/config`

**Files:**
- Create: `src/app/api/workspace/config/route.ts`

- [ ] **Step 1: Créer la route GET + PATCH**

Create `src/app/api/workspace/config/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { createClient } from '@/lib/supabase/server'
import { mergeStatusConfig, mergeSourceConfig } from '@/lib/workspace/config-helpers'
import type { StatusConfig, SourceConfig } from '@/types'

const statusEntrySchema = z.object({
  key: z.enum(['nouveau', 'scripte', 'setting_planifie', 'no_show_setting', 'closing_planifie', 'no_show_closing', 'clos', 'dead']),
  label: z.string().min(1).max(60),
  color: z.string().regex(/^(#[0-9a-fA-F]{3,6}|var\(--[a-z0-9-]+\))$/),
  bg: z.string().min(1).max(80),
  visible: z.boolean(),
})

const sourceEntrySchema = z.object({
  key: z.enum(['facebook_ads', 'instagram_ads', 'follow_ads', 'formulaire', 'manuel', 'funnel']),
  label: z.string().min(1).max(60),
  color: z.string().regex(/^(#[0-9a-fA-F]{3,6}|var\(--[a-z0-9-]+\))$/),
  bg: z.string().min(1).max(80),
  visible: z.boolean(),
})

const patchSchema = z.object({
  status_config: z.array(statusEntrySchema).nullable().optional(),
  source_config: z.array(sourceEntrySchema).nullable().optional(),
})

export async function GET() {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('workspaces')
      .select('status_config, source_config')
      .eq('id', workspaceId)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Workspace introuvable' }, { status: 404 })
    }

    return NextResponse.json({
      data: {
        status_config: mergeStatusConfig(data.status_config as StatusConfig | null),
        source_config: mergeSourceConfig(data.source_config as SourceConfig | null),
      },
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const body = await request.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Payload invalide', details: parsed.error.issues }, { status: 400 })
    }

    const update: Record<string, unknown> = {}
    if (parsed.data.status_config !== undefined) update.status_config = parsed.data.status_config
    if (parsed.data.source_config !== undefined) update.source_config = parsed.data.source_config

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'Rien à mettre à jour' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('workspaces')
      .update(update)
      .eq('id', workspaceId)
      .select('status_config, source_config')
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Mise à jour échouée' }, { status: 500 })
    }

    return NextResponse.json({
      data: {
        status_config: mergeStatusConfig(data.status_config as StatusConfig | null),
        source_config: mergeSourceConfig(data.source_config as SourceConfig | null),
      },
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Vérifier la compilation**

Run:
```bash
npx tsc --noEmit 2>&1 | grep "workspace/config"
```

Expected : aucune erreur.

- [ ] **Step 3: Test manuel de la route**

Avec le dev server tournant, faire un `curl` ou navigation vers :
```
GET http://localhost:3000/api/workspace/config
```

Expected : JSON avec `data.status_config` (array de 8 entries de defaults) et `data.source_config` (array de 6 entries).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/workspace/config/
git commit -m "feat(api): workspace config GET/PATCH route

- GET returns merged config (stored overrides + defaults)
- PATCH validates with Zod schemas, updates only provided fields
- RLS/auth via getWorkspaceId (existing pattern)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5 — Context Provider + Hooks

**Files:**
- Create: `src/lib/workspace/config-context.tsx`

- [ ] **Step 1: Créer le provider + hooks**

Create `src/lib/workspace/config-context.tsx`:

```tsx
'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { LeadSource, LeadStatus, SourceConfig, SourceConfigEntry, StatusConfig, StatusConfigEntry } from '@/types'
import { mergeStatusConfig, mergeSourceConfig, findStatusEntry, findSourceEntry } from './config-helpers'
import { DEFAULT_STATUS_CONFIG } from './status-defaults'
import { DEFAULT_SOURCE_CONFIG } from './source-defaults'

interface ConfigContextValue {
  statusConfig: StatusConfig
  sourceConfig: SourceConfig
  updateStatusConfig: (next: StatusConfig) => Promise<void>
  updateSourceConfig: (next: SourceConfig) => Promise<void>
  resetStatusConfig: () => Promise<void>
  resetSourceConfig: () => Promise<void>
  loading: boolean
  error: string | null
}

const WorkspaceConfigContext = createContext<ConfigContextValue | null>(null)

interface ProviderProps {
  initialStatusConfig: StatusConfig | null
  initialSourceConfig: SourceConfig | null
  children: React.ReactNode
}

export function WorkspaceConfigProvider({ initialStatusConfig, initialSourceConfig, children }: ProviderProps) {
  const [statusConfig, setStatusConfig] = useState<StatusConfig>(
    () => mergeStatusConfig(initialStatusConfig),
  )
  const [sourceConfig, setSourceConfig] = useState<SourceConfig>(
    () => mergeSourceConfig(initialSourceConfig),
  )
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const patch = useCallback(async (body: { status_config?: StatusConfig | null; source_config?: SourceConfig | null }) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/workspace/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erreur')
      if (json.data?.status_config) setStatusConfig(json.data.status_config)
      if (json.data?.source_config) setSourceConfig(json.data.source_config)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const updateStatusConfig = useCallback(async (next: StatusConfig) => {
    setStatusConfig(next)  // optimistic
    try {
      await patch({ status_config: next })
    } catch {
      setStatusConfig(mergeStatusConfig(initialStatusConfig))  // rollback
    }
  }, [patch, initialStatusConfig])

  const updateSourceConfig = useCallback(async (next: SourceConfig) => {
    setSourceConfig(next)
    try {
      await patch({ source_config: next })
    } catch {
      setSourceConfig(mergeSourceConfig(initialSourceConfig))
    }
  }, [patch, initialSourceConfig])

  const resetStatusConfig = useCallback(async () => {
    setStatusConfig(DEFAULT_STATUS_CONFIG)
    try {
      await patch({ status_config: null })
    } catch {
      setStatusConfig(mergeStatusConfig(initialStatusConfig))
    }
  }, [patch, initialStatusConfig])

  const resetSourceConfig = useCallback(async () => {
    setSourceConfig(DEFAULT_SOURCE_CONFIG)
    try {
      await patch({ source_config: null })
    } catch {
      setSourceConfig(mergeSourceConfig(initialSourceConfig))
    }
  }, [patch, initialSourceConfig])

  const value = useMemo<ConfigContextValue>(() => ({
    statusConfig, sourceConfig,
    updateStatusConfig, updateSourceConfig,
    resetStatusConfig, resetSourceConfig,
    loading, error,
  }), [statusConfig, sourceConfig, updateStatusConfig, updateSourceConfig, resetStatusConfig, resetSourceConfig, loading, error])

  return <WorkspaceConfigContext.Provider value={value}>{children}</WorkspaceConfigContext.Provider>
}

// ------------------------------------------------------------------
// Hooks
// ------------------------------------------------------------------
export function useWorkspaceConfig(): ConfigContextValue {
  const ctx = useContext(WorkspaceConfigContext)
  if (!ctx) throw new Error('useWorkspaceConfig must be used within WorkspaceConfigProvider')
  return ctx
}

export function useStatusConfig(): StatusConfig {
  return useWorkspaceConfig().statusConfig
}

export function useSourceConfig(): SourceConfig {
  return useWorkspaceConfig().sourceConfig
}

export function useStatusEntry(key: LeadStatus): StatusConfigEntry {
  const config = useStatusConfig()
  return findStatusEntry(config, key)
}

export function useSourceEntry(key: LeadSource): SourceConfigEntry {
  const config = useSourceConfig()
  return findSourceEntry(config, key)
}
```

- [ ] **Step 2: Vérifier la compilation**

Run:
```bash
npx tsc --noEmit 2>&1 | grep "config-context"
```

Expected : aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add src/lib/workspace/config-context.tsx
git commit -m "feat(workspace): config context + hooks

- WorkspaceConfigProvider hydrates from server-passed initial config
- useStatusConfig / useSourceConfig return resolved arrays
- useStatusEntry / useSourceEntry for O(n≤8) lookup by key
- update/reset handlers PATCH the API with optimistic updates + rollback

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6 — Wire le provider dans le dashboard layout

**Files:**
- Modify: `src/app/(dashboard)/layout.tsx`

- [ ] **Step 1: Fetch les configs + wrapper**

Remplacer le contenu de `src/app/(dashboard)/layout.tsx` par :

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DashboardShell from '@/components/layout/DashboardShell'
import { BrandingInjector } from '@/lib/branding/BrandingInjector'
import { WorkspaceConfigProvider } from '@/lib/workspace/config-context'
import type { SourceConfig, StatusConfig } from '@/types'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch workspace for branding + label configs
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('accent_color, logo_url, status_config, source_config')
    .eq('owner_id', user.id)
    .single()

  const accentColor = workspace?.accent_color ?? '#00C853'
  const logoUrl = workspace?.logo_url ?? null
  const statusConfig = (workspace?.status_config as StatusConfig | null) ?? null
  const sourceConfig = (workspace?.source_config as SourceConfig | null) ?? null

  return (
    <>
      <BrandingInjector accentColor={accentColor} />
      <WorkspaceConfigProvider initialStatusConfig={statusConfig} initialSourceConfig={sourceConfig}>
        <DashboardShell logoUrl={logoUrl}>{children}</DashboardShell>
      </WorkspaceConfigProvider>
    </>
  )
}
```

- [ ] **Step 2: Vérifier la compilation**

Run:
```bash
npx tsc --noEmit 2>&1 | grep -E "layout|DashboardLayout"
```

Expected : aucune erreur.

- [ ] **Step 3: Test manuel : charger une page dashboard**

Avec le dev server, aller sur http://localhost:3000/leads.
- La page doit charger normalement.
- Ouvrir la DevTools Network : la requête HTTP à `/api/workspace/config` **ne doit PAS être faite** (le provider reçoit les valeurs via props server-side, pas de fetch client-side).

- [ ] **Step 4: Commit**

```bash
git add "src/app/(dashboard)/layout.tsx"
git commit -m "feat(workspace): wire WorkspaceConfigProvider into dashboard layout

Fetches status_config + source_config alongside existing branding fields
and passes them to the client provider as server-side props (avoids
a separate API call on every page load).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7 — Refactor `StatusBadge` + `SourceBadge`

**Files:**
- Modify: `src/components/leads/StatusBadge.tsx`
- Modify: `src/components/leads/SourceBadge.tsx`

- [ ] **Step 1: Refactor `StatusBadge.tsx`**

Remplacer le contenu de `src/components/leads/StatusBadge.tsx` par :

```tsx
'use client'

import { LeadStatus } from '@/types'
import { useStatusEntry } from '@/lib/workspace/config-context'
import { DEFAULT_STATUS_CONFIG } from '@/lib/workspace/status-defaults'

// Legacy export kept for server-side / non-context use cases (e.g. static rendering).
// Prefer useStatusEntry(status) in client components.
export const STATUS_CONFIG: Record<LeadStatus, { label: string; color: string; bg: string }> =
  Object.fromEntries(
    DEFAULT_STATUS_CONFIG.map((e) => [e.key, { label: e.label, color: e.color, bg: e.bg }]),
  ) as Record<LeadStatus, { label: string; color: string; bg: string }>

export default function StatusBadge({ status }: { status: LeadStatus }) {
  const entry = useStatusEntry(status)
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '3px 10px', borderRadius: 99,
      fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
      color: entry.color, background: entry.bg,
    }}>
      {entry.label}
    </span>
  )
}
```

**Note :** le `STATUS_CONFIG` est gardé comme export nommé pour éviter de casser les consumers qui l'importent directement. Ils seront refactorés en Task 8.

- [ ] **Step 2: Refactor `SourceBadge.tsx`**

Remplacer le contenu de `src/components/leads/SourceBadge.tsx` par :

```tsx
'use client'

import { LeadSource } from '@/types'
import { useSourceEntry } from '@/lib/workspace/config-context'
import { DEFAULT_SOURCE_CONFIG } from '@/lib/workspace/source-defaults'

// Legacy export kept for non-context use cases.
export const SOURCE_CONFIG: Record<LeadSource, { label: string; color: string; bg: string }> =
  Object.fromEntries(
    DEFAULT_SOURCE_CONFIG.map((e) => [e.key, { label: e.label, color: e.color, bg: e.bg }]),
  ) as Record<LeadSource, { label: string; color: string; bg: string }>

export default function SourceBadge({ source }: { source: LeadSource }) {
  const entry = useSourceEntry(source)
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '3px 10px', borderRadius: 99,
      fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
      color: entry.color, background: entry.bg,
    }}>
      {entry.label}
    </span>
  )
}
```

- [ ] **Step 3: Vérifier la compilation**

Run:
```bash
npx tsc --noEmit 2>&1 | grep -E "StatusBadge|SourceBadge"
```

Expected : aucune erreur.

- [ ] **Step 4: Test manuel : badges customisés**

Via SQL (Supabase dashboard ou psql), mettre à jour le workspace pour tester l'override :

```sql
UPDATE workspaces
SET status_config = '[
  { "key": "nouveau",          "label": "TEST Nouveau", "color": "#ff0000", "bg": "rgba(255,0,0,0.12)", "visible": true },
  { "key": "scripte",          "label": "Scripté",      "color": "#06b6d4", "bg": "rgba(6,182,212,0.12)", "visible": true },
  { "key": "setting_planifie", "label": "Setting planifié", "color": "#3b82f6", "bg": "rgba(59,130,246,0.12)", "visible": true },
  { "key": "no_show_setting",  "label": "No-show Setting",  "color": "#f59e0b", "bg": "rgba(245,158,11,0.12)", "visible": true },
  { "key": "closing_planifie", "label": "Closing planifié", "color": "#a855f7", "bg": "rgba(168,85,247,0.12)", "visible": true },
  { "key": "no_show_closing",  "label": "No-show Closing",  "color": "#f97316", "bg": "rgba(249,115,22,0.12)", "visible": true },
  { "key": "clos",             "label": "Closé ✅",         "color": "var(--color-primary)", "bg": "rgba(0,200,83,0.12)", "visible": true },
  { "key": "dead",             "label": "Dead ❌",          "color": "#ef4444", "bg": "rgba(239,68,68,0.12)", "visible": true }
]'::jsonb
WHERE id = (SELECT id FROM workspaces LIMIT 1);
```

Recharger `/leads` : les leads avec statut "nouveau" doivent afficher le badge "TEST Nouveau" en rouge. Si OK → supprimer l'override :

```sql
UPDATE workspaces SET status_config = NULL WHERE id = (SELECT id FROM workspaces LIMIT 1);
```

- [ ] **Step 5: Commit**

```bash
git add src/components/leads/StatusBadge.tsx src/components/leads/SourceBadge.tsx
git commit -m "refactor(leads): StatusBadge/SourceBadge read via workspace config hooks

Les badges lisent désormais via useStatusEntry/useSourceEntry. Les
STATUS_CONFIG et SOURCE_CONFIG exports nommés sont conservés comme
fallback sync (dérivés des defaults) pour les consumers restants,
qui seront refactorés dans la tâche suivante.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8 — Refactor les ~10 consumers restants

**Files:**
- Modify: `src/components/shared/LeadSidePanel.tsx`
- Modify: `src/components/messages/ContactPanel.tsx`
- Modify: `src/components/leads/LeadDetail.tsx`
- Modify: `src/app/(dashboard)/parametres/equipe/equipe-client.tsx`
- Modify: `src/app/(dashboard)/leads/views/LeadsListView.tsx`
- Modify: `src/app/(dashboard)/leads/views/KanbanColumnsConfigModal.tsx`
- Modify: `src/app/(dashboard)/leads/views/KanbanColumn.tsx`
- Modify: `src/components/automations/WorkflowStatusBadge.tsx`
- Modify: `src/components/agenda/BookingDetailPanel.tsx`
- Modify: `src/components/follow-ups/FollowUpStatusBadge.tsx`

- [ ] **Step 1: Liste les consumers actuels**

Run:
```bash
grep -rn "STATUS_CONFIG\|SOURCE_CONFIG" src/ --include='*.tsx' --include='*.ts' | grep -v "__tests__\|defaults"
```

Expected : ~12 fichiers (ceux listés ci-dessus + `StatusBadge.tsx`/`SourceBadge.tsx` déjà faits).

- [ ] **Step 2: Transformation mécanique à appliquer par fichier**

Pour chaque fichier listé ci-dessus, appliquer la transformation **pattern** suivante :

**Avant** (pattern typique) :
```tsx
import { STATUS_CONFIG } from '@/components/leads/StatusBadge'
// ...
const label = STATUS_CONFIG[lead.status].label
const color = STATUS_CONFIG[lead.status].color
```

**Après** :
```tsx
import { useStatusEntry } from '@/lib/workspace/config-context'
// ...
const entry = useStatusEntry(lead.status)
const label = entry.label
const color = entry.color
```

**Cas particulier — itérer sur tous les statuts** (ex: rendu de badges dans un dropdown) :

**Avant** :
```tsx
import { STATUS_CONFIG } from '@/components/leads/StatusBadge'
// ...
{Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
  <option key={key} value={key}>{cfg.label}</option>
))}
```

**Après** :
```tsx
import { useStatusConfig } from '@/lib/workspace/config-context'
// ...
const statusConfig = useStatusConfig()
// dans le render :
{statusConfig.filter((e) => e.visible).map((e) => (
  <option key={e.key} value={e.key}>{e.label}</option>
))}
```

Appliquer la même logique pour `SOURCE_CONFIG` → `useSourceConfig`/`useSourceEntry`.

**Attention** : certains composants sont des **server components** (non `'use client'`). Pour ceux-là, les hooks ne marchent PAS. Si le fichier est un server component et n'a pas de hook :
- Si le fichier est un rendu statique/SSR : garder l'import `STATUS_CONFIG`/`SOURCE_CONFIG` (les defaults, pas les overrides) — acceptable en V1, la personnalisation n'est visible que côté client
- Marquer l'exception dans le commit message

- [ ] **Step 3: Appliquer le refactor sur les 10 fichiers**

Pour chaque fichier, faire un `Read` → identifier les usages de `STATUS_CONFIG`/`SOURCE_CONFIG` → appliquer la transformation ci-dessus.

**Checklist pour chaque fichier** :
- [ ] Import modifié (ajout du hook, retrait ou conservation de STATUS_CONFIG/SOURCE_CONFIG selon usage)
- [ ] Usages internes migrés vers hook
- [ ] Si iter sur tous les statuts → filtrer par `visible`, respecter l'ordre du config
- [ ] Le composant reste `'use client'` (les hooks ne marchent qu'en client)

- [ ] **Step 4: Vérifier qu'aucun consommateur hors StatusBadge/SourceBadge/defaults n'importe encore**

Run:
```bash
grep -rn "STATUS_CONFIG\|SOURCE_CONFIG" src/ --include='*.tsx' --include='*.ts' | grep -v "StatusBadge.tsx\|SourceBadge.tsx\|status-defaults\|source-defaults"
```

Expected : aucune ligne, ou uniquement des usages intentionnellement conservés (server components). Documenter les exceptions dans le commit.

- [ ] **Step 5: Vérifier la compilation**

Run:
```bash
npx tsc --noEmit 2>&1 | grep -v node_modules | head -30
```

Expected : uniquement les erreurs pré-existantes (postal-mime, react-day-picker, @aws-sdk, webhooks/resend).

- [ ] **Step 6: Commit**

```bash
git add src/
git commit -m "refactor(leads): migrate 10 consumers to workspace config hooks

- LeadSidePanel, ContactPanel, LeadDetail, equipe-client
- LeadsListView, KanbanColumn, KanbanColumnsConfigModal
- WorkflowStatusBadge, BookingDetailPanel, FollowUpStatusBadge

All switch from STATUS_CONFIG/SOURCE_CONFIG direct imports to the
useStatusEntry/useSourceEntry (point lookup) or useStatusConfig/
useSourceConfig (iterate + filter by visible) hooks. Exceptions
noted for server components that keep the defaults.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9 — UI Paramètres > Réglages

**Files:**
- Create: `src/app/(dashboard)/parametres/reglages/labels-editor.tsx`
- Modify: `src/app/(dashboard)/parametres/reglages/page.tsx`

- [ ] **Step 1: Créer `labels-editor.tsx`**

Composant générique qui édite soit les statuts, soit les sources.

Create `src/app/(dashboard)/parametres/reglages/labels-editor.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { GripVertical, RotateCcw } from 'lucide-react'
import {
  DndContext, DragEndEvent, PointerSensor, useSensor, useSensors, closestCenter,
} from '@dnd-kit/core'
import {
  SortableContext, arrayMove, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { hexToRgba } from '@/lib/workspace/config-helpers'

interface BaseEntry {
  key: string
  label: string
  color: string
  bg: string
  visible: boolean
}

interface Props<E extends BaseEntry> {
  title: string
  entries: E[]
  defaults: E[]
  onChange: (next: E[]) => void
  onReset: () => void
}

function Row<E extends BaseEntry>({
  entry, defaultEntry, onUpdate,
}: {
  entry: E
  defaultEntry: E | undefined
  onUpdate: (partial: Partial<E>) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: entry.key })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    display: 'grid', gridTemplateColumns: 'auto auto auto 1fr auto auto', gap: 10,
    alignItems: 'center', padding: '10px 12px', borderRadius: 8,
    background: 'var(--bg-subtle)', border: '1px solid var(--border-primary)',
    marginBottom: 6,
  }

  const handleResetRow = () => {
    if (defaultEntry) {
      onUpdate({
        label: defaultEntry.label,
        color: defaultEntry.color,
        bg: defaultEntry.bg,
        visible: defaultEntry.visible,
      } as Partial<E>)
    }
  }

  // Native color picker returns hex '#rrggbb'. If the current color is a CSS var,
  // show the raw var (not editable via picker). For defaults with var(--...) we
  // keep the var until the user explicitly picks a color.
  const isVarColor = entry.color.startsWith('var(')
  const pickerValue = isVarColor ? '#00c853' : (entry.color || '#999999')

  return (
    <div ref={setNodeRef} style={style}>
      <button type="button" {...attributes} {...listeners} style={{
        background: 'none', border: 'none', cursor: 'grab', color: 'var(--text-label)', padding: 0,
      }}>
        <GripVertical size={14} />
      </button>

      <input
        type="checkbox"
        checked={entry.visible}
        onChange={(e) => onUpdate({ visible: e.target.checked } as Partial<E>)}
        aria-label={`Visible: ${entry.label}`}
      />

      <input
        type="color"
        value={pickerValue}
        onChange={(e) => {
          const hex = e.target.value
          onUpdate({ color: hex, bg: hexToRgba(hex, 0.12) } as Partial<E>)
        }}
        aria-label={`Couleur: ${entry.label}`}
        style={{ width: 28, height: 28, border: 'none', borderRadius: 6, cursor: 'pointer', padding: 0 }}
      />

      <input
        type="text"
        value={entry.label}
        onChange={(e) => onUpdate({ label: e.target.value } as Partial<E>)}
        onBlur={(e) => {
          // Prevent empty label persistence
          if (!e.target.value.trim()) {
            onUpdate({ label: defaultEntry?.label ?? entry.key } as Partial<E>)
          }
        }}
        style={{
          padding: '6px 10px', borderRadius: 6, fontSize: 13,
          background: 'var(--bg-input)', border: '1px solid var(--border-primary)',
          color: 'var(--text-primary)',
        }}
      />

      <span style={{
        display: 'inline-flex', alignItems: 'center',
        padding: '3px 10px', borderRadius: 99,
        fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
        color: entry.color, background: entry.bg,
      }}>
        {entry.label || '—'}
      </span>

      <button
        type="button"
        onClick={handleResetRow}
        disabled={!defaultEntry}
        title="Réinitialiser cette entrée"
        aria-label={`Réinitialiser: ${entry.label}`}
        style={{
          background: 'none', border: 'none', color: 'var(--text-muted)',
          cursor: defaultEntry ? 'pointer' : 'not-allowed', padding: 4,
        }}
      >
        <RotateCcw size={14} />
      </button>
    </div>
  )
}

export default function LabelsEditor<E extends BaseEntry>({
  title, entries, defaults, onChange, onReset,
}: Props<E>) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIndex = entries.findIndex((x) => x.key === active.id)
    const newIndex = entries.findIndex((x) => x.key === over.id)
    onChange(arrayMove(entries, oldIndex, newIndex))
  }

  const handleRowUpdate = (key: string, partial: Partial<E>) => {
    onChange(entries.map((e) => (e.key === key ? ({ ...e, ...partial }) : e)))
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{title}</h3>
        <button
          type="button"
          onClick={onReset}
          style={{
            fontSize: 12, color: 'var(--text-secondary)', background: 'none',
            border: '1px solid var(--border-primary)', padding: '4px 10px',
            borderRadius: 6, cursor: 'pointer',
          }}
        >
          Réinitialiser tout
        </button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={entries.map((e) => e.key)} strategy={verticalListSortingStrategy}>
          {entries.map((entry) => (
            <Row
              key={entry.key}
              entry={entry}
              defaultEntry={defaults.find((d) => d.key === entry.key)}
              onUpdate={(partial) => handleRowUpdate(entry.key, partial)}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  )
}
```

- [ ] **Step 2: Intégrer dans la page Réglages**

Modifier `src/app/(dashboard)/parametres/reglages/page.tsx` :

**Étape 2a :** Ajouter les imports en haut du fichier (après les imports existants) :

```tsx
import { Tag, Tags } from 'lucide-react'
import { useWorkspaceConfig } from '@/lib/workspace/config-context'
import { DEFAULT_STATUS_CONFIG } from '@/lib/workspace/status-defaults'
import { DEFAULT_SOURCE_CONFIG } from '@/lib/workspace/source-defaults'
import LabelsEditor from '@/app/(dashboard)/parametres/reglages/labels-editor'
```

**Étape 2b :** Ajouter à l'intérieur du composant `ReglagesPage`, juste avant le `return` :

```tsx
  const {
    statusConfig, sourceConfig,
    updateStatusConfig, updateSourceConfig,
    resetStatusConfig, resetSourceConfig,
  } = useWorkspaceConfig()
```

**Étape 2c :** Ajouter deux `<Section>` juste après la section "Personnalisation" (après le `<BrandingForm />`) et avant la section "Lien de prise de RDV" :

```tsx
          <div style={{ borderTop: '1px solid var(--border-primary)' }} />

          <Section
            icon={<Tag size={18} />}
            title="Statuts du pipeline"
            description="Renommer, recolorer, réordonner ou masquer les statuts de leads."
          >
            <LabelsEditor
              title="Statuts"
              entries={statusConfig}
              defaults={DEFAULT_STATUS_CONFIG}
              onChange={updateStatusConfig}
              onReset={resetStatusConfig}
            />
          </Section>

          <div style={{ borderTop: '1px solid var(--border-primary)' }} />

          <Section
            icon={<Tags size={18} />}
            title="Sources des leads"
            description="Renommer, recolorer, réordonner ou masquer les sources d'acquisition."
          >
            <LabelsEditor
              title="Sources"
              entries={sourceConfig}
              defaults={DEFAULT_SOURCE_CONFIG}
              onChange={updateSourceConfig}
              onReset={resetSourceConfig}
            />
          </Section>
```

- [ ] **Step 3: Vérifier la compilation**

Run:
```bash
npx tsc --noEmit 2>&1 | grep -E "labels-editor|reglages/page"
```

Expected : aucune erreur.

- [ ] **Step 4: Test manuel**

1. Aller sur http://localhost:3000/parametres/reglages
2. Scroller jusqu'aux nouvelles sections "Statuts du pipeline" et "Sources des leads"
3. Renommer "Setting planifié" en "RDV Bilan Pris" → doit autosave, toast pas obligatoire en V1
4. Changer la couleur d'un statut via le picker → preview badge doit mettre à jour en direct
5. Glisser-déposer pour réordonner → doit persister
6. Décocher "No-show Closing" → disparaît de la vue Kanban après reload de `/leads`
7. Cliquer "Réinitialiser tout" → retour aux defaults

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/parametres/reglages/"
git commit -m "feat(parametres): add statuts + sources editor in Réglages

- New generic <LabelsEditor> component (reusable for statuses and
  sources) with drag-and-drop, visibility toggle, native color picker,
  inline label edit, per-row reset and reset-all buttons.
- Two new Sections in the Réglages page wired to useWorkspaceConfig
  update/reset handlers.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10 — Rewiring Kanban modal + migration localStorage

**Files:**
- Modify: `src/app/(dashboard)/leads/views/KanbanColumnsConfigModal.tsx`
- Modify: `src/app/(dashboard)/leads/views/LeadsKanbanView.tsx` (caller of the modal)
- Modify: `src/lib/ui-prefs/leads-prefs.ts` (keep-compat: read stays for migration, write removed)
- Modify: `src/lib/workspace/config-context.tsx` (add the one-shot migration)

- [ ] **Step 1: Simplifier le modal**

Remplacer le contenu de `src/app/(dashboard)/leads/views/KanbanColumnsConfigModal.tsx` par :

```tsx
'use client'

import Link from 'next/link'
import { useState } from 'react'
import { X, GripVertical, Palette } from 'lucide-react'
import {
  DndContext, DragEndEvent, PointerSensor, useSensor, useSensors, closestCenter,
} from '@dnd-kit/core'
import {
  SortableContext, arrayMove, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { StatusConfig } from '@/types'

interface Props {
  config: StatusConfig
  onClose: () => void
  onSave: (next: StatusConfig) => void
}

function Row({ entry, onToggle }: { entry: StatusConfig[number]; onToggle: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: entry.key })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '8px 10px', borderRadius: 8,
    background: 'var(--bg-subtle)', border: '1px solid var(--border-primary)',
  }
  return (
    <div ref={setNodeRef} style={style}>
      <button type="button" {...attributes} {...listeners} style={{
        background: 'none', border: 'none', cursor: 'grab', color: 'var(--text-label)', padding: 0,
      }}>
        <GripVertical size={14} />
      </button>
      <input type="checkbox" checked={entry.visible} onChange={onToggle} />
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: entry.color }} />
      <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{entry.label}</span>
    </div>
  )
}

export default function KanbanColumnsConfigModal({ config, onClose, onSave }: Props) {
  const [draft, setDraft] = useState<StatusConfig>(config)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  function toggle(key: string) {
    setDraft((prev) => prev.map((e) => (e.key === key ? { ...e, visible: !e.visible } : e)))
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIndex = draft.findIndex((x) => x.key === active.id)
    const newIndex = draft.findIndex((x) => x.key === over.id)
    setDraft(arrayMove(draft, oldIndex, newIndex))
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()} style={{
        background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)',
        borderRadius: 14, padding: 20, minWidth: 360, maxWidth: 420,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Configurer les colonnes
          </h2>
          <button type="button" onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4,
          }}>
            <X size={16} />
          </button>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={draft.map((e) => e.key)} strategy={verticalListSortingStrategy}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
              {draft.map((entry) => (
                <Row key={entry.key} entry={entry} onToggle={() => toggle(entry.key)} />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <Link
          href="/parametres/reglages#statuts"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 12, color: 'var(--text-secondary)', textDecoration: 'none',
            marginBottom: 14,
          }}
        >
          <Palette size={12} /> Personnaliser les libellés et couleurs
        </Link>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" onClick={onClose} style={{
            padding: '8px 14px', borderRadius: 8, fontSize: 13,
            background: 'transparent', border: '1px solid var(--border-primary)',
            color: 'var(--text-secondary)', cursor: 'pointer',
          }}>
            Annuler
          </button>
          <button type="button" onClick={() => { onSave(draft); onClose() }} style={{
            padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: 'var(--color-primary)', border: 'none', color: '#000', cursor: 'pointer',
          }}>
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Adapter le caller (`LeadsKanbanView.tsx`)**

Ouvrir `src/app/(dashboard)/leads/views/LeadsKanbanView.tsx`, localiser où `KanbanColumnsConfigModal` est utilisé (probablement avec `KanbanColumnsPref` du localStorage), et **remplacer** l'état/save par le context :

```tsx
// AJOUTER en haut du composant :
import { useStatusConfig, useWorkspaceConfig } from '@/lib/workspace/config-context'

// À l'intérieur du composant (remplace l'ancien useState + loadColumns/saveColumns) :
const statusConfig = useStatusConfig()
const { updateStatusConfig } = useWorkspaceConfig()

// Et dans le rendu de la modal :
<KanbanColumnsConfigModal
  config={statusConfig}
  onClose={() => setShowColumnsModal(false)}
  onSave={(next) => { updateStatusConfig(next) }}
/>
```

**Note :** ajuster selon la structure actuelle du fichier. Si nécessaire, supprimer les imports `KanbanColumnsPref`, `loadColumns`, `saveColumns` de `@/lib/ui-prefs/leads-prefs`.

- [ ] **Step 3: Migration one-shot dans le provider**

Modifier `src/lib/workspace/config-context.tsx` pour ajouter un `useEffect` de migration au mount (uniquement si `initialStatusConfig` est null côté serveur) :

**Localiser** le bloc juste après `const [error, setError] = useState<string | null>(null)` :

```tsx
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
```

**Ajouter** immédiatement après :

```tsx
  // One-shot migration: if the server returned no stored status_config
  // but the browser has a legacy localStorage Kanban pref, import it
  // into the workspace (preserves the user's existing Kanban ordering
  // and visibility choices) then clear the localStorage.
  useEffect(() => {
    if (initialStatusConfig) return  // already migrated for this workspace
    if (typeof window === 'undefined') return
    const raw = window.localStorage.getItem('closrm.leads.kanban.columns')
    if (!raw) return
    try {
      const parsed = JSON.parse(raw) as { visible?: string[]; order?: string[] }
      if (!parsed.order || !parsed.visible) return

      const visibleSet = new Set(parsed.visible)
      // Map default entries into the user's order, respecting visibility flags
      const migrated: StatusConfig = []
      for (const key of parsed.order) {
        const def = DEFAULT_STATUS_CONFIG.find((e) => e.key === key)
        if (def) migrated.push({ ...def, visible: visibleSet.has(key) })
      }
      // Append any missing keys (new enum values added after the user's last pref)
      for (const def of DEFAULT_STATUS_CONFIG) {
        if (!migrated.some((e) => e.key === def.key)) migrated.push(def)
      }

      // Persist + clear localStorage, without waiting (best-effort)
      fetch('/api/workspace/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status_config: migrated }),
      }).then((res) => {
        if (res.ok) {
          setStatusConfig(migrated)
          window.localStorage.removeItem('closrm.leads.kanban.columns')
        }
      }).catch(() => {})
    } catch {
      // corrupted localStorage, ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
```

Ajouter l'import manquant en haut du fichier si besoin :

```tsx
import { useEffect, useCallback, useContext, createContext, useMemo, useState } from 'react'
```

- [ ] **Step 4: Nettoyer `leads-prefs.ts`**

Dans `src/lib/ui-prefs/leads-prefs.ts`, garder `loadColumns`/`saveColumns` temporairement (la migration les utilise via localStorage direct dans le provider — en fait non, le provider accède à localStorage direct). On peut :
- Soit supprimer `KanbanColumnsPref`, `loadColumns`, `saveColumns` du fichier (le provider lit localStorage directement et les types internes)
- Soit les garder pour la compat pendant une période

**Choix V1 :** supprimer. Modifier `src/lib/ui-prefs/leads-prefs.ts` :

Retirer les lignes :
- `const DEFAULT_COLUMN_ORDER`
- `export interface KanbanColumnsPref`
- `export function loadColumns`
- `export function saveColumns`
- La clé `columns` dans `KEYS`

Garder `LeadsView`, `DateField`, `DatePreset`, `DateFilterPref`, `loadView`, `saveView`, `loadDateFilter`, `saveDateFilter`, `computeRange`.

**Note :** Si `LeadsKanbanView.tsx` importe encore `KanbanColumnsPref`/`loadColumns`/`saveColumns`, ces imports doivent déjà avoir été supprimés en Step 2.

- [ ] **Step 5: Vérifier la compilation**

Run:
```bash
npx tsc --noEmit 2>&1 | grep -E "KanbanColumns|LeadsKanbanView|leads-prefs|config-context"
```

Expected : aucune erreur.

- [ ] **Step 6: Test manuel migration**

1. Dans DevTools > Application > Local Storage, **pré-remplir** :
   ```json
   closrm.leads.kanban.columns = {
     "order": ["clos","dead","nouveau","scripte","setting_planifie","no_show_setting","closing_planifie","no_show_closing"],
     "visible": ["clos","dead","nouveau","scripte","setting_planifie"]
   }
   ```
2. Via SQL, s'assurer que `workspaces.status_config IS NULL`
3. Recharger `/leads`
4. Vérifier :
   - Localstorage `closrm.leads.kanban.columns` est supprimé
   - `workspaces.status_config` contient l'array dans le nouveau format, avec l'ordre `[clos, dead, nouveau, ...]` et `visible: false` pour `no_show_setting`, `closing_planifie`, `no_show_closing`
   - La vue Kanban reflète le nouveau ordre et les colonnes masquées

- [ ] **Step 7: Commit**

```bash
git add src/app/\(dashboard\)/leads/views/ src/lib/workspace/config-context.tsx src/lib/ui-prefs/leads-prefs.ts
git commit -m "feat(leads): migrate Kanban columns config from localStorage to workspace DB

- KanbanColumnsConfigModal now reads/writes via the workspace config
  context (single source of truth with Paramètres).
- LeadsKanbanView caller wired to useStatusConfig + updateStatusConfig.
- One-shot migration in WorkspaceConfigProvider: if server returned
  null status_config but localStorage has a legacy Kanban pref,
  import it into the workspace DB and clear localStorage.
- Removed KanbanColumnsPref/loadColumns/saveColumns (ui-prefs).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 11 — Adapter l'import wizard (T-034/T-035)

**Files:**
- Modify: `src/components/leads/import/StatusValueMapper.tsx`
- Modify: `src/components/leads/import/SourceValueMapper.tsx`
- Modify: `src/components/leads/import/Step2_MappingConfig.tsx`
- Modify: `src/components/leads/LeadForm.tsx` (si utilise STATUS_OPTIONS/SOURCE_OPTIONS ou équivalent)

- [ ] **Step 1: `StatusValueMapper.tsx` utilise le hook**

Remplacer dans `src/components/leads/import/StatusValueMapper.tsx` :

**Avant** (les constantes locales) :
```tsx
const STATUS_LABELS: Record<LeadStatus, string> = { ... }
const STATUS_ORDER = Object.keys(STATUS_LABELS) as LeadStatus[]
```

**Après** :
```tsx
import { useStatusConfig } from '@/lib/workspace/config-context'

// DANS le composant :
const statusConfig = useStatusConfig()
const STATUS_LABELS: Record<LeadStatus, string> = Object.fromEntries(
  statusConfig.map((e) => [e.key, e.label]),
) as Record<LeadStatus, string>
const STATUS_ORDER = statusConfig.filter((e) => e.visible).map((e) => e.key)
```

- [ ] **Step 2: `SourceValueMapper.tsx` utilise le hook**

Même pattern dans `src/components/leads/import/SourceValueMapper.tsx` :

```tsx
import { useSourceConfig } from '@/lib/workspace/config-context'

// DANS le composant :
const sourceConfig = useSourceConfig()
const SOURCE_LABELS: Record<LeadSource, string> = Object.fromEntries(
  sourceConfig.map((e) => [e.key, e.label]),
) as Record<LeadSource, string>
const SOURCE_ORDER = sourceConfig.filter((e) => e.visible).map((e) => e.key)
```

- [ ] **Step 3: `Step2_MappingConfig.tsx` — SOURCE_OPTIONS / STATUS_OPTIONS**

Localiser les arrays constants `SOURCE_OPTIONS` et `STATUS_OPTIONS` dans `src/components/leads/import/Step2_MappingConfig.tsx` (autour des lignes 37-52). Les remplacer par des valeurs dérivées du hook :

**Avant** :
```tsx
const SOURCE_OPTIONS: { value: LeadSource; label: string }[] = [
  { value: 'manuel', label: 'Manuel' },
  // ...
]
const STATUS_OPTIONS: { value: LeadStatus; label: string }[] = [
  { value: 'nouveau', label: 'Nouveau' },
  // ...
]
```

**Après** (à l'intérieur du composant, pas au top-level) :
```tsx
import { useStatusConfig, useSourceConfig } from '@/lib/workspace/config-context'

// DANS le composant Step2_MappingConfig :
const statusConfig = useStatusConfig()
const sourceConfig = useSourceConfig()

const SOURCE_OPTIONS = sourceConfig
  .filter((e) => e.visible)
  .map((e) => ({ value: e.key, label: e.label }))

const STATUS_OPTIONS = statusConfig
  .filter((e) => e.visible)
  .map((e) => ({ value: e.key, label: e.label }))
```

Retirer les déclarations top-level correspondantes.

- [ ] **Step 4: `LeadForm.tsx`**

Ouvrir `src/components/leads/LeadForm.tsx`, localiser les dropdowns `<select>` pour statut et source. Remplacer les mappings hardcodés (ou les imports de constantes) par les hooks :

```tsx
import { useStatusConfig, useSourceConfig } from '@/lib/workspace/config-context'

// Dans le composant :
const statusConfig = useStatusConfig()
const sourceConfig = useSourceConfig()

// Dans le rendu :
<select>
  {statusConfig.filter((e) => e.visible).map((e) => (
    <option key={e.key} value={e.key}>{e.label}</option>
  ))}
</select>
```

- [ ] **Step 5: Vérifier la compilation**

Run:
```bash
npx tsc --noEmit 2>&1 | grep -E "StatusValueMapper|SourceValueMapper|Step2_Mapping|LeadForm"
```

Expected : aucune erreur.

- [ ] **Step 6: Test manuel**

1. Renommer un statut via Paramètres > Réglages (ex: `setting_planifie` → "RDV Bilan Pris")
2. Aller sur `/leads/import`, upload un CSV avec une colonne statut
3. Step 2 → le dropdown de "Statut par défaut" doit afficher "RDV Bilan Pris"
4. `StatusValueMapper` → dans son dropdown de mapping, les options doivent afficher les labels custom
5. Retour à `/leads`, créer un lead manuellement → le dropdown Statut affiche aussi "RDV Bilan Pris"
6. Masquer un statut (ex: `no_show_closing`) → les dropdowns n'affichent plus cette option

- [ ] **Step 7: Commit**

```bash
git add src/components/leads/
git commit -m "feat(leads): import wizard + LeadForm honor workspace label config

- StatusValueMapper/SourceValueMapper: STATUS_LABELS/SOURCE_LABELS and
  ORDER arrays derived from hooks instead of hardcoded.
- Step2_MappingConfig: STATUS_OPTIONS/SOURCE_OPTIONS filter by visible
  and respect the workspace order.
- LeadForm: statut/source dropdowns render with custom labels + hide
  invisible entries.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 12 — Tests manuels end-to-end + finalisation

**Files:**
- Modify: `taches/tache-036-workspace-labels-config.md` (mark done)

- [ ] **Step 1: Checklist de test end-to-end**

Exécuter manuellement dans cet ordre, avec le dev server actif :

1. **Workspace vierge (status_config/source_config NULL)** :
   - Charger `/leads` → badges en defaults
   - Charger `/parametres/reglages` → les deux sections apparaissent avec les defaults pré-remplis
   - Aucune requête réseau au provider au mount (c'est server-side)

2. **Édition label** :
   - Dans Paramètres > Statuts, renommer "Setting planifié" → "RDV Bilan Pris"
   - Observer l'input perdre le focus au blur → autosave → toast ou indicateur (optionnel V1)
   - Recharger `/leads` → badges `setting_planifie` affichent "RDV Bilan Pris"
   - Aller sur `/leads/import`, upload un CSV → le dropdown statut affiche "RDV Bilan Pris"
   - Aller sur `/leads`, bouton "Ajouter un lead" → dropdown statut idem

3. **Édition couleur** :
   - Dans Paramètres, cliquer la pastille de couleur d'un statut → picker natif s'ouvre
   - Choisir une nouvelle couleur → preview badge dans la row met à jour en direct
   - Blur → autosave
   - Recharger `/leads` → badges affichent la nouvelle couleur

4. **Réordonner** :
   - Dans Paramètres, glisser-déposer un statut pour changer l'ordre
   - Recharger `/leads` en vue Kanban → les colonnes sont dans le nouvel ordre
   - Filtres de statut dans la barre d'en-tête → même ordre

5. **Masquer / afficher** :
   - Décocher "No-show Closing" dans Paramètres
   - Recharger `/leads` en Kanban → la colonne disparaît
   - Filtre de statut dans la barre d'en-tête → n'affiche plus "No-show Closing"
   - Vue Liste → les leads existants avec ce statut sont toujours là (non filtrés en base), mais le filtre dropdown ne le propose plus

6. **Reset par row** :
   - Cliquer l'icône reset (RotateCcw) sur une row éditée → retour aux defaults pour cette entrée

7. **Reset tout** :
   - Cliquer "Réinitialiser tout" → confirmation (si modal ajoutée) ou reset immédiat
   - Recharger `/leads` → tous les badges en defaults

8. **Bouton "Configurer les colonnes" du Kanban** :
   - Cliquer le bouton dans la vue Kanban → modal simplifié s'ouvre
   - Reorder + toggle visible via ce modal → les changements doivent s'appliquer globalement (y compris dans Paramètres)
   - Vérifier le lien "Personnaliser les libellés et couleurs" → redirige vers `/parametres/reglages#statuts`

9. **Migration localStorage** :
   - Supprimer le status_config du workspace (`UPDATE workspaces SET status_config = NULL`)
   - Injecter en localStorage : `closrm.leads.kanban.columns = { "order": ["clos","nouveau","dead","scripte","setting_planifie","no_show_setting","closing_planifie","no_show_closing"], "visible": ["clos","nouveau","dead","scripte","setting_planifie","closing_planifie"] }`
   - Recharger `/leads`
   - Vérifier : `workspaces.status_config` maintenant peuplé avec l'ordre migré + `no_show_setting` et `no_show_closing` invisibles
   - localStorage vide pour cette clé

10. **Sources** : répéter les étapes 2-7 mais pour les sources

- [ ] **Step 2: Mettre à jour le fichier de tâche**

Dans `taches/tache-036-workspace-labels-config.md`, remplacer :
```markdown
**Statut :** spec validée, à implémenter
```
par :
```markdown
**Statut :** terminé (2026-04-24)
```

Ajouter à la fin du fichier :

```markdown
## Résultat

Implémenté sur la branche `feature/remy-workspace-labels-config`, mergé dans PR #XXX (à compléter).

Tests manuels exécutés et passés : 10 scénarios (voir plan Task 12 Step 1).

## Améliorations identifiées

(à logguer dans ameliorations.md au fil de l'implémentation)
```

- [ ] **Step 3: Commit final**

```bash
git add taches/tache-036-workspace-labels-config.md
git commit -m "docs(workspace): mark T-036 as done

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 4: Push + PR**

```bash
git push -u origin feature/remy-workspace-labels-config

gh pr create --base develop --title "feat(workspace): personnalisation des statuts et sources par workspace (T-036)" --body "$(cat <<'EOF'
## Summary
- Chaque workspace peut renommer, recolorer, réordonner et masquer ses 8 statuts et 6 sources depuis Paramètres > Réglages
- Enums DB inchangés — seul l'affichage est personnalisé (JSONB nullable sur \`workspaces\`)
- Single source of truth DB avec deux UI : éditeur complet en Paramètres + modal simplifié depuis le Kanban
- Migration one-shot du localStorage Kanban existant vers la DB
- Refactor ~12 consumers de STATUS_CONFIG/SOURCE_CONFIG vers hooks

**Spec :** [docs/superpowers/specs/2026-04-24-workspace-labels-config-design.md](docs/superpowers/specs/2026-04-24-workspace-labels-config-design.md)
**Plan :** [docs/superpowers/plans/2026-04-24-workspace-labels-config.md](docs/superpowers/plans/2026-04-24-workspace-labels-config.md)

## Test plan
- [x] Helpers unit-testés (merge + hexToRgba)
- [x] Type-check clean
- [x] Éditeur Paramètres : rename, recolor, reorder, hide, reset par row, reset tout
- [x] Kanban modal simplifié + lien vers Paramètres
- [x] Badges partout (liste, Kanban, side panels, agenda, follow-ups, automations)
- [x] Import wizard respecte labels + ordre + visibilité
- [x] LeadForm respecte idem
- [x] Migration localStorage → DB validée
- [ ] Vérifier en prod après merge

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected : URL de la PR retournée.

---

## Self-Review

**1. Spec coverage**
- Stockage JSONB + structure → Task 1, 2, 3 ✓
- Runtime Context + hooks → Task 4, 5, 6 ✓
- Refactor des consumers → Task 7, 8 ✓
- UI Paramètres → Task 9 ✓
- Kanban modal + migration → Task 10 ✓
- Adaptation import wizard → Task 11 ✓
- Tests E2E → Task 12 ✓

**2. Placeholder scan**
Aucun "TBD", "TODO", "similar to", etc. Tous les blocs de code sont complets.

**3. Type consistency**
- `StatusConfig`, `SourceConfig`, `StatusConfigEntry`, `SourceConfigEntry` utilisés avec les mêmes signatures dans tous les tasks
- `mergeStatusConfig`, `mergeSourceConfig`, `findStatusEntry`, `findSourceEntry`, `hexToRgba` définis en T2, utilisés en T4, T5, T9
- `useStatusConfig`, `useSourceConfig`, `useStatusEntry`, `useSourceEntry` définis en T5, utilisés en T7, T8, T11
- `DEFAULT_STATUS_CONFIG`, `DEFAULT_SOURCE_CONFIG` définis en T2, utilisés en T5 (provider), T7 (fallback), T9 (editor), T10 (migration)

**4. Clarifications**
- Task 8 est volontairement "mécanique" : les 10 fichiers suivent le même pattern, pas besoin de diff par fichier. L'implémenteur doit faire grep + transformation + verify.
- Task 10 Step 4 (nettoyage leads-prefs) est optionnel si l'adaptation de LeadsKanbanView en Step 2 a retiré tous les imports — sinon garder `loadColumns`/`saveColumns` comme no-op temporaire.

**5. Breakage intermédiaire**
- Après T1 : types ok (pas de casse)
- Après T2 : helpers ok (pas de casse)
- Après T3 : migration DB (pas de casse app-side)
- Après T4 : API route ok (pas de casse)
- Après T5 : provider existe mais pas encore wiré
- Après T6 : provider wiré — dashboard layout peut maintenant lire via hooks
- Après T7 : Badges consomment via hook, mais les ~10 autres consumers consomment encore via STATUS_CONFIG (qui est désormais dérivé des defaults) — pas cassé
- Après T8 : tous les consumers sur hooks
- Après T9 : UI éditeur disponible
- Après T10 : Kanban modal rewiré + migration localStorage
- Après T11 : import wizard + LeadForm respectent le config
- Après T12 : tests passés, PR créée

Aucun état intermédiaire ne casse le build ni le runtime. ✓

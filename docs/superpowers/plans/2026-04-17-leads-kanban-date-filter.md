# Leads Kanban + Date Range Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter une vue kanban drag-and-drop et un sélecteur de plage de dates (Aujourd'hui/Hier/7J/30J/Perso) à la page Leads.

**Architecture:** On éclate `leads-client.tsx` en un orchestrateur + deux vues (`LeadsListView`, `LeadsKanbanView`). La vue kanban charge ses données via un nouvel endpoint `/api/leads/grouped` appelant une RPC Postgres `leads_grouped_by_status` qui retourne le top 25 par statut en une seule requête (ROW_NUMBER window). Le sélecteur de dates étend `leadFiltersSchema` avec `date_from`, `date_to`, `date_field`. Préférences (vue, colonnes, date) persistées en `localStorage`.

**Tech Stack:** Next.js 14 App Router, Supabase Postgres + RPC, `@dnd-kit/core` + `@dnd-kit/sortable` (déjà installé), `react-day-picker` (à ajouter), `date-fns` (déjà installé), TypeScript.

**Spec source:** `docs/superpowers/specs/2026-04-17-leads-kanban-date-filter-design.md`

**Branche:** `feature/pierre-leads-kanban-date-filter` (déjà créée et commit initial de la spec effectué).

---

## File Structure

```
supabase/migrations/
  030_leads_grouped_by_status.sql          # CREATE (029 pris par Linktree)

src/lib/validations/
  leads.ts                                 # MODIFY (ajout date_from, date_to, date_field)

src/app/api/leads/
  route.ts                                 # MODIFY (appliquer filtres de date)
  grouped/
    route.ts                               # CREATE (endpoint RPC)

src/lib/ui-prefs/
  leads-prefs.ts                           # CREATE (helpers localStorage typés)

src/components/leads/
  DateRangePicker.tsx                      # CREATE
  ViewToggle.tsx                           # CREATE

src/app/(dashboard)/leads/
  leads-client.tsx                         # MODIFY (orchestrateur slim)
  views/
    LeadsListView.tsx                      # CREATE (extraction table actuelle)
    LeadsKanbanView.tsx                    # CREATE
    KanbanColumn.tsx                       # CREATE
    KanbanCard.tsx                         # CREATE
    KanbanColumnsConfigModal.tsx           # CREATE

package.json                               # MODIFY (add react-day-picker)
```

Le projet n'a pas de framework de tests automatisés configuré. La "vérification" se fait donc via `npm run build` + `npm run lint` + vérif manuelle en navigateur. Chaque task se termine par un build/lint propre avant commit.

---

## Task 1: Migration SQL — RPC `leads_grouped_by_status` + index

**Files:**
- Create: `supabase/migrations/030_leads_grouped_by_status.sql`

- [ ] **Step 1: Écrire la migration**

Créer le fichier `supabase/migrations/030_leads_grouped_by_status.sql` :

```sql
-- Index composites pour accélérer le tri/filtrage par statut + date
CREATE INDEX IF NOT EXISTS idx_leads_workspace_status_created
  ON leads (workspace_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_leads_workspace_updated
  ON leads (workspace_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_leads_workspace_closed
  ON leads (workspace_id, closed_at DESC) WHERE closed_at IS NOT NULL;

-- Fonction qui retourne le top N leads par statut, pour le kanban
CREATE OR REPLACE FUNCTION leads_grouped_by_status(
  p_workspace_id uuid,
  p_limit        int    DEFAULT 25,
  p_date_from    timestamptz DEFAULT NULL,
  p_date_to      timestamptz DEFAULT NULL,
  p_date_field   text   DEFAULT 'created_at',
  p_sources      text[] DEFAULT NULL,
  p_assigned_to  uuid   DEFAULT NULL,
  p_search       text   DEFAULT NULL,
  p_role         text   DEFAULT NULL,
  p_user_id      uuid   DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  result jsonb;
BEGIN
  IF p_date_field NOT IN ('created_at','updated_at','closed_at') THEN
    RAISE EXCEPTION 'invalid p_date_field: %', p_date_field;
  END IF;

  WITH filtered AS (
    SELECT l.*,
           ROW_NUMBER() OVER (PARTITION BY l.status ORDER BY l.created_at DESC) AS rn,
           COUNT(*)     OVER (PARTITION BY l.status)                            AS status_total
    FROM leads l
    WHERE l.workspace_id = p_workspace_id
      AND (p_sources     IS NULL OR l.source      = ANY(p_sources))
      AND (p_assigned_to IS NULL OR l.assigned_to = p_assigned_to)
      AND (
        p_date_from IS NULL OR
        (p_date_field = 'created_at' AND l.created_at >= p_date_from) OR
        (p_date_field = 'updated_at' AND l.updated_at >= p_date_from) OR
        (p_date_field = 'closed_at'  AND l.closed_at  >= p_date_from)
      )
      AND (
        p_date_to IS NULL OR
        (p_date_field = 'created_at' AND l.created_at <= p_date_to) OR
        (p_date_field = 'updated_at' AND l.updated_at <= p_date_to) OR
        (p_date_field = 'closed_at'  AND l.closed_at  <= p_date_to)
      )
      AND (
        p_search IS NULL OR
        l.first_name ILIKE '%' || p_search || '%' OR
        l.last_name  ILIKE '%' || p_search || '%' OR
        l.email      ILIKE '%' || p_search || '%' OR
        l.phone      ILIKE '%' || p_search || '%'
      )
      AND (
        p_role IS NULL OR p_role = 'admin' OR
        (p_role = 'setter' AND (l.assigned_to = p_user_id OR l.assigned_to IS NULL)) OR
        (p_role = 'closer' AND l.assigned_to = p_user_id
         AND l.status IN ('closing_planifie','no_show_closing','clos'))
      )
  )
  SELECT jsonb_object_agg(
    status,
    jsonb_build_object(
      'total', MAX(status_total),
      'leads', COALESCE(
        jsonb_agg(to_jsonb(filtered) - 'rn' - 'status_total' ORDER BY created_at DESC)
          FILTER (WHERE rn <= p_limit),
        '[]'::jsonb
      )
    )
  )
  INTO result
  FROM filtered
  GROUP BY status;

  RETURN COALESCE(result, '{}'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION leads_grouped_by_status(
  uuid, int, timestamptz, timestamptz, text, text[], uuid, text, text, uuid
) TO authenticated;
```

- [ ] **Step 2: Appliquer la migration**

Run (depuis la racine du projet) : `npx supabase migration up` ou appliquer manuellement dans le dashboard SQL Supabase si le projet n'utilise pas la CLI locale.

Vérifier dans Supabase > Database > Functions que `leads_grouped_by_status` apparaît.

- [ ] **Step 3: Smoke test en SQL**

Dans le SQL editor Supabase, exécuter (remplacer l'UUID) :
```sql
SELECT leads_grouped_by_status(
  '<un workspace_id existant>'::uuid,
  25, NULL, NULL, 'created_at', NULL, NULL, NULL, 'admin', NULL
);
```
Expected : JSON `{ "nouveau": { "total": N, "leads": [...] }, ... }` non vide si leads présents.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/030_leads_grouped_by_status.sql
git commit -m "feat(db): add leads_grouped_by_status RPC + kanban indexes"
```

---

## Task 2: Étendre `leadFiltersSchema` avec filtres de date

**Files:**
- Modify: `src/lib/validations/leads.ts`

- [ ] **Step 1: Ajouter les champs au schema Zod**

Éditer `src/lib/validations/leads.ts`, remplacer `leadFiltersSchema` :

```ts
export const leadFiltersSchema = z.object({
  status: z.string().optional(),
  source: z.string().optional(),
  search: z.string().optional(),
  tags: z.string().optional(),
  assigned_to: z.string().uuid().optional(),
  date_from: z.string().datetime().optional(),
  date_to: z.string().datetime().optional(),
  date_field: z.enum(['created_at', 'updated_at', 'closed_at']).default('created_at'),
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(25),
  sort: z.enum(['created_at', 'updated_at', 'first_name', 'last_name', 'status']).default('created_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
})
```

- [ ] **Step 2: Vérifier le typage**

Run : `npx tsc --noEmit`
Expected : no errors related to `leads.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/validations/leads.ts
git commit -m "feat(api): add date range filters to leadFiltersSchema"
```

---

## Task 3: Appliquer les filtres de date dans `/api/leads`

**Files:**
- Modify: `src/app/api/leads/route.ts`

- [ ] **Step 1: Ajouter les clauses de date après le filtre `source`**

Dans `src/app/api/leads/route.ts`, juste après le bloc `if (filters.source)` (environ ligne 48), ajouter :

```ts
    // Filtre par plage de dates (sur le champ choisi)
    if (filters.date_from) {
      query = query.gte(filters.date_field, filters.date_from)
    }
    if (filters.date_to) {
      query = query.lte(filters.date_field, filters.date_to)
    }
```

- [ ] **Step 2: Build check**

Run : `npm run build`
Expected : build réussit sans erreur TypeScript.

- [ ] **Step 3: Smoke test manuel**

Démarrer `npm run dev`, puis depuis un navigateur authentifié :
```
GET /api/leads?date_from=2026-04-10T00:00:00Z&date_to=2026-04-17T23:59:59Z&date_field=created_at
```
Expected : réponse 200 avec un subset de leads sur cette plage.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/leads/route.ts
git commit -m "feat(api): apply date range filters in GET /api/leads"
```

---

## Task 4: Endpoint `/api/leads/grouped`

**Files:**
- Create: `src/app/api/leads/grouped/route.ts`

- [ ] **Step 1: Créer l'endpoint**

Créer `src/app/api/leads/grouped/route.ts` :

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { leadFiltersSchema } from '@/lib/validations/leads'
import { z } from 'zod'

const groupedQuerySchema = leadFiltersSchema.extend({
  limit_per_status: z.coerce.number().int().min(1).max(100).default(25),
})

export async function GET(request: NextRequest) {
  try {
    const { workspaceId, userId, role } = await getWorkspaceId()
    const supabase = await createClient()

    const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries())
    const filters = groupedQuerySchema.parse(searchParams)

    const sourcesArr = filters.source
      ? filters.source.split(',').filter(Boolean)
      : null

    const { data, error } = await supabase.rpc('leads_grouped_by_status', {
      p_workspace_id: workspaceId,
      p_limit:        filters.limit_per_status,
      p_date_from:    filters.date_from ?? null,
      p_date_to:      filters.date_to ?? null,
      p_date_field:   filters.date_field,
      p_sources:      sourcesArr,
      p_assigned_to:  filters.assigned_to ?? null,
      p_search:       filters.search?.trim() || null,
      p_role:         role,
      p_user_id:      userId,
    })

    if (error) {
      console.error('[API /leads/grouped] RPC error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ columns: data ?? {} })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Build check**

Run : `npm run build`
Expected : build réussit.

- [ ] **Step 3: Smoke test**

Dans un navigateur authentifié : `GET /api/leads/grouped?limit_per_status=5`
Expected : `{ columns: { nouveau: { total, leads: [...] }, ... } }`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/leads/grouped/route.ts
git commit -m "feat(api): add /api/leads/grouped endpoint powered by RPC"
```

---

## Task 5: Helpers de préférences localStorage

**Files:**
- Create: `src/lib/ui-prefs/leads-prefs.ts`

- [ ] **Step 1: Créer le module**

Créer `src/lib/ui-prefs/leads-prefs.ts` :

```ts
import type { LeadStatus } from '@/types'

const DEFAULT_COLUMN_ORDER: LeadStatus[] = [
  'nouveau', 'scripte', 'setting_planifie', 'no_show_setting',
  'closing_planifie', 'no_show_closing', 'clos', 'dead',
]

export type LeadsView = 'list' | 'kanban'

export interface KanbanColumnsPref {
  visible: LeadStatus[]
  order: LeadStatus[]
}

export type DateField = 'created_at' | 'updated_at' | 'closed_at'
export type DatePreset = 'today' | 'yesterday' | '7d' | '30d' | 'custom' | 'all'

export interface DateFilterPref {
  preset: DatePreset
  from?: string
  to?: string
  field: DateField
}

const KEYS = {
  view:       'closrm.leads.view',
  columns:    'closrm.leads.kanban.columns',
  dateFilter: 'closrm.leads.dateFilter',
} as const

function readJSON<T>(key: string): T | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function writeJSON(key: string, value: unknown) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch { /* quota, ignore */ }
}

export function loadView(): LeadsView {
  return readJSON<LeadsView>(KEYS.view) ?? 'list'
}
export function saveView(v: LeadsView) { writeJSON(KEYS.view, v) }

export function loadColumns(): KanbanColumnsPref {
  const stored = readJSON<KanbanColumnsPref>(KEYS.columns)
  if (stored && Array.isArray(stored.visible) && Array.isArray(stored.order)) {
    return stored
  }
  return { visible: [...DEFAULT_COLUMN_ORDER], order: [...DEFAULT_COLUMN_ORDER] }
}
export function saveColumns(p: KanbanColumnsPref) { writeJSON(KEYS.columns, p) }

export function loadDateFilter(): DateFilterPref {
  return readJSON<DateFilterPref>(KEYS.dateFilter)
    ?? { preset: 'all', field: 'created_at' }
}
export function saveDateFilter(p: DateFilterPref) { writeJSON(KEYS.dateFilter, p) }

/** Calcule from/to ISO depuis un preset, dans le fuseau local. */
export function computeRange(preset: DatePreset, custom?: { from?: string; to?: string }):
  { from?: string; to?: string } {
  const now = new Date()
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
  const endOfDay   = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)

  switch (preset) {
    case 'today':
      return { from: startOfDay(now).toISOString(), to: endOfDay(now).toISOString() }
    case 'yesterday': {
      const y = new Date(now); y.setDate(y.getDate() - 1)
      return { from: startOfDay(y).toISOString(), to: endOfDay(y).toISOString() }
    }
    case '7d': {
      const from = new Date(now); from.setDate(from.getDate() - 6)
      return { from: startOfDay(from).toISOString(), to: endOfDay(now).toISOString() }
    }
    case '30d': {
      const from = new Date(now); from.setDate(from.getDate() - 29)
      return { from: startOfDay(from).toISOString(), to: endOfDay(now).toISOString() }
    }
    case 'custom':
      return { from: custom?.from, to: custom?.to }
    case 'all':
    default:
      return {}
  }
}
```

- [ ] **Step 2: Build check**

Run : `npm run build`
Expected : build ok.

- [ ] **Step 3: Commit**

```bash
git add src/lib/ui-prefs/leads-prefs.ts
git commit -m "feat(leads): add localStorage prefs helpers (view, columns, dateFilter)"
```

---

## Task 6: Composant `ViewToggle`

**Files:**
- Create: `src/components/leads/ViewToggle.tsx`

- [ ] **Step 1: Créer le composant**

Créer `src/components/leads/ViewToggle.tsx` :

```tsx
'use client'

import { List, LayoutGrid } from 'lucide-react'
import type { LeadsView } from '@/lib/ui-prefs/leads-prefs'

interface ViewToggleProps {
  value: LeadsView
  onChange: (v: LeadsView) => void
}

export default function ViewToggle({ value, onChange }: ViewToggleProps) {
  const btnStyle = (active: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 32, height: 32, borderRadius: 7, cursor: 'pointer',
    border: 'none',
    background: active ? 'var(--border-primary)' : 'transparent',
    color: active ? 'var(--text-primary)' : 'var(--text-label)',
    transition: 'background 0.15s ease',
  })

  return (
    <div style={{
      display: 'inline-flex', gap: 2, padding: 3,
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border-primary)',
      borderRadius: 9,
    }}>
      <button
        type="button"
        aria-label="Vue liste"
        aria-pressed={value === 'list'}
        onClick={() => onChange('list')}
        style={btnStyle(value === 'list')}
      >
        <List size={15} />
      </button>
      <button
        type="button"
        aria-label="Vue kanban"
        aria-pressed={value === 'kanban'}
        onClick={() => onChange('kanban')}
        style={btnStyle(value === 'kanban')}
      >
        <LayoutGrid size={15} />
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Build check**

Run : `npm run build`
Expected : ok.

- [ ] **Step 3: Commit**

```bash
git add src/components/leads/ViewToggle.tsx
git commit -m "feat(leads): add ViewToggle component (list/kanban)"
```

---

## Task 7: Installer `react-day-picker`

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: Installer**

Run : `npm install react-day-picker@^9.0.0`
Expected : dépendance ajoutée à `package.json`, install réussit.

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add react-day-picker dependency"
```

---

## Task 8: Composant `DateRangePicker`

**Files:**
- Create: `src/components/leads/DateRangePicker.tsx`

- [ ] **Step 1: Créer le composant**

Créer `src/components/leads/DateRangePicker.tsx` :

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { Calendar, ChevronDown } from 'lucide-react'
import { DayPicker, type DateRange } from 'react-day-picker'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import 'react-day-picker/dist/style.css'
import type { DateField, DatePreset, DateFilterPref } from '@/lib/ui-prefs/leads-prefs'
import { computeRange } from '@/lib/ui-prefs/leads-prefs'

const PRESETS: { value: DatePreset; label: string }[] = [
  { value: 'today',     label: "Aujourd'hui" },
  { value: 'yesterday', label: 'Hier' },
  { value: '7d',        label: '7 derniers jours' },
  { value: '30d',       label: '30 derniers jours' },
  { value: 'custom',    label: 'Personnalisé' },
  { value: 'all',       label: 'Tout' },
]

const FIELDS: { value: DateField; label: string }[] = [
  { value: 'created_at', label: 'Création' },
  { value: 'updated_at', label: 'Mise à jour' },
  { value: 'closed_at',  label: 'Clôture' },
]

interface DateRangePickerProps {
  value: DateFilterPref
  onChange: (v: DateFilterPref) => void
}

function labelForPreset(p: DatePreset, from?: string, to?: string) {
  if (p === 'all') return 'Toutes les dates'
  if (p === 'custom' && from && to) {
    return `${format(new Date(from), 'd MMM', { locale: fr })} – ${format(new Date(to), 'd MMM', { locale: fr })}`
  }
  return PRESETS.find(x => x.value === p)?.label ?? 'Date'
}

export default function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const [customRange, setCustomRange] = useState<DateRange | undefined>(() => {
    if (value.preset === 'custom' && value.from && value.to) {
      return { from: new Date(value.from), to: new Date(value.to) }
    }
    return undefined
  })

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  function applyPreset(preset: DatePreset) {
    if (preset === 'custom') {
      // On attend que l'utilisateur pose une plage dans le calendrier
      onChange({ ...value, preset })
      return
    }
    const { from, to } = computeRange(preset)
    onChange({ preset, from, to, field: value.field })
  }

  function applyCustom(range: DateRange | undefined) {
    setCustomRange(range)
    if (range?.from && range.to) {
      const { from, to } = computeRange('custom', {
        from: new Date(range.from.getFullYear(), range.from.getMonth(), range.from.getDate(), 0, 0, 0, 0).toISOString(),
        to:   new Date(range.to.getFullYear(),   range.to.getMonth(),   range.to.getDate(),   23, 59, 59, 999).toISOString(),
      })
      onChange({ preset: 'custom', from, to, field: value.field })
    }
  }

  function applyField(field: DateField) {
    if (value.preset === 'all') {
      onChange({ ...value, field })
      return
    }
    const { from, to } = computeRange(value.preset, { from: value.from, to: value.to })
    onChange({ preset: value.preset, from, to, field })
  }

  const isActive = value.preset !== 'all'

  return (
    <div style={{ position: 'relative' }} ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '7px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600,
          border: isActive || open ? '1px solid rgba(0,200,83,0.4)' : '1px solid var(--border-primary)',
          background: isActive || open ? 'rgba(0,200,83,0.08)' : 'var(--bg-elevated)',
          color: isActive ? 'var(--color-primary)' : 'var(--text-tertiary)',
          cursor: 'pointer', whiteSpace: 'nowrap',
        }}
      >
        <Calendar size={14} />
        {labelForPreset(value.preset, value.from, value.to)}
        <span style={{ opacity: 0.7, fontWeight: 500 }}>
          · {FIELDS.find(f => f.value === value.field)?.label}
        </span>
        <ChevronDown size={12} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 60,
          background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)',
          borderRadius: 12, padding: 14, minWidth: 320,
          boxShadow: '0 12px 40px rgba(0,0,0,0.7)',
          display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {PRESETS.map(p => {
              const active = value.preset === p.value
              return (
                <button key={p.value} type="button" onClick={() => applyPreset(p.value)} style={{
                  textAlign: 'left', padding: '7px 10px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                  border: 'none', cursor: 'pointer',
                  background: active ? 'rgba(0,200,83,0.12)' : 'transparent',
                  color: active ? 'var(--color-primary)' : 'var(--text-secondary)',
                }}>
                  {p.label}
                </button>
              )
            })}
          </div>

          {value.preset === 'custom' && (
            <div style={{ borderTop: '1px solid var(--border-primary)', paddingTop: 10 }}>
              <DayPicker
                mode="range"
                selected={customRange}
                onSelect={applyCustom}
                locale={fr}
                numberOfMonths={1}
              />
            </div>
          )}

          <div style={{ borderTop: '1px solid var(--border-primary)', paddingTop: 10 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
              textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>
              Champ
            </p>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {FIELDS.map(f => {
                const active = value.field === f.value
                return (
                  <button key={f.value} type="button" onClick={() => applyField(f.value)} style={{
                    padding: '5px 11px', borderRadius: 99, fontSize: 11, fontWeight: 600,
                    border: active ? '1px solid rgba(0,200,83,0.4)' : '1px solid var(--border-primary)',
                    background: active ? 'rgba(0,200,83,0.12)' : 'transparent',
                    color: active ? 'var(--color-primary)' : '#777',
                    cursor: 'pointer',
                  }}>
                    {f.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Build check**

Run : `npm run build`
Expected : build ok.

- [ ] **Step 3: Commit**

```bash
git add src/components/leads/DateRangePicker.tsx
git commit -m "feat(leads): add DateRangePicker component with presets + custom range"
```

---

## Task 9: Extraire la vue liste dans `LeadsListView`

**Files:**
- Create: `src/app/(dashboard)/leads/views/LeadsListView.tsx`
- Modify: `src/app/(dashboard)/leads/leads-client.tsx` (allégement — finalisé à la Task 11)

- [ ] **Step 1: Créer le composant de vue liste**

Créer `src/app/(dashboard)/leads/views/LeadsListView.tsx` avec l'intégralité du JSX du `<table>` et de sa pagination actuellement dans `leads-client.tsx` (lignes 283 à 538 environ). Extraire en props tout ce qui vient du parent.

```tsx
'use client'

import { Plus, Phone, Archive, Calendar, ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import type { Lead, LeadStatus, WorkspaceMemberWithUser } from '@/types'
import StatusBadge from '@/components/leads/StatusBadge'
import SourceBadge from '@/components/leads/SourceBadge'
import MemberAssignDropdown from '@/components/shared/MemberAssignDropdown'

function InstagramIcon({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  )
}

const ATTEMPTS_OPTIONS = [
  { value: 0, label: "Pas d'appel" },
  { value: 1, label: '1er Appel' },
  { value: 2, label: '2ème Appel' },
  { value: 3, label: '3ème Appel' },
  { value: 4, label: '4ème Appel' },
  { value: 5, label: '5ème Appel' },
]

function attemptsLabel(n: number) {
  if (n === 0) return "Pas d'appel"
  if (n === 1) return '1er Appel'
  return `${n}ème Appel`
}

export interface LeadsListViewProps {
  leads: Lead[]
  loading: boolean
  members: WorkspaceMemberWithUser[]
  page: number
  totalPages: number
  total: number
  onPageChange: (p: number) => void
  onLeadClick: (leadId: string) => void
  onPatch: (leadId: string, patch: Partial<Lead>) => void
  onCall: (lead: Lead) => void
  onSchedule: (lead: Lead) => void
  onArchive: (lead: Lead) => void
  onRequestClose: (lead: Lead) => void
}

// Re-exporte ATTEMPTS_OPTIONS et attemptsLabel pour usage éventuel ailleurs
export { ATTEMPTS_OPTIONS, attemptsLabel }

export default function LeadsListView(props: LeadsListViewProps) {
  // (le contenu complet du <table> + dropdowns inline tels qu'actuellement dans leads-client.tsx)
  // Remplacer tous les appels directs à setLeads/patchLead par props.onPatch,
  // setSidePanelLeadId par props.onLeadClick, setScheduleTarget par props.onSchedule, etc.
  // Garder la gestion LOCALE de `dropdown` (state interne) — ce n'est pas une préoccupation du parent.
  // …
  // (fin du composant)
  return null // à remplacer par le JSX extrait
}
```

**⚠️ IMPORTANT pour l'implémenteur :** cette task consiste à **déplacer** le JSX existant, pas à le réécrire. Recopier ligne par ligne le contenu actuel du `<table>` de `leads-client.tsx`, puis remplacer les références aux handlers locaux par les props. Le state local (`dropdown`, `tagInput`, refs) reste interne à `LeadsListView`.

- [ ] **Step 2: Compiler**

Run : `npx tsc --noEmit`
Expected : pas d'erreur de typage sur `LeadsListView.tsx`.

- [ ] **Step 3: Commit (partiel — l'intégration se fait Task 11)**

```bash
git add src/app/\(dashboard\)/leads/views/LeadsListView.tsx
git commit -m "refactor(leads): extract list view into LeadsListView (not wired yet)"
```

---

## Task 10: `KanbanCard` et `KanbanColumn`

**Files:**
- Create: `src/app/(dashboard)/leads/views/KanbanCard.tsx`
- Create: `src/app/(dashboard)/leads/views/KanbanColumn.tsx`

- [ ] **Step 1: `KanbanCard`**

Créer `src/app/(dashboard)/leads/views/KanbanCard.tsx` :

```tsx
'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Phone, Tag as TagIcon } from 'lucide-react'
import type { Lead, WorkspaceMemberWithUser } from '@/types'
import SourceBadge from '@/components/leads/SourceBadge'

interface KanbanCardProps {
  lead: Lead
  memberMap: Map<string, WorkspaceMemberWithUser>
  onClick: () => void
}

export default function KanbanCard({ lead, memberMap, onClick }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: lead.id, data: { type: 'card', status: lead.status } })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border-primary)',
    borderRadius: 10,
    padding: 10,
    cursor: 'grab',
    display: 'flex', flexDirection: 'column', gap: 6,
  }

  const assignee = lead.assigned_to ? memberMap.get(lead.assigned_to) : null
  const contact = lead.phone || lead.email || '—'

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        // Le drag est activé uniquement après déplacement (cf. sensors),
        // donc un clic simple déclenche onClick.
        if (!isDragging) { e.stopPropagation(); onClick() }
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {lead.first_name} {lead.last_name}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <SourceBadge source={lead.source} />
        <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {contact}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, color: 'var(--text-label)' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Phone size={11} color={lead.call_attempts > 0 ? '#3b82f6' : 'var(--text-label)'} />
          {lead.call_attempts}
        </span>
        {lead.tags.length > 0 && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <TagIcon size={11} />
            {lead.tags[0]}{lead.tags.length > 1 ? ` +${lead.tags.length - 1}` : ''}
          </span>
        )}
        {assignee && (
          <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 120 }}>
            {assignee.user.full_name || assignee.user.email}
          </span>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: `KanbanColumn`**

Créer `src/app/(dashboard)/leads/views/KanbanColumn.tsx` :

```tsx
'use client'

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { Lead, LeadStatus, WorkspaceMemberWithUser } from '@/types'
import { STATUS_CONFIG } from '@/components/leads/StatusBadge'
import KanbanCard from './KanbanCard'

interface KanbanColumnProps {
  status: LeadStatus
  leads: Lead[]
  total: number
  memberMap: Map<string, WorkspaceMemberWithUser>
  onCardClick: (leadId: string) => void
  onLoadMore?: () => void
  loadingMore?: boolean
}

export default function KanbanColumn({
  status, leads, total, memberMap, onCardClick, onLoadMore, loadingMore,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${status}`, data: { type: 'column', status } })
  const cfg = STATUS_CONFIG[status]
  const hasMore = total > leads.length

  return (
    <div
      ref={setNodeRef}
      style={{
        minWidth: 280, maxWidth: 280, flexShrink: 0,
        background: isOver ? 'var(--bg-hover)' : 'var(--bg-subtle)',
        border: '1px solid var(--border-primary)',
        borderRadius: 12, padding: 10,
        display: 'flex', flexDirection: 'column', gap: 8,
        maxHeight: 'calc(100vh - 220px)',
        transition: 'background 0.1s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 4px' }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.color as string, flexShrink: 0 }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {cfg.label}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-label)' }}>
          {total}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', paddingRight: 2 }}>
        <SortableContext items={leads.map(l => l.id)} strategy={verticalListSortingStrategy}>
          {leads.map(l => (
            <KanbanCard key={l.id} lead={l} memberMap={memberMap} onClick={() => onCardClick(l.id)} />
          ))}
        </SortableContext>

        {hasMore && (
          <button
            type="button"
            onClick={onLoadMore}
            disabled={loadingMore}
            style={{
              padding: '7px 10px', borderRadius: 7, fontSize: 11, fontWeight: 600,
              background: 'transparent', border: '1px dashed var(--border-primary)',
              color: 'var(--text-label)', cursor: loadingMore ? 'wait' : 'pointer',
            }}
          >
            {loadingMore ? 'Chargement…' : `Voir plus (+${total - leads.length})`}
          </button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Build check**

Run : `npm run build`
Expected : build ok.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/leads/views/KanbanCard.tsx src/app/\(dashboard\)/leads/views/KanbanColumn.tsx
git commit -m "feat(leads): add KanbanCard + KanbanColumn components"
```

---

## Task 11: `LeadsKanbanView` avec DnD et pagination par colonne

**Files:**
- Create: `src/app/(dashboard)/leads/views/LeadsKanbanView.tsx`

- [ ] **Step 1: Créer la vue**

Créer `src/app/(dashboard)/leads/views/LeadsKanbanView.tsx` :

```tsx
'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import type { Lead, LeadStatus, LeadSource, WorkspaceMemberWithUser } from '@/types'
import KanbanColumn from './KanbanColumn'
import KanbanCard from './KanbanCard'
import type { DateFilterPref } from '@/lib/ui-prefs/leads-prefs'

interface ColumnData {
  leads: Lead[]
  total: number
  loadedCount: number
}

export interface LeadsKanbanViewProps {
  visibleStatuses: LeadStatus[]
  search: string
  statuses: LeadStatus[]    // pour info — kanban ignore normalement le filtre statut
  sources: LeadSource[]
  assignedTo?: string
  dateFilter: DateFilterPref
  refreshKey: number
  members: WorkspaceMemberWithUser[]
  memberMap: Map<string, WorkspaceMemberWithUser>
  onCardClick: (leadId: string) => void
  onStatusChange: (lead: Lead, newStatus: LeadStatus) => void
  onRequestClose: (lead: Lead) => void
}

const LIMIT = 25

export default function LeadsKanbanView(props: LeadsKanbanViewProps) {
  const {
    visibleStatuses, search, sources, assignedTo, dateFilter, refreshKey,
    memberMap, onCardClick, onStatusChange, onRequestClose,
  } = props

  const [columns, setColumns] = useState<Record<string, ColumnData>>({})
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState<Record<string, boolean>>({})
  const [activeCardId, setActiveCardId] = useState<string | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const buildCommonParams = useCallback(() => {
    const p = new URLSearchParams()
    if (search) p.set('search', search)
    if (sources.length > 0) p.set('source', sources.join(','))
    if (assignedTo) p.set('assigned_to', assignedTo)
    if (dateFilter.from) p.set('date_from', dateFilter.from)
    if (dateFilter.to)   p.set('date_to', dateFilter.to)
    p.set('date_field', dateFilter.field)
    return p
  }, [search, sources, assignedTo, dateFilter])

  // Chargement initial groupé
  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const params = buildCommonParams()
        params.set('limit_per_status', String(LIMIT))
        const res = await fetch(`/api/leads/grouped?${params.toString()}`)
        const json = await res.json()
        if (cancelled || !res.ok) return
        const cols: Record<string, ColumnData> = {}
        for (const status of visibleStatuses) {
          const c = json.columns?.[status]
          cols[status] = {
            leads: c?.leads ?? [],
            total: c?.total ?? 0,
            loadedCount: (c?.leads ?? []).length,
          }
        }
        setColumns(cols)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [buildCommonParams, visibleStatuses, refreshKey])

  async function loadMore(status: LeadStatus) {
    const col = columns[status]
    if (!col) return
    setLoadingMore(m => ({ ...m, [status]: true }))
    try {
      const params = buildCommonParams()
      params.set('status', status)
      params.set('per_page', String(LIMIT))
      params.set('page', String(Math.floor(col.loadedCount / LIMIT) + 1))
      const res = await fetch(`/api/leads?${params.toString()}`)
      const json = await res.json()
      if (!res.ok) return
      setColumns(prev => ({
        ...prev,
        [status]: {
          leads: [...prev[status].leads, ...(json.data ?? [])],
          total: prev[status].total,
          loadedCount: prev[status].loadedCount + (json.data?.length ?? 0),
        },
      }))
    } finally {
      setLoadingMore(m => ({ ...m, [status]: false }))
    }
  }

  const leadById = useMemo(() => {
    const m = new Map<string, { lead: Lead; status: LeadStatus }>()
    for (const status of Object.keys(columns) as LeadStatus[]) {
      for (const lead of columns[status].leads) m.set(lead.id, { lead, status })
    }
    return m
  }, [columns])

  function onDragStart(e: DragStartEvent) {
    setActiveCardId(String(e.active.id))
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveCardId(null)
    const { active, over } = e
    if (!over) return
    const entry = leadById.get(String(active.id))
    if (!entry) return

    // over.id peut être une colonne (`col:status`) ou une autre carte
    let targetStatus: LeadStatus | null = null
    if (typeof over.id === 'string' && over.id.startsWith('col:')) {
      targetStatus = over.id.slice(4) as LeadStatus
    } else {
      const overEntry = leadById.get(String(over.id))
      if (overEntry) targetStatus = overEntry.status
    }
    if (!targetStatus || targetStatus === entry.status) return

    // Cas spécial "Closé" → modale
    if (targetStatus === 'clos') {
      onRequestClose(entry.lead)
      return
    }

    // Optimiste
    moveCardOptimistically(entry.lead.id, entry.status, targetStatus)
    onStatusChange(entry.lead, targetStatus)
  }

  function moveCardOptimistically(leadId: string, from: LeadStatus, to: LeadStatus) {
    setColumns(prev => {
      const src = prev[from]; const dst = prev[to]
      if (!src || !dst) return prev
      const leadIndex = src.leads.findIndex(l => l.id === leadId)
      if (leadIndex < 0) return prev
      const lead = { ...src.leads[leadIndex], status: to }
      return {
        ...prev,
        [from]: { ...src, leads: src.leads.filter(l => l.id !== leadId), total: src.total - 1, loadedCount: src.loadedCount - 1 },
        [to]:   { ...dst, leads: [lead, ...dst.leads], total: dst.total + 1, loadedCount: dst.loadedCount + 1 },
      }
    })
  }

  const activeCard = activeCardId ? leadById.get(activeCardId)?.lead : null

  if (loading && Object.keys(columns).length === 0) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-label)' }}>Chargement du kanban…</div>
  }

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
        {visibleStatuses.map(status => {
          const col = columns[status] ?? { leads: [], total: 0, loadedCount: 0 }
          return (
            <KanbanColumn
              key={status}
              status={status}
              leads={col.leads}
              total={col.total}
              memberMap={memberMap}
              onCardClick={onCardClick}
              onLoadMore={() => loadMore(status)}
              loadingMore={loadingMore[status]}
            />
          )
        })}
      </div>
      <DragOverlay>
        {activeCard
          ? <KanbanCard lead={activeCard} memberMap={memberMap} onClick={() => {}} />
          : null}
      </DragOverlay>
    </DndContext>
  )
}

/** Helper exposé pour le parent : remettre une carte dans sa colonne d'origine après rollback. */
export function rollbackMove(
  setColumns: React.Dispatch<React.SetStateAction<Record<string, ColumnData>>>,
  leadId: string,
  originalStatus: LeadStatus,
) {
  // (helper réservé à un usage avancé, non utilisé en V1 — le parent recharge via refreshKey)
  void setColumns; void leadId; void originalStatus
}
```

**Note :** en cas d'erreur du `PATCH` côté parent, le parent incrémente `refreshKey` pour forcer un re-fetch complet. Simple et robuste pour la V1.

- [ ] **Step 2: Build check**

Run : `npm run build`
Expected : build ok.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/leads/views/LeadsKanbanView.tsx
git commit -m "feat(leads): add LeadsKanbanView with DnD + per-column pagination"
```

---

## Task 12: `KanbanColumnsConfigModal`

**Files:**
- Create: `src/app/(dashboard)/leads/views/KanbanColumnsConfigModal.tsx`

- [ ] **Step 1: Créer la modale**

Créer `src/app/(dashboard)/leads/views/KanbanColumnsConfigModal.tsx` :

```tsx
'use client'

import { useState } from 'react'
import { X, GripVertical } from 'lucide-react'
import {
  DndContext, DragEndEvent, PointerSensor, useSensor, useSensors, closestCenter,
} from '@dnd-kit/core'
import {
  SortableContext, arrayMove, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { LeadStatus } from '@/types'
import { STATUS_CONFIG } from '@/components/leads/StatusBadge'
import type { KanbanColumnsPref } from '@/lib/ui-prefs/leads-prefs'

interface Props {
  value: KanbanColumnsPref
  onClose: () => void
  onSave: (pref: KanbanColumnsPref) => void
}

function Row({ status, checked, onToggle }: { status: LeadStatus; checked: boolean; onToggle: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: status })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform), transition,
    opacity: isDragging ? 0.5 : 1,
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '8px 10px', borderRadius: 8,
    background: 'var(--bg-subtle)',
    border: '1px solid var(--border-primary)',
  }
  const cfg = STATUS_CONFIG[status]
  return (
    <div ref={setNodeRef} style={style}>
      <button type="button" {...attributes} {...listeners}
        style={{ background: 'none', border: 'none', cursor: 'grab', color: 'var(--text-label)', padding: 0 }}>
        <GripVertical size={14} />
      </button>
      <input type="checkbox" checked={checked} onChange={onToggle} />
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.color as string }} />
      <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{cfg.label}</span>
    </div>
  )
}

export default function KanbanColumnsConfigModal({ value, onClose, onSave }: Props) {
  const [order, setOrder] = useState<LeadStatus[]>(value.order)
  const [visible, setVisible] = useState<LeadStatus[]>(value.visible)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  function toggle(s: LeadStatus) {
    setVisible(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIndex = order.indexOf(active.id as LeadStatus)
    const newIndex = order.indexOf(over.id as LeadStatus)
    setOrder(arrayMove(order, oldIndex, newIndex))
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)',
        borderRadius: 14, padding: 20, minWidth: 360, maxWidth: 420,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Colonnes du kanban
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-label)', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 0, marginBottom: 12 }}>
          Cocher = afficher. Glisser pour réordonner.
        </p>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={order} strategy={verticalListSortingStrategy}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {order.map(s => (
                <Row key={s} status={s} checked={visible.includes(s)} onToggle={() => toggle(s)} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button onClick={onClose} style={{
            padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
            background: 'transparent', border: '1px solid var(--border-primary)',
            color: 'var(--text-secondary)', cursor: 'pointer',
          }}>Annuler</button>
          <button
            onClick={() => { onSave({ visible, order }); onClose() }}
            disabled={visible.length === 0}
            style={{
              padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              background: 'var(--color-primary)', border: 'none',
              color: '#000', cursor: visible.length === 0 ? 'not-allowed' : 'pointer',
              opacity: visible.length === 0 ? 0.5 : 1,
            }}
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Build check**

Run : `npm run build`
Expected : ok.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/leads/views/KanbanColumnsConfigModal.tsx
git commit -m "feat(leads): add KanbanColumnsConfigModal (toggle + reorder)"
```

---

## Task 13: Câbler l'orchestrateur `leads-client.tsx`

**Files:**
- Modify: `src/app/(dashboard)/leads/leads-client.tsx`

- [ ] **Step 1: Réécrire l'orchestrateur**

Remplacer le contenu de `src/app/(dashboard)/leads/leads-client.tsx` par :

```tsx
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Plus, Settings2 } from 'lucide-react'
import LeadSidePanel from '@/components/shared/LeadSidePanel'
import { Lead, LeadStatus, LeadSource, WorkspaceMemberWithUser } from '@/types'
import LeadFilters from '@/components/leads/LeadFilters'
import LeadForm from '@/components/leads/LeadForm'
import ClosingModal from '@/components/leads/ClosingModal'
import ConfirmModal from '@/components/shared/ConfirmModal'
import CallScheduleModal from '@/components/leads/CallScheduleModal'
import DateRangePicker from '@/components/leads/DateRangePicker'
import ViewToggle from '@/components/leads/ViewToggle'
import LeadsListView from './views/LeadsListView'
import LeadsKanbanView from './views/LeadsKanbanView'
import KanbanColumnsConfigModal from './views/KanbanColumnsConfigModal'
import {
  loadView, saveView, loadColumns, saveColumns, loadDateFilter, saveDateFilter,
  type LeadsView, type KanbanColumnsPref, type DateFilterPref,
} from '@/lib/ui-prefs/leads-prefs'

interface Meta { total: number; page: number; per_page: number; total_pages: number }

interface LeadsClientProps {
  initialLeads: Lead[]
  initialTotal: number
}

export default function LeadsClient({ initialLeads, initialTotal }: LeadsClientProps) {
  // Vue
  const [view, setView] = useState<LeadsView>('list')
  const [columnsPref, setColumnsPref] = useState<KanbanColumnsPref>(
    { visible: ['nouveau','scripte','setting_planifie','no_show_setting','closing_planifie','no_show_closing','clos','dead'],
      order:   ['nouveau','scripte','setting_planifie','no_show_setting','closing_planifie','no_show_closing','clos','dead'] }
  )
  const [dateFilter, setDateFilter] = useState<DateFilterPref>({ preset: 'all', field: 'created_at' })
  const [showColumnsModal, setShowColumnsModal] = useState(false)

  // Hydrate localStorage au mount
  useEffect(() => {
    setView(loadView())
    setColumnsPref(loadColumns())
    setDateFilter(loadDateFilter())
  }, [])

  // Persist au changement
  useEffect(() => { saveView(view) }, [view])
  useEffect(() => { saveColumns(columnsPref) }, [columnsPref])
  useEffect(() => { saveDateFilter(dateFilter) }, [dateFilter])

  // Données liste (pagination classique)
  const [leads, setLeads] = useState<Lead[]>(initialLeads)
  const [meta, setMeta] = useState<Meta>({
    total: initialTotal, page: 1, per_page: 25,
    total_pages: Math.ceil(initialTotal / 25) || 1,
  })
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [showForm, setShowForm] = useState(false)
  const [confirm, setConfirm] = useState<{ title: string; message: string; danger?: boolean; onConfirm: () => void } | null>(null)
  const [scheduleTarget, setScheduleTarget] = useState<Lead | null>(null)
  const [closingTarget, setClosingTarget] = useState<Lead | null>(null)
  const [sidePanelLeadId, setSidePanelLeadId] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  // Membres workspace
  const [members, setMembers] = useState<WorkspaceMemberWithUser[]>([])
  const memberMap = useRef(new Map<string, WorkspaceMemberWithUser>())
  useEffect(() => {
    async function fetchMembers() {
      try {
        const res = await fetch('/api/workspaces/members')
        if (res.ok) {
          const json = await res.json()
          const data: WorkspaceMemberWithUser[] = json.data ?? []
          setMembers(data)
          memberMap.current = new Map(data.map(m => [m.user_id, m]))
        }
      } catch { /* ignore */ }
    }
    fetchMembers()
  }, [])

  // Filtres
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statuses, setStatuses] = useState<LeadStatus[]>([])
  const [sources, setSources] = useState<LeadSource[]>([])
  const [assignedTo, setAssignedTo] = useState<string | undefined>(undefined)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isInitialMount = useRef(true)

  const handleFiltersChange = useCallback((f: { search: string; statuses: LeadStatus[]; sources: LeadSource[]; assigned_to?: string }) => {
    setStatuses(f.statuses); setSources(f.sources); setAssignedTo(f.assigned_to)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedSearch(f.search), 300)
  }, [])

  // Fetch liste (uniquement pertinent en vue liste)
  useEffect(() => {
    if (view !== 'list') return
    if (isInitialMount.current) { isInitialMount.current = false; return }
    let cancelled = false
    async function doFetch() {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        params.set('page', String(page))
        params.set('per_page', '25')
        if (debouncedSearch) params.set('search', debouncedSearch)
        if (statuses.length > 0) params.set('status', statuses.join(','))
        if (sources.length > 0) params.set('source', sources.join(','))
        if (assignedTo) params.set('assigned_to', assignedTo)
        if (dateFilter.from) params.set('date_from', dateFilter.from)
        if (dateFilter.to)   params.set('date_to', dateFilter.to)
        params.set('date_field', dateFilter.field)

        const res = await fetch(`/api/leads?${params.toString()}`)
        const json = await res.json()
        if (!cancelled && res.ok) { setLeads(json.data); setMeta(json.meta) }
      } finally { if (!cancelled) setLoading(false) }
    }
    doFetch()
    return () => { cancelled = true }
  }, [view, page, debouncedSearch, statuses, sources, assignedTo, dateFilter, refreshKey])

  useEffect(() => { setPage(1) }, [debouncedSearch, statuses, sources, assignedTo, dateFilter])

  function patchLead(id: string, patch: Partial<Lead>) {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l))
    fetch(`/api/leads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }).then(r => {
      if (!r.ok && view === 'kanban') setRefreshKey(k => k + 1) // rollback via refetch
    })
  }

  function onKanbanStatusChange(lead: Lead, newStatus: LeadStatus) {
    patchLead(lead.id, { status: newStatus })
  }

  function callLead(lead: Lead) {
    setConfirm({
      title: 'Enregistrer un appel',
      message: `Confirmer une tentative d'appel pour ${lead.first_name} ${lead.last_name} ? Le compteur passera à ${lead.call_attempts + 1}.`,
      onConfirm: () => { setConfirm(null); patchLead(lead.id, { call_attempts: lead.call_attempts + 1 }) },
    })
  }

  function archiveLead(lead: Lead) {
    setConfirm({
      title: 'Archiver ce lead',
      message: `${lead.first_name} ${lead.last_name} sera archivé (statut Dead). Cette action est réversible depuis la fiche lead.`,
      danger: true,
      onConfirm: async () => {
        setConfirm(null)
        await fetch(`/api/leads/${lead.id}`, { method: 'DELETE' })
        setLeads(prev => prev.filter(l => l.id !== lead.id))
        setMeta(prev => ({ ...prev, total: prev.total - 1 }))
        if (view === 'kanban') setRefreshKey(k => k + 1)
      },
    })
  }

  function onLeadCreated(lead: Lead) {
    setLeads(prev => [lead, ...prev])
    setMeta(prev => ({ ...prev, total: prev.total + 1 }))
    if (view === 'kanban') setRefreshKey(k => k + 1)
  }

  const visibleKanbanStatuses = columnsPref.order.filter(s => columnsPref.visible.includes(s))

  return (
    <div style={{ padding: 32 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Leads</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            {view === 'list' ? (loading ? '...' : `${meta.total} lead${meta.total > 1 ? 's' : ''} au total`) : 'Vue kanban'}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {view === 'kanban' && (
            <button onClick={() => setShowColumnsModal(true)} title="Configurer les colonnes" style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)',
              color: 'var(--text-tertiary)', cursor: 'pointer',
            }}>
              <Settings2 size={14} /> Colonnes
            </button>
          )}
          <ViewToggle value={view} onChange={setView} />
          <button onClick={() => setShowForm(true)} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: 'var(--color-primary)', border: 'none', color: '#000', cursor: 'pointer',
          }}>
            <Plus size={15} /> Ajouter un lead
          </button>
        </div>
      </div>

      {/* Filtres + date */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <DateRangePicker value={dateFilter} onChange={setDateFilter} />
        <LeadFilters onFiltersChange={handleFiltersChange} />
      </div>

      {view === 'list' ? (
        <LeadsListView
          leads={leads}
          loading={loading}
          members={members}
          page={meta.page}
          totalPages={meta.total_pages}
          total={meta.total}
          onPageChange={setPage}
          onLeadClick={(id) => setSidePanelLeadId(id)}
          onPatch={(id, patch) => patchLead(id, patch)}
          onCall={callLead}
          onSchedule={setScheduleTarget}
          onArchive={archiveLead}
          onRequestClose={setClosingTarget}
        />
      ) : (
        <LeadsKanbanView
          visibleStatuses={visibleKanbanStatuses}
          search={debouncedSearch}
          statuses={statuses}
          sources={sources}
          assignedTo={assignedTo}
          dateFilter={dateFilter}
          refreshKey={refreshKey}
          members={members}
          memberMap={memberMap.current}
          onCardClick={(id) => setSidePanelLeadId(id)}
          onStatusChange={onKanbanStatusChange}
          onRequestClose={setClosingTarget}
        />
      )}

      {/* Modales partagées */}
      {showForm && <LeadForm onClose={() => setShowForm(false)} onCreated={onLeadCreated} />}
      {scheduleTarget && (
        <CallScheduleModal
          lead={scheduleTarget}
          onClose={() => setScheduleTarget(null)}
          onScheduled={() => { setScheduleTarget(null); setRefreshKey(k => k + 1) }}
        />
      )}
      {confirm && (
        <ConfirmModal
          title={confirm.title} message={confirm.message}
          confirmLabel={confirm.danger ? 'Archiver' : 'Confirmer'}
          confirmDanger={confirm.danger}
          onConfirm={confirm.onConfirm} onCancel={() => setConfirm(null)}
        />
      )}
      {closingTarget && (
        <ClosingModal
          leadName={`${closingTarget.first_name} ${closingTarget.last_name}`}
          onClose={() => { setClosingTarget(null); if (view === 'kanban') setRefreshKey(k => k + 1) }}
          onConfirm={(data) => {
            patchLead(closingTarget.id, {
              status: 'clos',
              deal_amount: data.deal_amount,
              deal_installments: data.deal_installments,
              cash_collected: data.cash_collected,
              closed_at: new Date().toISOString(),
            } as Partial<Lead>)
            setClosingTarget(null)
            if (view === 'kanban') setRefreshKey(k => k + 1)
          }}
        />
      )}
      {sidePanelLeadId && (
        <LeadSidePanel leadId={sidePanelLeadId} onClose={() => setSidePanelLeadId(null)} />
      )}
      {showColumnsModal && (
        <KanbanColumnsConfigModal
          value={columnsPref}
          onClose={() => setShowColumnsModal(false)}
          onSave={setColumnsPref}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Build + lint**

Run : `npm run build && npm run lint`
Expected : les deux passent.

- [ ] **Step 3: Test manuel**

Démarrer `npm run dev`. Sur `/leads` :
1. Toggle vue liste ↔ kanban fonctionne, préférence survit au refresh
2. Drag d'un lead entre colonnes → statut mis à jour (vérif dans la vue liste)
3. Drop sur colonne "Closé" ouvre `ClosingModal`
4. Clic simple sur une carte ouvre le side panel (pas bloqué par le drag)
5. Date range `Aujourd'hui` ne montre que les leads créés aujourd'hui (vue liste + kanban)
6. Changer le champ `Création` → `Clôture` refetch les deux vues
7. Bouton "⚙ Colonnes" ouvre la modale, masquer `Dead` puis enregistrer → colonne disparaît + persiste après refresh
8. `Voir plus (+N)` en bas d'une colonne charge 25 leads supplémentaires

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/leads/leads-client.tsx
git commit -m "feat(leads): wire kanban view, DateRangePicker and ViewToggle in orchestrator"
```

---

## Task 14: PR vers `develop`

- [ ] **Step 1: Push de la branche**

Run : `git push -u origin feature/pierre-leads-kanban-date-filter`

- [ ] **Step 2: Créer la PR**

Run :
```bash
gh pr create --base develop --title "feat(leads): vue kanban + sélecteur de dates" --body "$(cat <<'EOF'
## Résumé
- Ajoute une vue kanban drag-and-drop (8 colonnes configurables, pagination par colonne)
- Ajoute un sélecteur de plage de dates (Auj/Hier/7J/30J/Perso) avec choix du champ (création/MAJ/clôture)
- Endpoint `/api/leads/grouped` alimenté par une RPC Postgres `leads_grouped_by_status`
- Préférences (vue, colonnes, date) persistées en localStorage
- Éclatement de `leads-client.tsx` en orchestrateur + `LeadsListView` / `LeadsKanbanView`

## Spec
`docs/superpowers/specs/2026-04-17-leads-kanban-date-filter-design.md`

## Test plan
- [ ] Migration 029 appliquée en base
- [ ] Vue liste : filtres de date fonctionnent (created_at / updated_at / closed_at)
- [ ] Vue kanban : drag entre colonnes met à jour le statut
- [ ] Drop sur "Closé" ouvre la modale ClosingModal
- [ ] Clic simple ouvre le side panel (pas bloqué par le drag)
- [ ] Config colonnes : masquer/réordonner + persistance localStorage
- [ ] Préférences survivent au refresh et à la déconnexion

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Partager l'URL**

L'URL de la PR est retournée par `gh pr create`. La partager à Pierre pour review.

---

## Récap spec coverage

| Section spec | Task(s) |
|---|---|
| §3 Architecture composants | 9, 10, 11, 12, 13 |
| §4 Vue Liste (extraction) | 9, 13 |
| §5.1 Colonnes configurables | 12, 13 |
| §5.2 En-tête colonne | 10 |
| §5.3 Carte lead | 10 |
| §5.4 Drag & drop + cas "Closé" | 11, 13 |
| §5.5 Pagination par colonne | 10, 11 |
| §6 DateRangePicker | 5, 7, 8 |
| §7 API + date filters | 2, 3 |
| §7.3 Endpoint grouped | 4 |
| §7.4 RPC + index | 1 |
| §8 ViewToggle | 6, 13 |
| §9 Modales partagées | 13 |
| §10 Error handling (rollback via refreshKey) | 13 |
| §11 Tests manuels | 13 step 3 |

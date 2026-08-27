# Session DM Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a setter run a guided "DM session" from ClosRM Mobile — pick how many leads to work through, get them served one at a time in priority order with full context, and clear the queue using template messages, without ever leaving a linear flow.

**Architecture:** All selection/priority/template/persistence logic lives in new Next.js API routes under `src/app/api/dm-sessions/`, backed by two new Supabase tables (`dm_sessions`, `dm_session_items`). The mobile app is a pure client of this API — no business logic duplicated in React Native. The entry point is the existing `FollowUpsScreen` (Relances tab); a new `DmSessionStack` (config → lead view → completion) is pushed from there. Archiving a lead reuses the existing `PATCH /api/leads/[id]` route (`status: 'dead'`); scheduling the next relaunch reuses `POST /api/follow-ups`.

**Tech Stack:** Next.js 14 App Router (API routes), Supabase Postgres + RLS, Zod validation, React Native/Expo (mobile client), React Navigation (native-stack), `@gorhom/bottom-sheet` for the delay picker.

**Spec:** `docs/superpowers/specs/2026-08-27-session-dm-design.md`

## Global Constraints

- Mobile-only UI for this iteration; all business logic lives in API routes so a future web UI can reuse it without duplication (spec: "Scope plateforme").
- No AI generation anywhere in this feature — templates are static strings with `{{prenom}}`/`{{jours_depuis_dernier_contact}}` substitution only.
- No response-rate tracking or read/reply UI — a lead can never be marked "replied" from inside a session (spec: "Hors scope").
- Reuse existing tables/routes, never duplicate: `follow_ups` (via `POST /api/follow-ups`), `leads.status` (via `PATCH /api/leads/[id]`), `instagram_interactions` (read-only).
- "À archiver" sets `leads.status = 'dead'`. "Relancé" never touches `leads.status`.
- Every new API route follows the existing pattern: `getWorkspaceId()` for auth/workspace scoping, Zod schema in `src/lib/validations/`, RLS via `workspace_id in (select user_workspace_ids())`.
- Migrations go in `supabase/migrations/`, next available number is `096`.

---

## File Structure

**New files:**
- `supabase/migrations/096_dm_sessions.sql` — `dm_sessions` + `dm_session_items` tables, RLS.
- `src/lib/validations/dm-sessions.ts` — Zod schemas: create config, item outcome update.
- `src/lib/dm-sessions/priority.ts` — pure function building the prioritized lead queue from `leads`/`follow_ups`/`instagram_interactions`.
- `src/lib/dm-sessions/templates.ts` — pure function picking + rendering the message template for a lead.
- `src/app/api/dm-sessions/route.ts` — `POST` (create session from config), `GET` (find the active/resumable session for the workspace).
- `src/app/api/dm-sessions/[id]/route.ts` — `GET` (session + items + current position).
- `src/app/api/dm-sessions/[id]/items/[itemId]/route.ts` — `PATCH` (mark item outcome: `relaunched` | `archived` | `skipped`).
- `mobile/src/navigation/stacks/DmSessionStack.tsx` — new stack: `DmSessionConfig`, `DmSessionLead`, `DmSessionComplete`.
- `mobile/src/app/dm-session/DmSessionConfigScreen.tsx`
- `mobile/src/app/dm-session/DmSessionLeadScreen.tsx`
- `mobile/src/app/dm-session/DmSessionCompleteScreen.tsx`
- `mobile/src/components/dm-session/DelaySheetProvider.tsx` — bottom sheet for next-relaunch delay, mirrors `ScheduleSheetProvider` structure.
- `mobile/src/hooks/useDmSession.ts` — fetch/mutate the active session via `api`.

**Modified files:**
- `src/app/api/leads/[id]/journey/route.ts` — merge `instagram_interactions` rows into the returned `events` array.
- `mobile/src/app/follow-ups/FollowUpsScreen.tsx` — add the "Lancer une session DM" entry card above the tab list.
- `mobile/src/navigation/types.ts` — add `DmSessionStackParamList`, wire into `FollowUpsStackParamList` or a root-level push (see Task 8).
- `mobile/src/App.tsx` (or wherever providers are mounted — confirm in Task 9) — mount `DelaySheetProvider`.

---

### Task 1: Migration — `dm_sessions` and `dm_session_items` tables

**Files:**
- Create: `supabase/migrations/096_dm_sessions.sql`
- Test: manual verification via `supabase db reset` or a scratch SQL check (no automated test framework for raw SQL in this repo — verified by Task 2's route hitting these tables successfully)

**Interfaces:**
- Produces: table `dm_sessions(id, workspace_id, status, target_count, stale_threshold_days, created_at, completed_at)`, table `dm_session_items(id, session_id, lead_id, position, category, outcome, note, created_at, updated_at)`.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/096_dm_sessions.sql
-- Session DM : file de leads à relancer en une passe guidée, un lead à la
-- fois. Persistée pour survivre à la fermeture de l'app (spec: reprendre
-- une session en cours plutôt que la recommencer à zéro).

create table dm_sessions (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'completed', 'abandoned')),
  target_count integer not null check (target_count > 0),
  stale_threshold_days integer not null default 30 check (stale_threshold_days > 0),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index idx_dm_sessions_workspace_active
  on dm_sessions(workspace_id, status)
  where status = 'active';

create table dm_session_items (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references dm_sessions(id) on delete cascade,
  lead_id uuid not null references leads(id) on delete cascade,
  position integer not null,
  category text not null check (category in (
    'relance_en_retard', 'engagement_instagram', 'jamais_recontacte', 'premier_message'
  )),
  outcome text check (outcome in ('relaunched', 'archived', 'skipped')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, lead_id)
);

create index idx_dm_session_items_session_position
  on dm_session_items(session_id, position);

alter table dm_sessions enable row level security;
alter table dm_session_items enable row level security;

create policy "Workspace dm_sessions" on dm_sessions
  for all using (
    workspace_id in (select user_workspace_ids())
  );

create policy "Workspace dm_session_items" on dm_session_items
  for all using (
    session_id in (
      select id from dm_sessions
      where workspace_id in (select user_workspace_ids())
    )
  );
```

- [ ] **Step 2: Apply the migration locally**

Run: `supabase db reset` (or `supabase migration up` if the local stack is already running)
Expected: migration applies with no error; `dm_sessions` and `dm_session_items` visible via `supabase db diff` or the Studio table list.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/096_dm_sessions.sql
git commit -m "feat(db): add dm_sessions and dm_session_items tables"
```

---

### Task 2: Priority queue builder (`src/lib/dm-sessions/priority.ts`)

**Files:**
- Create: `src/lib/dm-sessions/priority.ts`
- Test: `src/lib/dm-sessions/__tests__/priority.test.ts`

**Interfaces:**
- Consumes: a Supabase client (server-side, already workspace-scoped by caller), `workspaceId: string`, `staleThresholdDays: number`.
- Produces: `buildPriorityQueue(supabase, workspaceId, staleThresholdDays): Promise<PriorityLead[]>` where
  ```ts
  interface PriorityLead {
    lead_id: string
    category: 'relance_en_retard' | 'engagement_instagram' | 'jamais_recontacte' | 'premier_message'
  }
  ```
  Ordered by category priority (relance_en_retard → engagement_instagram → jamais_recontacte → premier_message), each category internally ordered oldest-first. Task 4 (the API route) truncates this list to `target_count`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/dm-sessions/__tests__/priority.test.ts
import { describe, it, expect, vi } from 'vitest'
import { buildPriorityQueue } from '../priority'

function makeSupabaseStub(responses: Record<string, unknown[]>) {
  return {
    from(table: string) {
      const rows = responses[table] ?? []
      const builder: Record<string, unknown> = {}
      const chain = () => builder
      builder.select = chain
      builder.eq = chain
      builder.lt = chain
      builder.is = chain
      builder.order = chain
      builder.then = (resolve: (v: { data: unknown[]; error: null }) => void) =>
        resolve({ data: rows, error: null })
      return builder
    },
  }
}

describe('buildPriorityQueue', () => {
  it('orders leads with overdue follow-ups before never-recontacted leads', async () => {
    const supabase = makeSupabaseStub({
      follow_ups: [{ lead_id: 'lead-overdue', scheduled_at: '2026-01-01T00:00:00Z' }],
      instagram_interactions: [],
      leads: [
        { id: 'lead-overdue', last_activity_at: '2026-01-01T00:00:00Z' },
        { id: 'lead-stale', last_activity_at: '2025-01-01T00:00:00Z' },
      ],
    })

    const queue = await buildPriorityQueue(supabase as never, 'ws-1', 30)

    expect(queue[0]).toEqual({ lead_id: 'lead-overdue', category: 'relance_en_retard' })
    expect(queue.some((q) => q.lead_id === 'lead-stale' && q.category === 'jamais_recontacte')).toBe(true)
  })

  it('deduplicates a lead present in multiple categories, keeping the highest-priority one', async () => {
    const supabase = makeSupabaseStub({
      follow_ups: [{ lead_id: 'lead-both', scheduled_at: '2026-01-01T00:00:00Z' }],
      instagram_interactions: [{ lead_id: 'lead-both', last_seen_at: '2026-01-02T00:00:00Z' }],
      leads: [{ id: 'lead-both', last_activity_at: '2026-01-02T00:00:00Z' }],
    })

    const queue = await buildPriorityQueue(supabase as never, 'ws-1', 30)

    expect(queue).toHaveLength(1)
    expect(queue[0].category).toBe('relance_en_retard')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/dm-sessions/__tests__/priority.test.ts`
Expected: FAIL — `Cannot find module '../priority'`

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/dm-sessions/priority.ts
import type { SupabaseClient } from '@supabase/supabase-js'

export type PriorityCategory =
  | 'relance_en_retard'
  | 'engagement_instagram'
  | 'jamais_recontacte'
  | 'premier_message'

export interface PriorityLead {
  lead_id: string
  category: PriorityCategory
}

const CATEGORY_ORDER: PriorityCategory[] = [
  'relance_en_retard',
  'engagement_instagram',
  'jamais_recontacte',
  'premier_message',
]

export async function buildPriorityQueue(
  supabase: SupabaseClient,
  workspaceId: string,
  staleThresholdDays: number
): Promise<PriorityLead[]> {
  const now = new Date()
  const staleBefore = new Date(now.getTime() - staleThresholdDays * 86_400_000).toISOString()

  const byCategory = new Map<PriorityCategory, string[]>()

  const { data: overdueFollowUps } = await supabase
    .from('follow_ups')
    .select('lead_id, scheduled_at')
    .eq('workspace_id', workspaceId)
    .eq('status', 'en_attente')
    .lt('scheduled_at', now.toISOString())
    .order('scheduled_at', { ascending: true })
  byCategory.set('relance_en_retard', (overdueFollowUps ?? []).map((r) => r.lead_id as string))

  const { data: engagedLeads } = await supabase
    .from('instagram_interactions')
    .select('lead_id, last_seen_at')
    .eq('workspace_id', workspaceId)
    .order('last_seen_at', { ascending: true })
  byCategory.set('engagement_instagram', (engagedLeads ?? []).map((r) => r.lead_id as string))

  const { data: staleLeads } = await supabase
    .from('leads')
    .select('id, last_activity_at')
    .eq('workspace_id', workspaceId)
    .lt('last_activity_at', staleBefore)
    .order('last_activity_at', { ascending: true })
  byCategory.set('jamais_recontacte', (staleLeads ?? []).map((r) => r.id as string))

  const { data: newLeads } = await supabase
    .from('leads')
    .select('id, last_activity_at')
    .eq('workspace_id', workspaceId)
    .is('last_activity_at', null)
    .order('created_at', { ascending: true })
  byCategory.set('premier_message', (newLeads ?? []).map((r) => r.id as string))

  const seen = new Set<string>()
  const queue: PriorityLead[] = []
  for (const category of CATEGORY_ORDER) {
    for (const leadId of byCategory.get(category) ?? []) {
      if (seen.has(leadId)) continue
      seen.add(leadId)
      queue.push({ lead_id: leadId, category })
    }
  }
  return queue
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/dm-sessions/__tests__/priority.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/dm-sessions/priority.ts src/lib/dm-sessions/__tests__/priority.test.ts
git commit -m "feat: add dm-session priority queue builder"
```

---

### Task 3: Message templates (`src/lib/dm-sessions/templates.ts`)

**Files:**
- Create: `src/lib/dm-sessions/templates.ts`
- Test: `src/lib/dm-sessions/__tests__/templates.test.ts`

**Interfaces:**
- Consumes: `PriorityCategory` (from Task 2), `{ firstName: string; daysSinceLastContact: number | null }`.
- Produces: `pickTemplate(category: PriorityCategory, lead: { firstName: string; daysSinceLastContact: number | null }): { label: string; text: string }` — `label` is the badge shown in the UI (e.g. `"Reprise après 61 jours"`), `text` is the rendered message.

Template copy below is a placeholder pending Pierre's final wording (spec: "Les textes des 3 templates sont à écrire par Pierre") — implementer must not treat this copy as final without checking with Pierre; the function signature and category→template mapping are the contract that matters for this task.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/dm-sessions/__tests__/templates.test.ts
import { describe, it, expect } from 'vitest'
import { pickTemplate } from '../templates'

describe('pickTemplate', () => {
  it('returns the first-message template for premier_message category', () => {
    const result = pickTemplate('premier_message', { firstName: 'Marie', daysSinceLastContact: null })
    expect(result.label).toBe('Premier message')
    expect(result.text).toContain('Marie')
  })

  it('returns the standard relaunch template for relance_en_retard', () => {
    const result = pickTemplate('relance_en_retard', { firstName: 'Karim', daysSinceLastContact: 8 })
    expect(result.label).toBe('Relance')
    expect(result.text).toContain('Karim')
  })

  it('returns the long-absence template with day count for jamais_recontacte', () => {
    const result = pickTemplate('jamais_recontacte', { firstName: 'Karim', daysSinceLastContact: 61 })
    expect(result.label).toBe('Reprise après 61 jours')
    expect(result.text).toContain('Karim')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/dm-sessions/__tests__/templates.test.ts`
Expected: FAIL — `Cannot find module '../templates'`

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/dm-sessions/templates.ts
import type { PriorityCategory } from './priority'

export interface TemplateContext {
  firstName: string
  daysSinceLastContact: number | null
}

export interface RenderedTemplate {
  label: string
  text: string
}

export function pickTemplate(category: PriorityCategory, ctx: TemplateContext): RenderedTemplate {
  const name = ctx.firstName || 'là'

  if (category === 'premier_message' || category === 'engagement_instagram') {
    return {
      label: 'Premier message',
      text: `Salut ${name} ! J'ai vu ton profil, je me permets de venir vers toi.`,
    }
  }

  if (category === 'jamais_recontacte' && ctx.daysSinceLastContact !== null) {
    return {
      label: `Reprise après ${ctx.daysSinceLastContact} jours`,
      text: `Salut ${name}, ça fait un moment ! Je voulais savoir où tu en étais.`,
    }
  }

  return {
    label: 'Relance',
    text: `Salut ${name}, je reviens vers toi — toujours partant(e) ?`,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/dm-sessions/__tests__/templates.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/dm-sessions/templates.ts src/lib/dm-sessions/__tests__/templates.test.ts
git commit -m "feat: add dm-session message template picker"
```

---

### Task 4: Validation schemas (`src/lib/validations/dm-sessions.ts`)

**Files:**
- Create: `src/lib/validations/dm-sessions.ts`
- Test: `src/lib/validations/__tests__/dm-sessions.test.ts`

**Interfaces:**
- Produces: `createDmSessionSchema` (`{ target_count: number; stale_threshold_days?: number }`), `updateDmSessionItemSchema` (`{ outcome: 'relaunched' | 'archived' | 'skipped'; note?: string; delay_days?: number }`). Task 5 and Task 6 import these.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/validations/__tests__/dm-sessions.test.ts
import { describe, it, expect } from 'vitest'
import { createDmSessionSchema, updateDmSessionItemSchema } from '../dm-sessions'

describe('createDmSessionSchema', () => {
  it('accepts a valid target_count and defaults stale_threshold_days to 30', () => {
    const result = createDmSessionSchema.parse({ target_count: 30 })
    expect(result).toEqual({ target_count: 30, stale_threshold_days: 30 })
  })

  it('rejects a target_count of 0', () => {
    expect(() => createDmSessionSchema.parse({ target_count: 0 })).toThrow()
  })
})

describe('updateDmSessionItemSchema', () => {
  it('accepts a relaunched outcome with a delay and note', () => {
    const result = updateDmSessionItemSchema.parse({
      outcome: 'relaunched',
      delay_days: 7,
      note: 'A dit revenir en septembre',
    })
    expect(result.outcome).toBe('relaunched')
  })

  it('rejects an unknown outcome value', () => {
    expect(() => updateDmSessionItemSchema.parse({ outcome: 'replied' })).toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/validations/__tests__/dm-sessions.test.ts`
Expected: FAIL — `Cannot find module '../dm-sessions'`

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/validations/dm-sessions.ts
import { z } from 'zod'

export const createDmSessionSchema = z.object({
  target_count: z.number().int().min(1).max(200),
  stale_threshold_days: z.number().int().min(1).max(365).default(30),
})

export const updateDmSessionItemSchema = z.object({
  outcome: z.enum(['relaunched', 'archived', 'skipped']),
  note: z.string().max(2000).optional(),
  delay_days: z.number().int().min(1).max(365).optional(),
})

export type CreateDmSessionData = z.infer<typeof createDmSessionSchema>
export type UpdateDmSessionItemData = z.infer<typeof updateDmSessionItemSchema>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/validations/__tests__/dm-sessions.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/validations/dm-sessions.ts src/lib/validations/__tests__/dm-sessions.test.ts
git commit -m "feat: add dm-session validation schemas"
```

---

### Task 5: `POST /api/dm-sessions` and `GET /api/dm-sessions` (create + find active)

**Files:**
- Create: `src/app/api/dm-sessions/route.ts`
- Test: `src/app/api/dm-sessions/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `createDmSessionSchema`, `buildPriorityQueue` (Task 2), `getWorkspaceId` (`src/lib/supabase/get-workspace.ts`).
- Produces: `POST` → `{ data: { id: string; status: 'active'; items: Array<{ id: string; lead_id: string; position: number; category: string }> } }`. `GET` → `{ data: DmSessionWithItems | null }` (active session for the workspace, or `null`).

- [ ] **Step 1: Write the failing test**

```ts
// src/app/api/dm-sessions/__tests__/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/get-workspace', () => ({
  getWorkspaceId: vi.fn().mockResolvedValue({ workspaceId: 'ws-1', userId: 'user-1', role: 'setter' }),
}))
vi.mock('@/lib/dm-sessions/priority', () => ({
  buildPriorityQueue: vi.fn().mockResolvedValue([
    { lead_id: 'lead-1', category: 'relance_en_retard' },
    { lead_id: 'lead-2', category: 'jamais_recontacte' },
  ]),
}))

const insertSession = vi.fn()
const insertItems = vi.fn()
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    from: (table: string) => {
      if (table === 'dm_sessions') {
        return {
          insert: insertSession.mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { id: 'session-1', status: 'active' }, error: null }),
        }
      }
      if (table === 'dm_session_items') {
        return {
          insert: insertItems.mockReturnValue({
            select: vi.fn().mockResolvedValue({
              data: [
                { id: 'item-1', lead_id: 'lead-1', position: 0, category: 'relance_en_retard' },
                { id: 'item-2', lead_id: 'lead-2', position: 1, category: 'jamais_recontacte' },
              ],
              error: null,
            }),
          }),
        }
      }
      throw new Error(`unexpected table ${table}`)
    },
  }),
}))

import { POST } from '../route'

describe('POST /api/dm-sessions', () => {
  beforeEach(() => {
    insertSession.mockClear()
    insertItems.mockClear()
  })

  it('creates a session truncated to target_count and returns ordered items', async () => {
    const req = new Request('http://localhost/api/dm-sessions', {
      method: 'POST',
      body: JSON.stringify({ target_count: 1 }),
    })
    const res = await POST(req as never)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.items).toHaveLength(1)
    expect(body.data.items[0].lead_id).toBe('lead-1')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/dm-sessions/__tests__/route.test.ts`
Expected: FAIL — `Cannot find module '../route'`

- [ ] **Step 3: Write minimal implementation**

```ts
// src/app/api/dm-sessions/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { createDmSessionSchema } from '@/lib/validations/dm-sessions'
import { buildPriorityQueue } from '@/lib/dm-sessions/priority'

export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const body = await request.json()
    const parsed = createDmSessionSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const queue = await buildPriorityQueue(supabase, workspaceId, parsed.data.stale_threshold_days)
    const truncated = queue.slice(0, parsed.data.target_count)

    const { data: session, error: sessionError } = await supabase
      .from('dm_sessions')
      .insert({
        workspace_id: workspaceId,
        status: 'active',
        target_count: parsed.data.target_count,
        stale_threshold_days: parsed.data.stale_threshold_days,
      })
      .select()
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Impossible de créer la session' }, { status: 500 })
    }

    const { data: items, error: itemsError } = await supabase
      .from('dm_session_items')
      .insert(
        truncated.map((entry, index) => ({
          session_id: session.id,
          lead_id: entry.lead_id,
          position: index,
          category: entry.category,
        }))
      )
      .select()

    if (itemsError) {
      return NextResponse.json({ error: 'Impossible de créer la file de leads' }, { status: 500 })
    }

    return NextResponse.json({ data: { ...session, items: items ?? [] } })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const { data: session } = await supabase
      .from('dm_sessions')
      .select('*, items:dm_session_items(*)')
      .eq('workspace_id', workspaceId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    return NextResponse.json({ data: session ?? null })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/api/dm-sessions/__tests__/route.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/dm-sessions/route.ts src/app/api/dm-sessions/__tests__/route.test.ts
git commit -m "feat: add POST/GET /api/dm-sessions"
```

---

### Task 6: `GET /api/dm-sessions/[id]` and `PATCH /api/dm-sessions/[id]/items/[itemId]`

**Files:**
- Create: `src/app/api/dm-sessions/[id]/route.ts`
- Create: `src/app/api/dm-sessions/[id]/items/[itemId]/route.ts`
- Test: `src/app/api/dm-sessions/[id]/items/[itemId]/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `updateDmSessionItemSchema` (Task 4). For `outcome: 'relaunched'` with `delay_days` set, calls the existing follow-ups creation logic — implementer should call the same Supabase insert `create-followup.ts` uses (`{ lead_id, reason: 'Relance session DM', scheduled_at: <now + delay_days>, channel: 'instagram_dm', status: 'en_attente' }`) directly via `supabase.from('follow_ups').insert(...)`, not by re-deriving `create-followup.ts`'s workflow-action wrapper (that wrapper expects an `ExecutionContext` from the automation engine, which does not exist in this HTTP request path). For `outcome: 'archived'`, calls `PATCH /api/leads/[id]` semantics directly via `supabase.from('leads').update({ status: 'dead' }).eq('id', lead_id)` (same effect, called in-process rather than via HTTP self-call).
- Produces: `PATCH .../items/[itemId]` → `{ data: { id, outcome, note, updated_at } }`.

- [ ] **Step 1: Write the failing test**

```ts
// src/app/api/dm-sessions/[id]/items/[itemId]/__tests__/route.test.ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/supabase/get-workspace', () => ({
  getWorkspaceId: vi.fn().mockResolvedValue({ workspaceId: 'ws-1', userId: 'user-1', role: 'setter' }),
}))

const updateItem = vi.fn().mockReturnValue({
  eq: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({
    data: { id: 'item-1', outcome: 'archived', note: null, updated_at: '2026-08-27T00:00:00Z' },
    error: null,
  }),
})
const updateLead = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
const getItem = vi.fn().mockResolvedValue({ data: { lead_id: 'lead-1' }, error: null })

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    from: (table: string) => {
      if (table === 'dm_session_items') {
        return {
          update: updateItem,
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: getItem,
        }
      }
      if (table === 'leads') {
        return { update: updateLead }
      }
      throw new Error(`unexpected table ${table}`)
    },
  }),
}))

import { PATCH } from '../route'

describe('PATCH /api/dm-sessions/[id]/items/[itemId]', () => {
  it('archives the lead when outcome is archived', async () => {
    const req = new Request('http://localhost', {
      method: 'PATCH',
      body: JSON.stringify({ outcome: 'archived' }),
    })
    const res = await PATCH(req as never, { params: Promise.resolve({ id: 'session-1', itemId: 'item-1' }) })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.outcome).toBe('archived')
    expect(updateLead).toHaveBeenCalledWith({ status: 'dead' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run "src/app/api/dm-sessions/[id]/items/[itemId]/__tests__/route.test.ts"`
Expected: FAIL — `Cannot find module '../route'`

- [ ] **Step 3: Write minimal implementation**

```ts
// src/app/api/dm-sessions/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const { data: session, error } = await supabase
      .from('dm_sessions')
      .select('*, items:dm_session_items(*, lead:leads(id, first_name, last_name, instagram_handle, instagram_user_id, status, last_activity_at))')
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .single()

    if (error || !session) {
      return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })
    }

    return NextResponse.json({ data: session })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
```

```ts
// src/app/api/dm-sessions/[id]/items/[itemId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { updateDmSessionItemSchema } from '@/lib/validations/dm-sessions'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { itemId } = await params
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const body = await request.json()
    const parsed = updateDmSessionItemSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { data: item } = await supabase
      .from('dm_session_items')
      .select('lead_id')
      .eq('id', itemId)
      .single()

    if (!item) {
      return NextResponse.json({ error: 'Profil introuvable dans la session' }, { status: 404 })
    }

    if (parsed.data.outcome === 'archived') {
      await supabase.from('leads').update({ status: 'dead' }).eq('id', item.lead_id)
    }

    if (parsed.data.outcome === 'relaunched' && parsed.data.delay_days) {
      const scheduledAt = new Date(Date.now() + parsed.data.delay_days * 86_400_000).toISOString()
      await supabase.from('follow_ups').insert({
        workspace_id: workspaceId,
        lead_id: item.lead_id,
        reason: 'Relance — session DM',
        scheduled_at: scheduledAt,
        channel: 'instagram_dm',
        status: 'en_attente',
        notes: parsed.data.note ?? '',
      })
    }

    const { data: updated, error } = await supabase
      .from('dm_session_items')
      .update({ outcome: parsed.data.outcome, note: parsed.data.note ?? null, updated_at: new Date().toISOString() })
      .eq('id', itemId)
      .select()
      .single()

    if (error || !updated) {
      return NextResponse.json({ error: 'Impossible de mettre à jour le profil' }, { status: 500 })
    }

    return NextResponse.json({ data: updated })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run "src/app/api/dm-sessions/[id]/items/[itemId]/__tests__/route.test.ts"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/dm-sessions/
git commit -m "feat: add GET session detail and PATCH item outcome routes"
```

---

### Task 7: Extend `/api/leads/[id]/journey` with Instagram engagement events

**Files:**
- Modify: `src/app/api/leads/[id]/journey/route.ts`
- Test: `src/app/api/leads/[id]/journey/__tests__/route.test.ts` (create if it doesn't already exist — check first with `find src/app/api/leads/[id]/journey -name "*.test.ts"`)

**Interfaces:**
- Produces: the existing `JourneyEvent[]` array now also contains rows shaped `{ id, event_type: 'instagram_like' | 'instagram_comment', metadata: { source_post_url, snippet }, funnel_page_id: null, funnel_page_name: null, created_at }` sourced from `instagram_interactions`. Consumed by the mobile `LeadJourneyBlock` (Task 10) — no shape change needed there, it already renders unknown `event_type` values via `EVENT_LABEL` fallback, but Task 10 must add explicit labels for these two new types.

- [ ] **Step 1: Read the current route to confirm the exact insertion point**

Run: `sed -n '40,100p' "src/app/api/leads/[id]/journey/route.ts"`
Expected: locate the query that builds `events` (currently from `funnel_events` or similar) — the new query is appended as a sibling fetch, merged and re-sorted by `created_at` before the response is built.

- [ ] **Step 2: Write the failing test**

```ts
// src/app/api/leads/[id]/journey/__tests__/route.test.ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/supabase/get-workspace', () => ({
  getWorkspaceId: vi.fn().mockResolvedValue({ workspaceId: 'ws-1', userId: 'user-1', role: 'setter' }),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    from: (table: string) => {
      if (table === 'instagram_interactions') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: [
              {
                id: 'ig-1',
                interaction_type: 'like',
                source_post_url: 'https://instagram.com/reel/xyz',
                last_seen_at: '2026-06-21T00:00:00Z',
                metadata: { snippet: 'Tu as un problème de confiance.' },
              },
            ],
            error: null,
          }),
        }
      }
      // other tables (leads, funnel events, bookings) stubbed to empty —
      // this test only asserts the instagram_interactions merge.
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
        single: vi.fn().mockResolvedValue({ data: {}, error: null }),
      }
    },
  }),
}))

import { GET } from '../route'

describe('GET /api/leads/[id]/journey', () => {
  it('includes instagram_like events sourced from instagram_interactions', async () => {
    const res = await GET(new Request('http://localhost') as never, {
      params: Promise.resolve({ id: 'lead-1' }),
    })
    const body = await res.json()

    const igEvent = body.data.events.find((e: { event_type: string }) => e.event_type === 'instagram_like')
    expect(igEvent).toBeDefined()
    expect(igEvent.metadata.source_post_url).toBe('https://instagram.com/reel/xyz')
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run "src/app/api/leads/[id]/journey/__tests__/route.test.ts"`
Expected: FAIL — no `instagram_like` event in `body.data.events`

- [ ] **Step 4: Implement the merge**

Add to `src/app/api/leads/[id]/journey/route.ts`, inside the `GET` handler, alongside the existing events fetch:

```ts
    const { data: igInteractions } = await supabase
      .from('instagram_interactions')
      .select('id, interaction_type, source_post_url, last_seen_at, metadata')
      .eq('workspace_id', workspaceId)
      .eq('lead_id', id)
      .order('last_seen_at', { ascending: true })

    const igEvents: JourneyEvent[] = (igInteractions ?? []).map((row) => ({
      id: row.id,
      event_type: row.interaction_type === 'comment' ? 'instagram_comment' : 'instagram_like',
      metadata: { source_post_url: row.source_post_url, ...(row.metadata as object ?? {}) },
      funnel_page_id: null,
      funnel_page_name: null,
      created_at: row.last_seen_at,
    }))
```

Then merge `igEvents` into the existing `events` array before sorting by `created_at` (locate the existing sort/assembly from Step 1 and extend it — the exact variable name depends on what Step 1 found, confirm before editing).

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run "src/app/api/leads/[id]/journey/__tests__/route.test.ts"`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/api/leads/\[id\]/journey/route.ts src/app/api/leads/\[id\]/journey/__tests__/route.test.ts
git commit -m "feat: merge instagram engagement events into lead journey"
```

---

### Task 8: Mobile navigation — `DmSessionStack` and entry point in `FollowUpsScreen`

**Files:**
- Modify: `mobile/src/navigation/types.ts`
- Create: `mobile/src/navigation/stacks/DmSessionStack.tsx`
- Modify: `mobile/src/app/follow-ups/FollowUpsScreen.tsx`

**Interfaces:**
- Produces: `DmSessionStackParamList = { DmSessionConfig: undefined; DmSessionLead: { sessionId: string }; DmSessionComplete: { sessionId: string } }`, exported from `mobile/src/navigation/types.ts` and added under `FollowUpsStackParamList` (pushed from within the Relances tab, matching how `AgendaStackParamList` nests `CallDetail`/`LeadDetail` — same pattern, no new root tab).

- [ ] **Step 1: Add the param list**

Edit `mobile/src/navigation/types.ts`:

```ts
export type FollowUpsStackParamList = {
  FollowUpsList: undefined
  LeadDetail: { leadId: string }
  DmSessionConfig: undefined
  DmSessionLead: { sessionId: string }
  DmSessionComplete: { sessionId: string }
}
```

- [ ] **Step 2: Verify TypeScript compiles with the new type (screens don't exist yet, so this checks only the type edit)**

Run: `cd mobile && npx tsc --noEmit -p . 2>&1 | grep -i "types.ts" || echo "no errors in types.ts"`
Expected: `no errors in types.ts` (errors referencing not-yet-created screens in `FollowUpsStack.tsx` are expected and fixed in Task 9)

- [ ] **Step 3: Add the entry card to `FollowUpsScreen.tsx`**

Insert after the `NavLarge` header (found at the top of the returned JSX in `FollowUpsScreen.tsx`, same position as the `dm-session-cta` block in the approved mockup):

```tsx
import { useDmSessionEntry } from '../../hooks/useDmSession'
// ... inside FollowUpsScreen component, after existing hooks:
const { eligibleCount, activeSession } = useDmSessionEntry()

// ... in JSX, right after <NavLarge .../>:
<Pressable
  onPress={() =>
    navigation.navigate(activeSession ? 'DmSessionLead' : 'DmSessionConfig', activeSession ? { sessionId: activeSession.id } : undefined)
  }
  style={{
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.bgSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  }}
>
  <Text style={{ ...t.subheadline, color: colors.textPrimary, fontWeight: '700' }}>
    {activeSession ? `Reprendre la session (${activeSession.doneCount}/${activeSession.targetCount})` : 'Lancer une session DM'}
  </Text>
  {!activeSession && (
    <Text style={{ ...t.footnote, color: colors.textSecondary, marginTop: 4 }}>
      {eligibleCount} profils à traiter
    </Text>
  )}
</Pressable>
```

(This references `useDmSessionEntry`, written in Task 9 — do not attempt to run the app until Task 9 is complete.)

- [ ] **Step 4: Commit**

```bash
git add mobile/src/navigation/types.ts mobile/src/app/follow-ups/FollowUpsScreen.tsx
git commit -m "feat(mobile): add DmSession navigation types and entry card"
```

---

### Task 9: `useDmSession` hook (mobile data layer)

**Files:**
- Create: `mobile/src/hooks/useDmSession.ts`
- Test: `mobile/src/hooks/__tests__/useDmSession.test.ts`

**Interfaces:**
- Consumes: `api` from `mobile/src/services/api.ts` (`api.get`, `api.post`, `api.patch`).
- Produces:
  ```ts
  export function useDmSessionEntry(): { eligibleCount: number; activeSession: { id: string; doneCount: number; targetCount: number } | null; loading: boolean }
  export function useDmSession(sessionId: string | null): {
    session: DmSessionDetail | null
    currentItem: DmSessionItem | null
    loading: boolean
    submitOutcome: (itemId: string, outcome: 'relaunched' | 'archived' | 'skipped', opts?: { note?: string; delayDays?: number }) => Promise<void>
  }
  export function useStartDmSession(): (config: { targetCount: number; staleThresholdDays: number }) => Promise<{ id: string }>
  ```
  Consumed by `FollowUpsScreen.tsx` (Task 8), `DmSessionConfigScreen.tsx`, `DmSessionLeadScreen.tsx` (Task 11).

- [ ] **Step 1: Write the failing test**

```ts
// mobile/src/hooks/__tests__/useDmSession.test.ts
import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react-native'

const getMock = vi.fn()
const postMock = vi.fn()
const patchMock = vi.fn()
vi.mock('../../services/api', () => ({ api: { get: getMock, post: postMock, patch: patchMock } }))

import { useDmSessionEntry, useDmSession } from '../useDmSession'

describe('useDmSessionEntry', () => {
  it('returns eligibleCount and null activeSession when no session is active', async () => {
    getMock.mockResolvedValueOnce({ data: null })
    const { result } = renderHook(() => useDmSessionEntry())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.activeSession).toBeNull()
  })
})

describe('useDmSession', () => {
  it('exposes the current (first unresolved) item and lets outcome be submitted', async () => {
    getMock.mockResolvedValueOnce({
      data: {
        id: 'session-1',
        items: [
          { id: 'item-1', lead_id: 'lead-1', position: 0, outcome: null },
          { id: 'item-2', lead_id: 'lead-2', position: 1, outcome: null },
        ],
      },
    })
    patchMock.mockResolvedValueOnce({ data: { id: 'item-1', outcome: 'relaunched' } })

    const { result } = renderHook(() => useDmSession('session-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.currentItem?.id).toBe('item-1')

    await act(async () => {
      await result.current.submitOutcome('item-1', 'relaunched', { delayDays: 7 })
    })
    expect(patchMock).toHaveBeenCalledWith(
      '/api/dm-sessions/session-1/items/item-1',
      { outcome: 'relaunched', delay_days: 7 }
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd mobile && npx vitest run src/hooks/__tests__/useDmSession.test.ts`
Expected: FAIL — `Cannot find module '../useDmSession'`

- [ ] **Step 3: Write minimal implementation**

```ts
// mobile/src/hooks/useDmSession.ts
import { useCallback, useEffect, useState } from 'react'
import { api } from '../services/api'

export interface DmSessionItem {
  id: string
  lead_id: string
  position: number
  category: string
  outcome: 'relaunched' | 'archived' | 'skipped' | null
  note: string | null
}

export interface DmSessionDetail {
  id: string
  status: 'active' | 'completed' | 'abandoned'
  target_count: number
  items: DmSessionItem[]
}

export function useDmSessionEntry() {
  const [eligibleCount, setEligibleCount] = useState(0)
  const [activeSession, setActiveSession] = useState<{ id: string; doneCount: number; targetCount: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    api.get<{ data: DmSessionDetail | null }>('/api/dm-sessions').then(({ data }) => {
      if (cancelled) return
      if (data) {
        setActiveSession({
          id: data.id,
          doneCount: data.items.filter((i) => i.outcome !== null).length,
          targetCount: data.target_count,
        })
      } else {
        setActiveSession(null)
      }
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return { eligibleCount, activeSession, loading }
}

export function useStartDmSession() {
  return useCallback(async (config: { targetCount: number; staleThresholdDays: number }) => {
    const { data } = await api.post<{ data: { id: string } }>('/api/dm-sessions', {
      target_count: config.targetCount,
      stale_threshold_days: config.staleThresholdDays,
    })
    return data
  }, [])
}

export function useDmSession(sessionId: string | null) {
  const [session, setSession] = useState<DmSessionDetail | null>(null)
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    if (!sessionId) return
    const { data } = await api.get<{ data: DmSessionDetail }>(`/api/dm-sessions/${sessionId}`)
    setSession(data)
    setLoading(false)
  }, [sessionId])

  useEffect(() => {
    refetch()
  }, [refetch])

  const currentItem = session?.items.find((i) => i.outcome === null) ?? null

  const submitOutcome = useCallback(
    async (itemId: string, outcome: 'relaunched' | 'archived' | 'skipped', opts?: { note?: string; delayDays?: number }) => {
      await api.patch(`/api/dm-sessions/${sessionId}/items/${itemId}`, {
        outcome,
        ...(opts?.note ? { note: opts.note } : {}),
        ...(opts?.delayDays ? { delay_days: opts.delayDays } : {}),
      })
      await refetch()
    },
    [sessionId, refetch]
  )

  return { session, currentItem, loading, submitOutcome }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd mobile && npx vitest run src/hooks/__tests__/useDmSession.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add mobile/src/hooks/useDmSession.ts mobile/src/hooks/__tests__/useDmSession.test.ts
git commit -m "feat(mobile): add useDmSession data hook"
```

---

### Task 10: `DmSessionConfigScreen`

**Files:**
- Create: `mobile/src/app/dm-session/DmSessionConfigScreen.tsx`

**Interfaces:**
- Consumes: `useStartDmSession` (Task 9), `NavLarge` and theme tokens (`colors`, `type as t`, `spacing`, `radius` — same imports as `FollowUpsScreen.tsx`).
- Produces: on submit, navigates to `DmSessionLead` with the new `sessionId`.

- [ ] **Step 1: Write the screen**

```tsx
// mobile/src/app/dm-session/DmSessionConfigScreen.tsx
import React, { useState } from 'react'
import { View, Text, Pressable, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { FollowUpsStackParamList } from '../../navigation/types'
import { useStartDmSession } from '../../hooks/useDmSession'
import { NavLarge } from '../../components/ui'
import { colors } from '../../theme/colors'
import { type as t, spacing, radius } from '../../theme/tokens'

type Nav = NativeStackNavigationProp<FollowUpsStackParamList, 'DmSessionConfig'>

const COUNT_OPTIONS = [10, 20, 30, 45]
const THRESHOLD_OPTIONS = [14, 30, 60, 90]

export function DmSessionConfigScreen() {
  const navigation = useNavigation<Nav>()
  const startSession = useStartDmSession()
  const [targetCount, setTargetCount] = useState(30)
  const [staleThresholdDays, setStaleThresholdDays] = useState(30)
  const [starting, setStarting] = useState(false)

  async function handleStart() {
    setStarting(true)
    try {
      const { id } = await startSession({ targetCount, staleThresholdDays })
      navigation.replace('DmSessionLead', { sessionId: id })
    } finally {
      setStarting(false)
    }
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
      <NavLarge title="Nouvelle session" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        <View>
          <Text style={{ ...t.footnote, color: colors.textSecondary, marginBottom: spacing.sm }}>
            Nombre de profils
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {COUNT_OPTIONS.map((count) => (
              <Pressable
                key={count}
                onPress={() => setTargetCount(count)}
                style={{
                  flex: 1,
                  paddingVertical: spacing.sm,
                  borderRadius: radius.md,
                  alignItems: 'center',
                  backgroundColor: targetCount === count ? colors.primary : colors.bgSecondary,
                  borderWidth: 1,
                  borderColor: targetCount === count ? colors.primary : colors.border,
                }}
              >
                <Text style={{ ...t.subheadline, color: colors.textPrimary, fontWeight: '700' }}>{count}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View>
          <Text style={{ ...t.footnote, color: colors.textSecondary, marginBottom: spacing.sm }}>
            Seuil "ancien lead"
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {THRESHOLD_OPTIONS.map((days) => (
              <Pressable
                key={days}
                onPress={() => setStaleThresholdDays(days)}
                style={{
                  flex: 1,
                  paddingVertical: spacing.sm,
                  borderRadius: radius.md,
                  alignItems: 'center',
                  backgroundColor: staleThresholdDays === days ? colors.primary : colors.bgSecondary,
                  borderWidth: 1,
                  borderColor: staleThresholdDays === days ? colors.primary : colors.border,
                }}
              >
                <Text style={{ ...t.subheadline, color: colors.textPrimary, fontWeight: '700' }}>{days}j</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Pressable
          onPress={handleStart}
          disabled={starting}
          style={{
            backgroundColor: colors.primary,
            borderRadius: radius.lg,
            paddingVertical: spacing.md,
            alignItems: 'center',
            opacity: starting ? 0.6 : 1,
          }}
        >
          <Text style={{ ...t.subheadline, color: '#fff', fontWeight: '700' }}>
            {starting ? 'Démarrage…' : 'Démarrer la session'}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  )
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `cd mobile && npx tsc --noEmit -p . 2>&1 | grep -i "DmSessionConfigScreen" || echo "no errors"`
Expected: `no errors` (aside from the not-yet-registered route in the stack navigator, addressed in Task 12)

- [ ] **Step 3: Commit**

```bash
git add mobile/src/app/dm-session/DmSessionConfigScreen.tsx
git commit -m "feat(mobile): add DmSessionConfigScreen"
```

---

### Task 11: `DmSessionLeadScreen` and `DmSessionCompleteScreen`

**Files:**
- Create: `mobile/src/app/dm-session/DmSessionLeadScreen.tsx`
- Create: `mobile/src/app/dm-session/DmSessionCompleteScreen.tsx`
- Modify: `mobile/src/components/leads/LeadJourneyBlock.tsx` — add `instagram_like`/`instagram_comment` to whatever label/icon map it already keys off `event_type` (confirm the exact map name by reading the file before editing; do not duplicate the map, extend it in place).

**Interfaces:**
- Consumes: `useDmSession` (Task 9), `pickTemplate` — but note `pickTemplate` (Task 3) is a **server-side** module (`src/lib/dm-sessions/templates.ts`), not importable from the mobile bundle. The rendered `label`/`text` must instead come back on the session item from the API. **Correction to Task 6:** `GET /api/dm-sessions/[id]` must include `template: { label: string; text: string }` per item, computed server-side via `pickTemplate` + `daysSinceLastContact` derived from `lead.last_activity_at`. Add this before starting Task 11 — extend Task 6's `GET` handler to call `pickTemplate(item.category, { firstName: item.lead.first_name, daysSinceLastContact })` and include the result on each returned item.
- `LeadJourneyBlock` reused as-is via `<LeadJourneyBlock leadId={currentItem.lead_id} />`.
- `Clipboard` from `expo-clipboard` (already a dependency — confirm with `grep expo-clipboard mobile/package.json`; if absent, add it as a step here rather than assuming).

- [ ] **Step 1: Extend Task 6's route to include the template (go back and edit)**

Edit `src/app/api/dm-sessions/[id]/route.ts`, inside the `GET` handler, after fetching `session`:

```ts
import { pickTemplate } from '@/lib/dm-sessions/templates'

// ... after fetching `session`:
const itemsWithTemplate = session.items.map((item: { category: string; lead: { first_name: string; last_activity_at: string | null } }) => {
  const daysSinceLastContact = item.lead.last_activity_at
    ? Math.floor((Date.now() - new Date(item.lead.last_activity_at).getTime()) / 86_400_000)
    : null
  return {
    ...item,
    template: pickTemplate(item.category as never, {
      firstName: item.lead.first_name,
      daysSinceLastContact,
    }),
  }
})

return NextResponse.json({ data: { ...session, items: itemsWithTemplate } })
```

- [ ] **Step 2: Confirm `expo-clipboard` is available**

Run: `grep expo-clipboard mobile/package.json`
Expected: a version line. If absent, run `cd mobile && npx expo install expo-clipboard` before continuing.

- [ ] **Step 3: Write `DmSessionLeadScreen.tsx`**

```tsx
// mobile/src/app/dm-session/DmSessionLeadScreen.tsx
import React, { useState } from 'react'
import { View, Text, ScrollView, Pressable, TextInput, Linking } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import * as Clipboard from 'expo-clipboard'
import type { FollowUpsStackParamList } from '../../navigation/types'
import { useDmSession } from '../../hooks/useDmSession'
import { LeadJourneyBlock } from '../../components/leads/LeadJourneyBlock'
import { useDelaySheet } from '../../components/dm-session/DelaySheetProvider'
import { NavLarge } from '../../components/ui'
import { colors } from '../../theme/colors'
import { type as t, spacing, radius } from '../../theme/tokens'

type Nav = NativeStackNavigationProp<FollowUpsStackParamList, 'DmSessionLead'>
type R = RouteProp<FollowUpsStackParamList, 'DmSessionLead'>

export function DmSessionLeadScreen() {
  const navigation = useNavigation<Nav>()
  const { params } = useRoute<R>()
  const { session, currentItem, loading, submitOutcome } = useDmSession(params.sessionId)
  const delaySheet = useDelaySheet()
  const [note, setNote] = useState('')

  if (loading || !session) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
        <NavLarge title="Session DM" />
      </SafeAreaView>
    )
  }

  if (!currentItem) {
    navigation.replace('DmSessionComplete', { sessionId: session.id })
    return null
  }

  const doneCount = session.items.filter((i) => i.outcome !== null).length
  const position = session.items.findIndex((i) => i.id === currentItem.id) + 1

  async function handleRelaunched() {
    delaySheet.open({
      onConfirm: async (delayDays: number) => {
        await submitOutcome(currentItem.id, 'relaunched', { delayDays, note: note || undefined })
        setNote('')
      },
    })
  }

  async function handleArchived() {
    await submitOutcome(currentItem.id, 'archived', { note: note || undefined })
    setNote('')
  }

  async function handleSkip() {
    await submitOutcome(currentItem.id, 'skipped')
    setNote('')
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
      <NavLarge
        title="Session DM"
        subtitle={`Profil ${position} / ${session.items.length} · ${doneCount} traités`}
      />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 140 }}>
        <LeadJourneyBlock leadId={currentItem.lead_id} />

        <View style={{ backgroundColor: colors.bgSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md }}>
          <Text style={{ ...t.footnote, color: colors.textSecondary, marginBottom: spacing.xs }}>
            Template · {(currentItem as unknown as { template: { label: string } }).template.label}
          </Text>
          <Text style={{ ...t.subheadline, color: colors.textPrimary }}>
            {(currentItem as unknown as { template: { text: string } }).template.text}
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
            <Pressable
              onPress={() => Clipboard.setStringAsync((currentItem as unknown as { template: { text: string } }).template.text)}
              style={{ flex: 1, backgroundColor: colors.bgPrimary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingVertical: spacing.sm, alignItems: 'center' }}
            >
              <Text style={{ ...t.footnote, color: colors.textPrimary }}>Copier</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                const handle = (currentItem as unknown as { lead?: { instagram_handle?: string } }).lead?.instagram_handle
                if (!handle) return
                Linking.openURL(`instagram://user?username=${handle}`).catch(() =>
                  Linking.openURL(`https://instagram.com/${handle}`)
                )
              }}
              style={{ flex: 1, backgroundColor: colors.bgPrimary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingVertical: spacing.sm, alignItems: 'center' }}
            >
              <Text style={{ ...t.footnote, color: colors.textPrimary }}>Ouvrir Instagram</Text>
            </Pressable>
          </View>
        </View>

        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Note (optionnel)"
          placeholderTextColor={colors.textSecondary}
          multiline
          style={{
            backgroundColor: colors.bgSecondary,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: colors.border,
            padding: spacing.sm,
            color: colors.textPrimary,
            minHeight: 56,
          }}
        />
      </ScrollView>

      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: spacing.lg, backgroundColor: colors.bgPrimary, borderTopWidth: 1, borderTopColor: colors.border, gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Pressable onPress={handleRelaunched} style={{ flex: 1, backgroundColor: '#38A169', borderRadius: radius.md, paddingVertical: spacing.sm, alignItems: 'center' }}>
            <Text style={{ ...t.footnote, color: '#fff', fontWeight: '700' }}>Relancé</Text>
          </Pressable>
          <Pressable onPress={handleArchived} style={{ flex: 1, backgroundColor: colors.bgSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: spacing.sm, alignItems: 'center' }}>
            <Text style={{ ...t.footnote, color: colors.textPrimary, fontWeight: '700' }}>À archiver</Text>
          </Pressable>
        </View>
        <Pressable onPress={handleSkip} style={{ paddingVertical: spacing.sm, alignItems: 'center' }}>
          <Text style={{ ...t.footnote, color: colors.textSecondary }}>Passer pour l'instant</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}
```

- [ ] **Step 4: Write `DmSessionCompleteScreen.tsx`**

```tsx
// mobile/src/app/dm-session/DmSessionCompleteScreen.tsx
import React from 'react'
import { View, Text, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { FollowUpsStackParamList } from '../../navigation/types'
import { useDmSession } from '../../hooks/useDmSession'
import { NavLarge } from '../../components/ui'
import { colors } from '../../theme/colors'
import { type as t, spacing, radius } from '../../theme/tokens'

type Nav = NativeStackNavigationProp<FollowUpsStackParamList, 'DmSessionComplete'>
type R = RouteProp<FollowUpsStackParamList, 'DmSessionComplete'>

export function DmSessionCompleteScreen() {
  const navigation = useNavigation<Nav>()
  const { params } = useRoute<R>()
  const { session } = useDmSession(params.sessionId)

  const relaunched = session?.items.filter((i) => i.outcome === 'relaunched').length ?? 0
  const archived = session?.items.filter((i) => i.outcome === 'archived').length ?? 0

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgPrimary, alignItems: 'center', justifyContent: 'center', padding: spacing.lg }}>
      <NavLarge title="Session terminée" />
      <Text style={{ ...t.title2, color: colors.textPrimary, marginTop: spacing.lg }}>
        {relaunched + archived} / {session?.items.length ?? 0} profils traités
      </Text>
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
        <View style={{ flex: 1, backgroundColor: colors.bgSecondary, borderRadius: radius.lg, padding: spacing.md, alignItems: 'center' }}>
          <Text style={{ ...t.title2, color: '#38A169', fontWeight: '800' }}>{relaunched}</Text>
          <Text style={{ ...t.footnote, color: colors.textSecondary }}>Relancés</Text>
        </View>
        <View style={{ flex: 1, backgroundColor: colors.bgSecondary, borderRadius: radius.lg, padding: spacing.md, alignItems: 'center' }}>
          <Text style={{ ...t.title2, color: colors.textPrimary, fontWeight: '800' }}>{archived}</Text>
          <Text style={{ ...t.footnote, color: colors.textSecondary }}>Archivés</Text>
        </View>
      </View>
      <Pressable
        onPress={() => navigation.popToTop()}
        style={{ marginTop: spacing.lg, backgroundColor: colors.primary, borderRadius: radius.lg, paddingVertical: spacing.md, paddingHorizontal: spacing.xl }}
      >
        <Text style={{ ...t.subheadline, color: '#fff', fontWeight: '700' }}>Retour aux relances</Text>
      </Pressable>
    </SafeAreaView>
  )
}
```

- [ ] **Step 5: Extend `LeadJourneyBlock`'s event label map**

Run: `grep -n "EVENT_LABEL\|event_type" mobile/src/components/leads/LeadJourneyBlock.tsx`
Expected: locate the label/icon lookup object. Add two keys following the existing pattern exactly (copy the object's existing shape for one entry, e.g. `view`, and mirror it):

```ts
instagram_like: { label: 'A liké un de tes reels', icon: 'heart-outline' },
instagram_comment: { label: 'A commenté un de tes reels', icon: 'chatbubble-outline' },
```

(Exact key name and icon field depend on what Step 5's grep reveals — match the existing object's property names, do not invent new ones.)

- [ ] **Step 6: Commit**

```bash
git add mobile/src/app/dm-session/DmSessionLeadScreen.tsx mobile/src/app/dm-session/DmSessionCompleteScreen.tsx mobile/src/components/leads/LeadJourneyBlock.tsx src/app/api/dm-sessions/\[id\]/route.ts
git commit -m "feat(mobile): add DmSessionLead and DmSessionComplete screens"
```

---

### Task 12: `DelaySheetProvider` (next-relaunch delay picker)

**Files:**
- Create: `mobile/src/components/dm-session/DelaySheetProvider.tsx`
- Modify: wherever `ScheduleSheetProvider` is mounted today (run `grep -rn "ScheduleSheetProvider" mobile/src/App.tsx mobile/src/navigation/` to find the exact mount point before editing — mirror it for `DelaySheetProvider`)

**Interfaces:**
- Produces: `useDelaySheet(): { open: (params: { onConfirm: (delayDays: number) => void | Promise<void> }) => void }`. Consumed by `DmSessionLeadScreen` (Task 11).

- [ ] **Step 1: Find the exact mount point of `ScheduleSheetProvider`**

Run: `grep -rn "ScheduleSheetProvider" mobile/src/`
Expected: one import + one JSX usage wrapping the app tree — note the file and note whether other sheet providers are already siblings there (compose alongside them, don't nest redundantly).

- [ ] **Step 2: Write `DelaySheetProvider.tsx`, mirroring `ScheduleSheetProvider`'s structure**

```tsx
// mobile/src/components/dm-session/DelaySheetProvider.tsx
import React, { createContext, useCallback, useContext, useRef, useState } from 'react'
import { View, Text, Pressable } from 'react-native'
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet'
import { colors } from '../../theme/colors'
import { type as t, spacing, radius } from '../../theme/tokens'

interface DelaySheetContextValue {
  open: (params: { onConfirm: (delayDays: number) => void | Promise<void> }) => void
}

const DelaySheetContext = createContext<DelaySheetContextValue | null>(null)

const DELAY_OPTIONS = [2, 3, 7, 14, 30]

export function useDelaySheet(): DelaySheetContextValue {
  const ctx = useContext(DelaySheetContext)
  if (!ctx) {
    if (__DEV__) console.warn('useDelaySheet called outside DelaySheetProvider')
    return { open: () => {} }
  }
  return ctx
}

export function DelaySheetProvider({ children }: { children: React.ReactNode }) {
  const sheetRef = useRef<BottomSheet>(null)
  const [onConfirm, setOnConfirm] = useState<((delayDays: number) => void | Promise<void>) | null>(null)

  const open = useCallback((params: { onConfirm: (delayDays: number) => void | Promise<void> }) => {
    setOnConfirm(() => params.onConfirm)
    sheetRef.current?.expand()
  }, [])

  async function handleSelect(days: number) {
    sheetRef.current?.close()
    await onConfirm?.(days)
  }

  return (
    <DelaySheetContext.Provider value={{ open }}>
      {children}
      <BottomSheet ref={sheetRef} index={-1} snapPoints={['40%']} enableDynamicSizing={false} enablePanDownToClose backgroundStyle={{ backgroundColor: colors.bgSecondary }}>
        <BottomSheetView style={{ padding: spacing.lg, gap: spacing.md }}>
          <Text style={{ ...t.subheadline, color: colors.textPrimary, fontWeight: '700' }}>Prochaine relance</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {DELAY_OPTIONS.map((days) => (
              <Pressable
                key={days}
                onPress={() => handleSelect(days)}
                style={{ paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.bgPrimary, borderWidth: 1, borderColor: colors.border }}
              >
                <Text style={{ ...t.footnote, color: colors.textPrimary, fontWeight: '700' }}>{days}j</Text>
              </Pressable>
            ))}
          </View>
        </BottomSheetView>
      </BottomSheet>
    </DelaySheetContext.Provider>
  )
}
```

- [ ] **Step 3: Mount `DelaySheetProvider` at the same tree location found in Step 1**

Edit the file found in Step 1, adding `DelaySheetProvider` as a sibling wrap alongside `ScheduleSheetProvider` (exact edit depends on that file's structure — wrap consistently with how the existing provider is composed, do not reorder unrelated providers).

- [ ] **Step 4: Commit**

```bash
git add mobile/src/components/dm-session/DelaySheetProvider.tsx
git commit -m "feat(mobile): add DelaySheetProvider for next-relaunch scheduling"
```

---

### Task 13: Wire the three screens into the navigator

**Files:**
- Modify: `mobile/src/navigation/stacks/FollowUpsStack.tsx`

**Interfaces:**
- Consumes: `DmSessionConfigScreen`, `DmSessionLeadScreen`, `DmSessionCompleteScreen` (Tasks 10, 11).

- [ ] **Step 1: Read the current stack to confirm its exact shape**

Run: `cat mobile/src/navigation/stacks/FollowUpsStack.tsx`
Expected: a `createNativeStackNavigator<FollowUpsStackParamList>()` with `FollowUpsList` and `LeadDetail` screens registered.

- [ ] **Step 2: Add the three new `Stack.Screen` entries**

```tsx
import { DmSessionConfigScreen } from '../../app/dm-session/DmSessionConfigScreen'
import { DmSessionLeadScreen } from '../../app/dm-session/DmSessionLeadScreen'
import { DmSessionCompleteScreen } from '../../app/dm-session/DmSessionCompleteScreen'

// ... inside the Stack.Navigator, alongside existing Stack.Screen entries:
<Stack.Screen name="DmSessionConfig" component={DmSessionConfigScreen} />
<Stack.Screen name="DmSessionLead" component={DmSessionLeadScreen} options={{ gestureEnabled: false }} />
<Stack.Screen name="DmSessionComplete" component={DmSessionCompleteScreen} options={{ gestureEnabled: false }} />
```

- [ ] **Step 3: Run the mobile TypeScript check**

Run: `cd mobile && npx tsc --noEmit -p .`
Expected: no errors referencing `FollowUpsStack.tsx`, `DmSessionConfigScreen`, `DmSessionLeadScreen`, or `DmSessionCompleteScreen`.

- [ ] **Step 4: Manual smoke test**

Run: `cd mobile && npx expo start` (or the project's existing dev-server command — confirm with `cat mobile/package.json | grep '"start"'` if different), open the Relances tab, tap "Lancer une session DM", pick 10 profils, confirm the first lead's screen renders with a template and the timeline loads without crashing.
Expected: config screen → lead screen → (after processing all items) completion screen, no red-screen errors.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/navigation/stacks/FollowUpsStack.tsx
git commit -m "feat(mobile): wire DmSession screens into FollowUpsStack"
```

---

## Self-Review Notes

- **Spec coverage:** entry point (Task 8), config/priority (Tasks 2, 5, 10), lead screen with timeline+template+actions (Tasks 6, 7, 11), delay picker (Task 12), completion screen without response-rate (Task 11), archive→`dead` (Task 6), persistence (Task 1) — all covered. Mobile-only scope constraint respected: no web UI task exists in this plan.
- **Fixed during self-review:** Task 11 originally assumed `pickTemplate` (a `src/lib/...` server module) could be imported directly into the mobile bundle — corrected by having Task 6's route return the rendered template per item instead, and added that correction as Task 11 Step 1 rather than silently editing Task 6 above (keeping task history honest about when the decision was made).
- **Type consistency check:** `DmSessionItem.outcome` (Task 9) matches `updateDmSessionItemSchema`'s `outcome` enum (Task 4) and the `dm_session_items.outcome` check constraint (Task 1) — all three list exactly `relaunched | archived | skipped`. `PriorityCategory` (Task 2) matches `dm_session_items.category` check constraint (Task 1) exactly.

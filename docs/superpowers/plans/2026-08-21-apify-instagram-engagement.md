# Apify Instagram Engagement Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Track Instagram post/reel likers via the external Apify service (no scraping inside ClosRM), match them against leads, log interaction events, and surface a "hot leads to contact" queue for setters.

**Architecture:** ClosRM calls Apify's official REST API to run a scrape job on a set of watched Instagram post URLs, on a pg_cron schedule. Results are fetched via polling and normalized into a new `instagram_interactions` table, deduped against `leads` by `instagram_handle`. The lead timeline (`LeadJourneyBlock`) and a new "leads chauds" page surface this data. No Instagram login/session/cookie ever touches ClosRM code.

**Tech Stack:** Next.js 14 App Router, Supabase (Postgres + pg_cron + pg_net), TypeScript (no `any` outside existing `identity.ts` pattern), Zod validation, existing `@/lib/crypto` for token encryption.

**Spec:** `docs/superpowers/specs/2026-08-21-instagram-engagement-tracking-design.md` (section 1 only — sections 2/3 covered by separate plans)

## Global Constraints

- No Instagram scraping, login, session, or cookie handling inside ClosRM — all collection happens via Apify's official API.
- Reuse `@/lib/crypto` (`encrypt`/`decrypt`, `aes-256-gcm`, `iv:authTag:ciphertext` hex format) for the Apify API token — **not** `@/lib/meta/encryption` (that module is Meta-webhook-specific).
- All new DB tables get `workspace_id` + RLS policies matching the existing `integrations` table pattern — as of migration `024_rls_workspace_members.sql`, this is `workspace_id in (select user_workspace_ids())` (NOT the older `owner_id = auth.uid()` form; `024` replaced that form everywhere to support non-owner workspace members).
- All Supabase queries in API routes filter by `workspaceId` explicitly (service-role client bypasses RLS).
- Migration files are numbered sequentially starting at `090` (latest existing is `089_add_pas_qualifie_status.sql`).
- Cron routes authenticate via `Authorization: Bearer ${process.env.CRON_SECRET}`, matching `src/app/api/cron/booking-reminders/route.ts`.
- No new npm dependencies — Apify's REST API is called via plain `fetch`.

---

### Task 1: Migration — `apify_watched_posts` table

**Files:**
- Create: `supabase/migrations/090_apify_watched_posts.sql`

**Interfaces:**
- Produces: table `apify_watched_posts(id, workspace_id, instagram_post_url, instagram_post_code, label, is_active, last_checked_at, last_run_id, likers_count, created_at, updated_at)`

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/migrations/090_apify_watched_posts.sql
-- Table des posts/reels Instagram surveillés pour le tracking d'engagement via Apify.
-- ClosRM ne scrape jamais Instagram lui-même : cette table stocke uniquement les URLs
-- à surveiller, le scraping réel est délégué à l'API Apify (voir 091_apify_runs.sql).

create table apify_watched_posts (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  instagram_post_url text not null,
  instagram_post_code text,
  label text,
  is_active boolean not null default true,
  last_checked_at timestamptz,
  last_run_id text,
  likers_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_apify_watched_posts_workspace on apify_watched_posts(workspace_id);
create index idx_apify_watched_posts_active on apify_watched_posts(workspace_id, is_active) where is_active = true;

alter table apify_watched_posts enable row level security;

create policy "Workspace apify_watched_posts" on apify_watched_posts
  for all using (
    workspace_id in (select user_workspace_ids())
  );
```

- [ ] **Step 2: Apply the migration locally**

Run: `cd /Users/pierrerebmann/closrm-lead-journey && supabase db push`
Expected: migration `090_apify_watched_posts.sql` applies with no errors.

- [ ] **Step 3: Verify the table exists**

Run: `supabase db execute --sql "select column_name, data_type from information_schema.columns where table_name = 'apify_watched_posts' order by ordinal_position;"`
Expected: 10 rows listing all columns from the `create table` statement above.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/090_apify_watched_posts.sql
git commit -m "feat(db): add apify_watched_posts table for Instagram post tracking"
```

---

### Task 2: Migration — `apify_runs` table

**Files:**
- Create: `supabase/migrations/091_apify_runs.sql`

**Interfaces:**
- Consumes: `apify_watched_posts(id)` (Task 1)
- Produces: table `apify_runs(id, workspace_id, watched_post_id, apify_run_id, apify_dataset_id, status, items_processed, started_at, finished_at)`

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/migrations/091_apify_runs.sql
-- Trace chaque run Apify lancé pour un post surveillé : permet l'idempotence
-- (un run_id Apify ne peut être traité qu'une fois) et le suivi de statut.

create table apify_runs (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  watched_post_id uuid references apify_watched_posts(id) on delete cascade,
  apify_run_id text not null unique,
  apify_dataset_id text,
  status text not null default 'pending' check (status in ('pending', 'running', 'succeeded', 'failed')),
  items_processed int not null default 0,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index idx_apify_runs_workspace on apify_runs(workspace_id);
create index idx_apify_runs_status on apify_runs(status) where status in ('pending', 'running');

alter table apify_runs enable row level security;

create policy "Workspace apify_runs" on apify_runs
  for all using (
    workspace_id in (select user_workspace_ids())
  );
```

- [ ] **Step 2: Apply the migration**

Run: `supabase db push`
Expected: no errors.

- [ ] **Step 3: Verify the unique constraint on `apify_run_id`**

Run: `supabase db execute --sql "insert into apify_runs (workspace_id, apify_run_id) select id, 'test-run-1' from workspaces limit 1; insert into apify_runs (workspace_id, apify_run_id) select id, 'test-run-1' from workspaces limit 1;"`
Expected: second insert fails with `duplicate key value violates unique constraint "apify_runs_apify_run_id_key"`.

- [ ] **Step 4: Clean up the test row**

Run: `supabase db execute --sql "delete from apify_runs where apify_run_id = 'test-run-1';"`

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/091_apify_runs.sql
git commit -m "feat(db): add apify_runs table for run tracking and idempotency"
```

---

### Task 3: Migration — `instagram_interactions` table + `leads.instagram_user_id`

**Files:**
- Create: `supabase/migrations/092_instagram_interactions.sql`

**Interfaces:**
- Consumes: `leads(id, workspace_id)`, `apify_watched_posts(id)` (Task 1)
- Produces: table `instagram_interactions(id, workspace_id, lead_id, interaction_type, instagram_user_id, instagram_username, full_name, profile_url, source_post_id, source_post_url, first_seen_at, last_seen_at, metadata, created_at)`; `leads.instagram_user_id` column + unique index `leads_workspace_ig_user_id_uq`

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/migrations/092_instagram_interactions.sql
-- Événements d'interaction Instagram par lead (likes/commentaires/DMs/mentions),
-- alimentés par le traitement des datasets Apify. Table séparée de funnel_events
-- car funnel_page_id y est NOT NULL (couplage fort au flow web) — inadapté ici.

create table instagram_interactions (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  lead_id uuid not null references leads(id) on delete cascade,
  interaction_type text not null check (interaction_type in ('like', 'comment', 'dm', 'mention')),
  instagram_user_id text,
  instagram_username text not null,
  full_name text,
  profile_url text,
  source_post_id uuid references apify_watched_posts(id),
  source_post_url text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  metadata jsonb,
  created_at timestamptz not null default now(),
  unique (workspace_id, lead_id, interaction_type, source_post_id, instagram_user_id)
);

create index idx_instagram_interactions_workspace on instagram_interactions(workspace_id);
create index idx_instagram_interactions_lead on instagram_interactions(lead_id);
create index idx_instagram_interactions_last_seen on instagram_interactions(workspace_id, last_seen_at desc);

alter table instagram_interactions enable row level security;

create policy "Workspace instagram_interactions" on instagram_interactions
  for all using (
    workspace_id in (select user_workspace_ids())
  );

-- Matching lead <-> compte Instagram : ajoute la colonne id numérique Apify
-- (leads.instagram_handle existe déjà en texte libre, non unique, insuffisant seul)
alter table leads add column instagram_user_id text;

create unique index leads_workspace_ig_user_id_uq
  on leads(workspace_id, instagram_user_id)
  where instagram_user_id is not null;
```

- [ ] **Step 2: Apply the migration**

Run: `supabase db push`
Expected: no errors.

- [ ] **Step 3: Verify the unique constraint on `instagram_interactions`**

Run:
```bash
supabase db execute --sql "
with w as (select id from workspaces limit 1),
     l as (select id from leads limit 1)
insert into instagram_interactions (workspace_id, lead_id, interaction_type, instagram_username)
select w.id, l.id, 'like', 'test_user' from w, l;
"
```
Then run the exact same insert again.
Expected: first insert succeeds, second fails with a unique-constraint violation on `instagram_interactions_workspace_id_lead_id_interaction_type_source_post_id_instagram_user_id_key` (or equivalent auto-generated name).

- [ ] **Step 4: Clean up the test row**

Run: `supabase db execute --sql "delete from instagram_interactions where instagram_username = 'test_user';"`

- [ ] **Step 5: Verify `leads.instagram_user_id` unique index rejects duplicates within a workspace**

Run:
```bash
supabase db execute --sql "
update leads set instagram_user_id = 'ig_dup_test' where id = (select id from leads limit 1);
update leads set instagram_user_id = 'ig_dup_test' where id = (select id from leads offset 1 limit 1);
"
```
Expected: second update fails with `duplicate key value violates unique constraint "leads_workspace_ig_user_id_uq"` (only if at least 2 leads exist in the same workspace; if the test env has only 1 lead, skip this check and note it in the commit message).

- [ ] **Step 6: Clean up test data**

Run: `supabase db execute --sql "update leads set instagram_user_id = null where instagram_user_id = 'ig_dup_test';"`

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/092_instagram_interactions.sql
git commit -m "feat(db): add instagram_interactions table and leads.instagram_user_id"
```

---

### Task 4: Migration — `engagement_scoring_rules` table + `leads.source` extension

**Files:**
- Create: `supabase/migrations/093_engagement_scoring_and_source.sql`

**Interfaces:**
- Produces: table `engagement_scoring_rules(id, workspace_id, interaction_type, points)`; extends `leads_source_check` constraint with `'instagram_engagement'`

- [ ] **Step 1: Check the current `leads.source` CHECK constraint name**

Run: `supabase db execute --sql "select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid = 'leads'::regclass and contype = 'c' and conname like '%source%';"`
Expected: one row, note the exact constraint name and current allowed values (per the design spec: `facebook_ads, instagram_ads, follow_ads, formulaire, manuel, funnel`).

- [ ] **Step 2: Write the migration file** (use the exact constraint name found in Step 1 — if it differs from `leads_source_check`, substitute it)

```sql
-- supabase/migrations/093_engagement_scoring_and_source.sql
-- Ajoute 'instagram_engagement' comme source de lead valide, et une table
-- de scoring configurable par workspace (poids par type d'interaction).

alter table leads drop constraint if exists leads_source_check;

alter table leads add constraint leads_source_check
  check (source in (
    'facebook_ads',
    'instagram_ads',
    'follow_ads',
    'formulaire',
    'manuel',
    'funnel',
    'instagram_engagement'
  ));

create table engagement_scoring_rules (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  interaction_type text not null,
  points int not null default 1,
  unique (workspace_id, interaction_type)
);

alter table engagement_scoring_rules enable row level security;

create policy "Workspace engagement_scoring_rules" on engagement_scoring_rules
  for all using (
    workspace_id in (select user_workspace_ids())
  );
```

- [ ] **Step 3: Apply the migration**

Run: `supabase db push`
Expected: no errors.

- [ ] **Step 4: Verify a lead can be created with the new source value**

Run:
```bash
supabase db execute --sql "
insert into leads (workspace_id, first_name, last_name, phone, email, status, source)
select id, 'Test', 'IG', '', null, 'nouveau', 'instagram_engagement' from workspaces limit 1
returning id;
"
```
Expected: insert succeeds, returns a new lead id. Note the id for cleanup.

- [ ] **Step 5: Clean up the test lead**

Run: `supabase db execute --sql "delete from leads where first_name = 'Test' and last_name = 'IG' and source = 'instagram_engagement';"`

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/093_engagement_scoring_and_source.sql
git commit -m "feat(db): add engagement_scoring_rules table and instagram_engagement lead source"
```

---

### Task 5: Extend `integrations` type CHECK constraint + env var

**Files:**
- Create: `supabase/migrations/094_integrations_apify_type.sql`
- Modify: `.env.local.example`

**Interfaces:**
- Produces: `integrations.type` CHECK constraint accepts `'apify'`; `APIFY_API_TOKEN` documented in env example

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/migrations/094_integrations_apify_type.sql
-- Ajoute 'apify' aux types d'intégration valides, pour stocker le token API
-- Apify chiffré (réutilise integrations.credentials_encrypted existant).

alter table integrations drop constraint if exists integrations_type_check;

alter table integrations add constraint integrations_type_check
  check (type in ('google_calendar', 'meta', 'whatsapp', 'stripe', 'telegram', 'youtube', 'apify'));
```

- [ ] **Step 2: Apply the migration**

Run: `supabase db push`
Expected: no errors.

- [ ] **Step 3: Verify an `apify` integration row can be inserted**

Run:
```bash
supabase db execute --sql "
insert into integrations (workspace_id, type, is_active)
select id, 'apify', false from workspaces limit 1
returning id;
"
```
Expected: insert succeeds.

- [ ] **Step 4: Clean up**

Run: `supabase db execute --sql "delete from integrations where type = 'apify';"`

- [ ] **Step 5: Add the Apify env var block**

Read `.env.local.example` first to find the exact section boundaries, then add after the WhatsApp block:

```env

# Apify — collecte des likes Instagram (compte externe, aucun scraping ClosRM)
APIFY_API_TOKEN=xxx
APIFY_ACTOR_ID=xxx
```

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/094_integrations_apify_type.sql .env.local.example
git commit -m "feat(db): allow apify integration type; document APIFY_API_TOKEN"
```

---

### Task 6: Zod validation schemas for Apify feature

**Files:**
- Create: `src/lib/validations/apify.ts`
- Test: `src/lib/validations/__tests__/apify.test.ts`

**Interfaces:**
- Produces: `watchedPostCreateSchema`, `watchedPostUpdateSchema`, exported Zod schemas and inferred types `WatchedPostCreateInput`, `WatchedPostUpdateInput`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/validations/__tests__/apify.test.ts
import { describe, it, expect } from 'vitest'
import { watchedPostCreateSchema } from '../apify'

describe('watchedPostCreateSchema', () => {
  it('accepts a valid Instagram post URL', () => {
    const result = watchedPostCreateSchema.safeParse({
      instagram_post_url: 'https://www.instagram.com/reel/CxYz123AbC/',
      label: 'Reel objection prix',
    })
    expect(result.success).toBe(true)
  })

  it('rejects a non-Instagram URL', () => {
    const result = watchedPostCreateSchema.safeParse({
      instagram_post_url: 'https://example.com/not-instagram',
    })
    expect(result.success).toBe(false)
  })

  it('rejects a missing instagram_post_url', () => {
    const result = watchedPostCreateSchema.safeParse({ label: 'no url' })
    expect(result.success).toBe(false)
  })

  it('allows label to be omitted', () => {
    const result = watchedPostCreateSchema.safeParse({
      instagram_post_url: 'https://www.instagram.com/p/CxYz123AbC/',
    })
    expect(result.success).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/validations/__tests__/apify.test.ts`
Expected: FAIL — `Cannot find module '../apify'` (file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/validations/apify.ts
import { z } from 'zod'

const INSTAGRAM_POST_URL_REGEX = /^https:\/\/(www\.)?instagram\.com\/(p|reel)\/[A-Za-z0-9_-]+\/?/

export const watchedPostCreateSchema = z.object({
  instagram_post_url: z.string().url().regex(INSTAGRAM_POST_URL_REGEX, {
    message: 'URL de post/reel Instagram invalide',
  }),
  label: z.string().max(200).optional(),
})

export type WatchedPostCreateInput = z.infer<typeof watchedPostCreateSchema>

export const watchedPostUpdateSchema = z.object({
  label: z.string().max(200).optional(),
  is_active: z.boolean().optional(),
})

export type WatchedPostUpdateInput = z.infer<typeof watchedPostUpdateSchema>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/validations/__tests__/apify.test.ts`
Expected: PASS, all 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/validations/apify.ts src/lib/validations/__tests__/apify.test.ts
git commit -m "feat: add Zod validation schemas for watched Instagram posts"
```

---

### Task 7: Apify API client wrapper

**Files:**
- Create: `src/lib/apify/client.ts`
- Test: `src/lib/apify/__tests__/client.test.ts`

**Interfaces:**
- Consumes: `process.env.APIFY_API_TOKEN`, `process.env.APIFY_ACTOR_ID`
- Produces: `startLikersRun(postUrls: string[]): Promise<{ runId: string; datasetId: string | null }>`, `getRunStatus(runId: string): Promise<{ status: 'READY' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'ABORTED' | 'TIMED-OUT'; defaultDatasetId: string | null }>`, `getDatasetItems(datasetId: string): Promise<ApifyLikerItem[]>`, type `ApifyLikerItem = { position: number; userId: string; username: string; fullName: string | null; profilePicUrl: string | null; isVerified: boolean; sourcePost: string; scrapedAt: string }`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/apify/__tests__/client.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { startLikersRun, getRunStatus, getDatasetItems } from '../client'

const originalFetch = global.fetch

describe('apify client', () => {
  beforeEach(() => {
    process.env.APIFY_API_TOKEN = 'test-token'
    process.env.APIFY_ACTOR_ID = 'test-actor-id'
  })

  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('startLikersRun posts to the actor runs endpoint with the token and post URLs', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { id: 'run-123', defaultDatasetId: 'dataset-456' } }),
    })
    global.fetch = mockFetch as unknown as typeof fetch

    const result = await startLikersRun(['https://www.instagram.com/reel/abc/'])

    expect(result).toEqual({ runId: 'run-123', datasetId: 'dataset-456' })
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.apify.com/v2/actors/test-actor-id/runs',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        }),
      }),
    )
  })

  it('startLikersRun throws when the API responds with an error status', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    }) as unknown as typeof fetch

    await expect(startLikersRun(['https://www.instagram.com/reel/abc/'])).rejects.toThrow(
      'Apify run start failed: 401',
    )
  })

  it('getRunStatus fetches the run and returns status + dataset id', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { status: 'SUCCEEDED', defaultDatasetId: 'dataset-456' } }),
    }) as unknown as typeof fetch

    const result = await getRunStatus('run-123')

    expect(result).toEqual({ status: 'SUCCEEDED', defaultDatasetId: 'dataset-456' })
  })

  it('getDatasetItems fetches and returns the items array', async () => {
    const items = [
      { position: 1, userId: 'u1', username: 'user_one', fullName: 'User One', profilePicUrl: null, isVerified: false, sourcePost: 'https://www.instagram.com/reel/abc/', scrapedAt: '2026-08-21T10:00:00.000Z' },
    ]
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items }),
    }) as unknown as typeof fetch

    const result = await getDatasetItems('dataset-456')

    expect(result).toEqual(items)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/apify/__tests__/client.test.ts`
Expected: FAIL — `Cannot find module '../client'`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/apify/client.ts
const APIFY_BASE_URL = 'https://api.apify.com/v2'

export interface ApifyLikerItem {
  position: number
  userId: string
  username: string
  fullName: string | null
  profilePicUrl: string | null
  isVerified: boolean
  sourcePost: string
  scrapedAt: string
}

export type ApifyRunStatus = 'READY' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'ABORTED' | 'TIMED-OUT'

function getToken(): string {
  const token = process.env.APIFY_API_TOKEN
  if (!token) throw new Error('APIFY_API_TOKEN is not set')
  return token
}

function getActorId(): string {
  const actorId = process.env.APIFY_ACTOR_ID
  if (!actorId) throw new Error('APIFY_ACTOR_ID is not set')
  return actorId
}

export async function startLikersRun(
  postUrls: string[],
): Promise<{ runId: string; datasetId: string | null }> {
  const response = await fetch(`${APIFY_BASE_URL}/actors/${getActorId()}/runs`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ postUrls }),
  })

  if (!response.ok) {
    throw new Error(`Apify run start failed: ${response.status}`)
  }

  const body = await response.json()
  return {
    runId: body.data.id,
    datasetId: body.data.defaultDatasetId ?? null,
  }
}

export async function getRunStatus(
  runId: string,
): Promise<{ status: ApifyRunStatus; defaultDatasetId: string | null }> {
  const response = await fetch(`${APIFY_BASE_URL}/actors/${getActorId()}/runs/${runId}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  })

  if (!response.ok) {
    throw new Error(`Apify run status fetch failed: ${response.status}`)
  }

  const body = await response.json()
  return {
    status: body.data.status,
    defaultDatasetId: body.data.defaultDatasetId ?? null,
  }
}

export async function getDatasetItems(datasetId: string): Promise<ApifyLikerItem[]> {
  const response = await fetch(`${APIFY_BASE_URL}/datasets/${datasetId}/items`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  })

  if (!response.ok) {
    throw new Error(`Apify dataset fetch failed: ${response.status}`)
  }

  return response.json()
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/apify/__tests__/client.test.ts`
Expected: PASS, all 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/apify/client.ts src/lib/apify/__tests__/client.test.ts
git commit -m "feat: add Apify REST API client wrapper"
```

---

### Task 8: Dataset-to-lead processing function (dedup + interaction upsert)

**Files:**
- Create: `src/lib/apify/process-likers.ts`
- Test: `src/lib/apify/__tests__/process-likers.test.ts`

**Interfaces:**
- Consumes: `ApifyLikerItem` (Task 7), Supabase client (service role)
- Produces: `processLikersDataset(supabase: SupabaseClient, workspaceId: string, watchedPostId: string, postUrl: string, items: ApifyLikerItem[]): Promise<{ leadsCreated: number; leadsMatched: number; interactionsUpserted: number }>`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/apify/__tests__/process-likers.test.ts
import { describe, it, expect, vi } from 'vitest'
import { processLikersDataset } from '../process-likers'
import type { ApifyLikerItem } from '../client'

function makeItem(overrides: Partial<ApifyLikerItem> = {}): ApifyLikerItem {
  return {
    position: 1,
    userId: 'ig_user_1',
    username: 'jean_dupont',
    fullName: 'Jean Dupont',
    profilePicUrl: 'https://example.com/pic.jpg',
    isVerified: false,
    sourcePost: 'https://www.instagram.com/reel/abc/',
    scrapedAt: '2026-08-21T10:00:00.000Z',
    ...overrides,
  }
}

function makeSupabaseMock({ existingLeadId }: { existingLeadId: string | null }) {
  const upsertMock = vi.fn().mockResolvedValue({ error: null })
  const insertMock = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: { id: 'new-lead-id' }, error: null }),
    }),
  })
  const maybeSingleMock = vi.fn().mockResolvedValue({
    data: existingLeadId ? { id: existingLeadId } : null,
    error: null,
  })

  const supabase = {
    from: vi.fn((table: string) => {
      if (table === 'leads') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock }),
            }),
          }),
          insert: insertMock,
        }
      }
      if (table === 'instagram_interactions') {
        return { upsert: upsertMock }
      }
      throw new Error(`Unexpected table: ${table}`)
    }),
  }

  return { supabase, upsertMock, insertMock, maybeSingleMock }
}

describe('processLikersDataset', () => {
  it('creates a new lead when no existing lead matches instagram_user_id', async () => {
    const { supabase, insertMock, upsertMock } = makeSupabaseMock({ existingLeadId: null })

    const result = await processLikersDataset(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase as any,
      'workspace-1',
      'watched-post-1',
      'https://www.instagram.com/reel/abc/',
      [makeItem()],
    )

    expect(insertMock).toHaveBeenCalled()
    expect(upsertMock).toHaveBeenCalled()
    expect(result).toEqual({ leadsCreated: 1, leadsMatched: 0, interactionsUpserted: 1 })
  })

  it('reuses an existing lead when instagram_user_id already matches', async () => {
    const { supabase, insertMock, upsertMock } = makeSupabaseMock({ existingLeadId: 'existing-lead-id' })

    const result = await processLikersDataset(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase as any,
      'workspace-1',
      'watched-post-1',
      'https://www.instagram.com/reel/abc/',
      [makeItem()],
    )

    expect(insertMock).not.toHaveBeenCalled()
    expect(upsertMock).toHaveBeenCalled()
    expect(result).toEqual({ leadsCreated: 0, leadsMatched: 1, interactionsUpserted: 1 })
  })

  it('processes multiple items independently, summing counts', async () => {
    const { supabase } = makeSupabaseMock({ existingLeadId: null })

    const result = await processLikersDataset(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase as any,
      'workspace-1',
      'watched-post-1',
      'https://www.instagram.com/reel/abc/',
      [makeItem({ userId: 'ig_user_1' }), makeItem({ userId: 'ig_user_2', username: 'marie_martin' })],
    )

    expect(result).toEqual({ leadsCreated: 2, leadsMatched: 0, interactionsUpserted: 2 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/apify/__tests__/process-likers.test.ts`
Expected: FAIL — `Cannot find module '../process-likers'`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/apify/process-likers.ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import type { ApifyLikerItem } from './client'

export interface ProcessLikersResult {
  leadsCreated: number
  leadsMatched: number
  interactionsUpserted: number
}

export async function processLikersDataset(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  workspaceId: string,
  watchedPostId: string,
  postUrl: string,
  items: ApifyLikerItem[],
): Promise<ProcessLikersResult> {
  let leadsCreated = 0
  let leadsMatched = 0
  let interactionsUpserted = 0

  for (const item of items) {
    const { data: existingLead } = await supabase
      .from('leads')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('instagram_user_id', item.userId)
      .maybeSingle()

    let leadId: string

    if (existingLead) {
      leadId = existingLead.id
      leadsMatched += 1
    } else {
      const { data: newLead, error: insertError } = await supabase
        .from('leads')
        .insert({
          workspace_id: workspaceId,
          first_name: item.fullName ?? item.username,
          last_name: '',
          phone: '',
          email: null,
          status: 'nouveau',
          source: 'instagram_engagement',
          instagram_handle: item.username,
          instagram_user_id: item.userId,
        })
        .select('id')
        .single()

      if (insertError || !newLead) {
        throw new Error(`Failed to create lead for Instagram user ${item.username}: ${insertError?.message}`)
      }

      leadId = newLead.id
      leadsCreated += 1
    }

    const { error: upsertError } = await supabase.from('instagram_interactions').upsert(
      {
        workspace_id: workspaceId,
        lead_id: leadId,
        interaction_type: 'like',
        instagram_user_id: item.userId,
        instagram_username: item.username,
        full_name: item.fullName,
        profile_url: `https://www.instagram.com/${item.username}/`,
        source_post_id: watchedPostId,
        source_post_url: postUrl,
        last_seen_at: item.scrapedAt,
        metadata: { position: item.position, isVerified: item.isVerified },
      },
      { onConflict: 'workspace_id,lead_id,interaction_type,source_post_id,instagram_user_id' },
    )

    if (upsertError) {
      throw new Error(`Failed to upsert interaction for ${item.username}: ${upsertError.message}`)
    }

    interactionsUpserted += 1
  }

  return { leadsCreated, leadsMatched, interactionsUpserted }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/apify/__tests__/process-likers.test.ts`
Expected: PASS, all 3 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/apify/process-likers.ts src/lib/apify/__tests__/process-likers.test.ts
git commit -m "feat: add Apify likers dataset processing with lead dedup"
```

---

### Task 9: API routes — CRUD for watched posts

**Files:**
- Create: `src/app/api/integrations/apify/watched-posts/route.ts`
- Create: `src/app/api/integrations/apify/watched-posts/[id]/route.ts`

**Interfaces:**
- Consumes: `watchedPostCreateSchema`, `watchedPostUpdateSchema` (Task 6), `getWorkspaceId()` (`@/lib/supabase/get-workspace`), `createClient()` (`@/lib/supabase/server`)
- Produces: `GET /api/integrations/apify/watched-posts` → `{ posts: WatchedPost[] }`; `POST` → `{ post: WatchedPost }`; `PATCH /api/integrations/apify/watched-posts/[id]` → `{ post: WatchedPost }`; `DELETE` → `{ success: true }`

- [ ] **Step 1: Write the list+create route**

```ts
// src/app/api/integrations/apify/watched-posts/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { watchedPostCreateSchema } from '@/lib/validations/apify'

export async function GET() {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('apify_watched_posts')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ posts: data })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    console.error('[API /integrations/apify/watched-posts GET] Error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const body = await request.json()
    const parsed = watchedPostCreateSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const postCodeMatch = parsed.data.instagram_post_url.match(/\/(p|reel)\/([A-Za-z0-9_-]+)/)
    const instagramPostCode = postCodeMatch ? postCodeMatch[2] : null

    const { data, error } = await supabase
      .from('apify_watched_posts')
      .insert({
        workspace_id: workspaceId,
        instagram_post_url: parsed.data.instagram_post_url,
        instagram_post_code: instagramPostCode,
        label: parsed.data.label ?? null,
      })
      .select('*')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ post: data })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    console.error('[API /integrations/apify/watched-posts POST] Error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Write the update+delete route**

```ts
// src/app/api/integrations/apify/watched-posts/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { watchedPostUpdateSchema } from '@/lib/validations/apify'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const body = await request.json()
    const parsed = watchedPostUpdateSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('apify_watched_posts')
      .update(parsed.data)
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .select('*')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ post: data })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    console.error('[API /integrations/apify/watched-posts/[id] PATCH] Error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const { error } = await supabase
      .from('apify_watched_posts')
      .delete()
      .eq('id', id)
      .eq('workspace_id', workspaceId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    console.error('[API /integrations/apify/watched-posts/[id] DELETE] Error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Manually verify the routes with the dev server**

Run: `npm run dev` in one terminal, then in another:
```bash
curl -X POST http://localhost:3000/api/integrations/apify/watched-posts \
  -H "Content-Type: application/json" \
  -H "Cookie: <your-session-cookie>" \
  -d '{"instagram_post_url":"https://www.instagram.com/reel/CxYz123AbC/","label":"Test reel"}'
```
Expected: `{"post": {...}}` with `instagram_post_code: "CxYz123AbC"`. (Session cookie must come from a logged-in browser session — copy from DevTools Application > Cookies.)

- [ ] **Step 4: Commit**

```bash
git add src/app/api/integrations/apify/watched-posts/
git commit -m "feat: add CRUD API routes for Apify watched posts"
```

---

### Task 10: Add `'apify'` to integrations type lists (existing routes)

**Files:**
- Modify: `src/app/api/integrations/route.ts`
- Modify: `src/app/api/integrations/[type]/route.ts`

**Interfaces:**
- Consumes: existing `ALL_TYPES` const in `route.ts`, `VALID_TYPES` const in `[type]/route.ts`

- [ ] **Step 1: Read the current `ALL_TYPES` constant**

Run: `grep -n "ALL_TYPES" src/app/api/integrations/route.ts`
Expected: shows the array definition line, e.g. `const ALL_TYPES = ['google_calendar', 'meta', 'whatsapp', 'stripe', 'telegram']`.

- [ ] **Step 2: Add `'apify'` to `ALL_TYPES`**

Edit `src/app/api/integrations/route.ts`: change the `ALL_TYPES` array to append `'apify'` at the end, matching the exact array found in Step 1 plus this new entry.

- [ ] **Step 3: Read the current `VALID_TYPES` constant**

Run: `grep -n "VALID_TYPES" "src/app/api/integrations/[type]/route.ts"`
Expected: shows the array definition line.

- [ ] **Step 4: Add `'apify'` to `VALID_TYPES`**

Edit `src/app/api/integrations/[type]/route.ts`: append `'apify'` to the `VALID_TYPES` array the same way.

- [ ] **Step 5: Verify with the dev server**

Run: `npm run dev`, then `curl http://localhost:3000/api/integrations -H "Cookie: <session-cookie>"`
Expected: response includes an `apify` entry with `is_active: false` alongside the other integration types.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/integrations/route.ts "src/app/api/integrations/[type]/route.ts"
git commit -m "feat: register apify as a valid integration type"
```

---

### Task 11: Cron endpoint — launch Apify runs for active watched posts

**Files:**
- Create: `src/app/api/cron/apify-instagram-likes/route.ts`

**Interfaces:**
- Consumes: `startLikersRun` (Task 7), `createServiceClient` (`@/lib/supabase/service`), `decrypt` (`@/lib/crypto`)
- Produces: `GET` handler returning `{ started: number, skipped: number, errors: string[] }`

- [ ] **Step 1: Write the route**

```ts
// src/app/api/cron/apify-instagram-likes/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { startLikersRun } from '@/lib/apify/client'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const results = { started: 0, skipped: 0, errors: [] as string[] }

  const { data: watchedPosts, error } = await supabase
    .from('apify_watched_posts')
    .select('id, workspace_id, instagram_post_url')
    .eq('is_active', true)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  for (const post of watchedPosts ?? []) {
    const { data: activeIntegration } = await supabase
      .from('integrations')
      .select('is_active')
      .eq('workspace_id', post.workspace_id)
      .eq('type', 'apify')
      .eq('is_active', true)
      .maybeSingle()

    if (!activeIntegration) {
      results.skipped += 1
      continue
    }

    try {
      const { runId, datasetId } = await startLikersRun([post.instagram_post_url])

      await supabase.from('apify_runs').insert({
        workspace_id: post.workspace_id,
        watched_post_id: post.id,
        apify_run_id: runId,
        apify_dataset_id: datasetId,
        status: 'pending',
      })

      await supabase
        .from('apify_watched_posts')
        .update({ last_run_id: runId, last_checked_at: new Date().toISOString() })
        .eq('id', post.id)

      results.started += 1
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      results.errors.push(`Post ${post.id}: ${message}`)
    }
  }

  return NextResponse.json(results)
}
```

- [ ] **Step 2: Verify manually against a real Apify actor** (requires `APIFY_API_TOKEN`/`APIFY_ACTOR_ID` set and at least one active watched post + active apify integration)

Run:
```bash
curl http://localhost:3000/api/cron/apify-instagram-likes \
  -H "Authorization: Bearer $CRON_SECRET"
```
Expected: `{"started": 1, "skipped": 0, "errors": []}` (adjust counts to your test data), and a new row in `apify_runs` with `status: 'pending'`.

- [ ] **Step 3: Verify the unauthorized case**

Run: `curl http://localhost:3000/api/cron/apify-instagram-likes -H "Authorization: Bearer wrong-secret"`
Expected: `{"error":"Unauthorized"}` with HTTP 401.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/cron/apify-instagram-likes/route.ts
git commit -m "feat: add cron endpoint to launch Apify runs for watched posts"
```

---

### Task 12: Cron endpoint — poll pending runs and process results

**Files:**
- Create: `src/app/api/cron/apify-poll-results/route.ts`

**Interfaces:**
- Consumes: `getRunStatus`, `getDatasetItems` (Task 7), `processLikersDataset` (Task 8), `createServiceClient`
- Produces: `GET` handler returning `{ processed: number, stillRunning: number, failed: number, errors: string[] }`

- [ ] **Step 1: Write the route**

```ts
// src/app/api/cron/apify-poll-results/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getRunStatus, getDatasetItems } from '@/lib/apify/client'
import { processLikersDataset } from '@/lib/apify/process-likers'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const results = { processed: 0, stillRunning: 0, failed: 0, errors: [] as string[] }

  const { data: pendingRuns, error } = await supabase
    .from('apify_runs')
    .select('id, workspace_id, watched_post_id, apify_run_id, apify_dataset_id')
    .in('status', ['pending', 'running'])

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  for (const run of pendingRuns ?? []) {
    try {
      const { status, defaultDatasetId } = await getRunStatus(run.apify_run_id)

      if (status === 'RUNNING' || status === 'READY') {
        await supabase.from('apify_runs').update({ status: 'running' }).eq('id', run.id)
        results.stillRunning += 1
        continue
      }

      if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
        await supabase
          .from('apify_runs')
          .update({ status: 'failed', finished_at: new Date().toISOString() })
          .eq('id', run.id)
        results.failed += 1
        continue
      }

      // status === 'SUCCEEDED'
      const datasetId = defaultDatasetId ?? run.apify_dataset_id
      if (!datasetId) {
        throw new Error(`Run ${run.apify_run_id} succeeded but has no dataset id`)
      }

      const { data: watchedPost } = await supabase
        .from('apify_watched_posts')
        .select('id, instagram_post_url')
        .eq('id', run.watched_post_id)
        .single()

      if (!watchedPost) {
        throw new Error(`Watched post ${run.watched_post_id} not found`)
      }

      const items = await getDatasetItems(datasetId)
      const processResult = await processLikersDataset(
        supabase,
        run.workspace_id,
        watchedPost.id,
        watchedPost.instagram_post_url,
        items,
      )

      await supabase
        .from('apify_runs')
        .update({
          status: 'succeeded',
          items_processed: items.length,
          finished_at: new Date().toISOString(),
        })
        .eq('id', run.id)

      await supabase
        .from('apify_watched_posts')
        .update({ likers_count: items.length })
        .eq('id', watchedPost.id)

      results.processed += 1
      void processResult
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      results.errors.push(`Run ${run.apify_run_id}: ${message}`)
    }
  }

  return NextResponse.json(results)
}
```

- [ ] **Step 2: Verify manually**

Run (after Task 11's cron has created a pending run and enough time has passed for Apify to finish):
```bash
curl http://localhost:3000/api/cron/apify-poll-results \
  -H "Authorization: Bearer $CRON_SECRET"
```
Expected: `{"processed": 1, "stillRunning": 0, "failed": 0, "errors": []}` (or `stillRunning: 1` if the Apify run hasn't finished yet — rerun the curl a few minutes later), and new rows in `instagram_interactions`.

- [ ] **Step 3: Verify a lead was created/matched from the run**

Run: `supabase db execute --sql "select l.first_name, l.instagram_handle, ii.interaction_type from instagram_interactions ii join leads l on l.id = ii.lead_id order by ii.created_at desc limit 5;"`
Expected: at least one row showing a lead matched to an Instagram username from the watched post.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/cron/apify-poll-results/route.ts
git commit -m "feat: add cron endpoint to poll Apify runs and process results"
```

---

### Task 13: pg_cron schedules for both cron endpoints

**Files:**
- Create: `supabase/migrations/095_pgcron_apify_instagram.sql`

**Interfaces:**
- Consumes: `app.url`, `app.cron_secret` DB settings (already configured from prior pg_cron migrations)

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/migrations/095_pgcron_apify_instagram.sql
-- Planifie le lancement des runs Apify (toutes les 30 min) et le polling des
-- résultats (toutes les 5 min) via les endpoints cron correspondants.

SELECT cron.unschedule('apify-launch-runs')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'apify-launch-runs');

SELECT cron.schedule(
  'apify-launch-runs',
  '*/30 * * * *',
  $$
  SELECT net.http_get(
    url := current_setting('app.url', true) || '/api/cron/apify-instagram-likes',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.cron_secret', true)
    ),
    timeout_milliseconds := 30000
  );
  $$
);

SELECT cron.unschedule('apify-poll-results')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'apify-poll-results');

SELECT cron.schedule(
  'apify-poll-results',
  '*/5 * * * *',
  $$
  SELECT net.http_get(
    url := current_setting('app.url', true) || '/api/cron/apify-poll-results',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.cron_secret', true)
    ),
    timeout_milliseconds := 60000
  );
  $$
);
```

- [ ] **Step 2: Apply the migration**

Run: `supabase db push`
Expected: no errors.

- [ ] **Step 3: Verify both jobs are scheduled**

Run: `supabase db execute --sql "select jobname, schedule, active from cron.job where jobname in ('apify-launch-runs', 'apify-poll-results');"`
Expected: 2 rows, both `active = true`, schedules `*/30 * * * *` and `*/5 * * * *`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/095_pgcron_apify_instagram.sql
git commit -m "feat(db): schedule pg_cron jobs for Apify run launch and result polling"
```

---

### Task 14: Extend `LeadJourneyBlock` with Instagram engagement events

**Files:**
- Modify: `src/components/leads/LeadJourneyBlock.tsx`
- Modify: `src/app/api/leads/[id]/journey/route.ts`

**Interfaces:**
- Consumes: `instagram_interactions` table (Task 3)
- Produces: journey API response includes merged `instagram_like`/`instagram_comment` events; `LeadJourneyBlock` renders them

- [ ] **Step 1: Read the current journey route response shape**

Run: `grep -n "NextResponse.json" src/app/api/leads/[id]/journey/route.ts`
Expected: locate the final response-building block (per research, around lines 145-163) to know the exact shape to extend.

- [ ] **Step 2: Add the Instagram interactions query to the journey route**

Modify `src/app/api/leads/[id]/journey/route.ts`: after the existing `funnel_events` query, add:

```ts
const { data: igInteractions } = await supabase
  .from('instagram_interactions')
  .select('id, interaction_type, instagram_username, profile_url, source_post_url, metadata, last_seen_at')
  .eq('workspace_id', workspaceId)
  .eq('lead_id', lead.id)
  .order('last_seen_at', { ascending: true })
  .limit(200)

const igEvents = (igInteractions ?? []).map((ig) => ({
  id: ig.id,
  event_type: ig.interaction_type === 'like' ? 'instagram_like' : 'instagram_comment',
  metadata: { ...ig.metadata, instagram_username: ig.instagram_username, source_post_url: ig.source_post_url },
  funnel_page_id: null,
  funnel_page_name: null,
  created_at: ig.last_seen_at,
}))
```

Then merge `igEvents` into the existing `events` array before sorting by `created_at` and returning (find the existing sort/return logic and combine both arrays with `[...events, ...igEvents].sort(...)`).

- [ ] **Step 3: Add the new event types to `EVENT_LABEL`**

Modify `src/components/leads/LeadJourneyBlock.tsx`: extend the `EVENT_LABEL` record:

```ts
const EVENT_LABEL: Record<string, string> = {
  view: 'A consulté',
  button_click: 'A cliqué',
  video_play: 'A regardé',
  form_submit: 'A rempli le formulaire',
  instagram_like: 'A liké un de tes reels',
  instagram_comment: 'A commenté un de tes reels',
}
```

- [ ] **Step 4: Add the new event types to `EventIcon`**

Modify the `EventIcon` function, adding an import for `Heart` and `MessageCircle` from `lucide-react` at the top of the file, then extend the `switch`:

```ts
    case 'instagram_like': return <Heart size={size} />
    case 'instagram_comment': return <MessageCircle size={size} />
```

- [ ] **Step 5: Add the new event types to `describeEvent`**

Modify `describeEvent`:

```ts
    case 'instagram_like':
    case 'instagram_comment': {
      const username = e.metadata?.instagram_username
      return typeof username === 'string' ? `@${username}` : ''
    }
```

- [ ] **Step 6: Verify manually with the dev server**

Run: `npm run dev`, then navigate to a lead detail page for a lead that has rows in `instagram_interactions` (created by Task 8/12's processing, or insert one manually via `supabase db execute`).
Expected: the lead's journey timeline shows "A liké un de tes reels — @username" entries alongside existing funnel events, ordered chronologically.

- [ ] **Step 7: Commit**

```bash
git add src/components/leads/LeadJourneyBlock.tsx "src/app/api/leads/[id]/journey/route.ts"
git commit -m "feat: surface Instagram engagement events in lead journey timeline"
```

---

### Task 15: "Leads chauds à contacter" page

**Files:**
- Create: `src/app/api/leads/hot/route.ts`
- Create: `src/app/(dashboard)/leads-chauds/page.tsx`
- Create: `src/app/(dashboard)/leads-chauds/hot-leads-client.tsx`

**Interfaces:**
- Consumes: `instagram_interactions`, `engagement_scoring_rules` (Task 3, 4), `getWorkspaceId`, `createClient`
- Produces: `GET /api/leads/hot?days=7` → `{ leads: HotLead[] }` where `HotLead = { lead_id, first_name, last_name, instagram_handle, score, likes_count, comments_count, dm_count, last_interaction_at }`

- [ ] **Step 1: Write the API route**

```ts
// src/app/api/leads/hot/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'

const DEFAULT_SCORING = { like: 1, comment: 3, dm: 5, mention: 2 } as const

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const days = Number(searchParams.get('days') ?? '7')
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

    const { data: rules } = await supabase
      .from('engagement_scoring_rules')
      .select('interaction_type, points')
      .eq('workspace_id', workspaceId)

    const scoring: Record<string, number> = { ...DEFAULT_SCORING }
    for (const rule of rules ?? []) {
      scoring[rule.interaction_type] = rule.points
    }

    const { data: interactions, error } = await supabase
      .from('instagram_interactions')
      .select('lead_id, interaction_type, last_seen_at, leads(id, first_name, last_name, instagram_handle)')
      .eq('workspace_id', workspaceId)
      .gte('last_seen_at', since)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const byLead = new Map<
      string,
      {
        lead_id: string
        first_name: string
        last_name: string
        instagram_handle: string | null
        score: number
        likes_count: number
        comments_count: number
        dm_count: number
        last_interaction_at: string
      }
    >()

    for (const row of interactions ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lead = row.leads as any
      if (!lead) continue

      const existing = byLead.get(row.lead_id) ?? {
        lead_id: row.lead_id,
        first_name: lead.first_name,
        last_name: lead.last_name,
        instagram_handle: lead.instagram_handle,
        score: 0,
        likes_count: 0,
        comments_count: 0,
        dm_count: 0,
        last_interaction_at: row.last_seen_at,
      }

      existing.score += scoring[row.interaction_type] ?? 1
      if (row.interaction_type === 'like') existing.likes_count += 1
      if (row.interaction_type === 'comment') existing.comments_count += 1
      if (row.interaction_type === 'dm') existing.dm_count += 1
      if (row.last_seen_at > existing.last_interaction_at) existing.last_interaction_at = row.last_seen_at

      byLead.set(row.lead_id, existing)
    }

    const leads = Array.from(byLead.values()).sort((a, b) => b.score - a.score)

    return NextResponse.json({ leads })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    console.error('[API /leads/hot GET] Error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Write the server page**

```tsx
// src/app/(dashboard)/leads-chauds/page.tsx
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { createClient } from '@/lib/supabase/server'
import HotLeadsClient from './hot-leads-client'

export default async function LeadsChaudsPage() {
  const { workspaceId } = await getWorkspaceId()
  const supabase = await createClient()

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: rules } = await supabase
    .from('engagement_scoring_rules')
    .select('interaction_type, points')
    .eq('workspace_id', workspaceId)

  const scoring: Record<string, number> = { like: 1, comment: 3, dm: 5, mention: 2 }
  for (const rule of rules ?? []) {
    scoring[rule.interaction_type] = rule.points
  }

  const { data: interactions } = await supabase
    .from('instagram_interactions')
    .select('lead_id, interaction_type, last_seen_at, leads(id, first_name, last_name, instagram_handle)')
    .eq('workspace_id', workspaceId)
    .gte('last_seen_at', since)

  const byLead = new Map<
    string,
    {
      lead_id: string
      first_name: string
      last_name: string
      instagram_handle: string | null
      score: number
      likes_count: number
      comments_count: number
      dm_count: number
      last_interaction_at: string
    }
  >()

  for (const row of interactions ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lead = row.leads as any
    if (!lead) continue

    const existing = byLead.get(row.lead_id) ?? {
      lead_id: row.lead_id,
      first_name: lead.first_name,
      last_name: lead.last_name,
      instagram_handle: lead.instagram_handle,
      score: 0,
      likes_count: 0,
      comments_count: 0,
      dm_count: 0,
      last_interaction_at: row.last_seen_at,
    }

    existing.score += scoring[row.interaction_type] ?? 1
    if (row.interaction_type === 'like') existing.likes_count += 1
    if (row.interaction_type === 'comment') existing.comments_count += 1
    if (row.interaction_type === 'dm') existing.dm_count += 1
    if (row.last_seen_at > existing.last_interaction_at) existing.last_interaction_at = row.last_seen_at

    byLead.set(row.lead_id, existing)
  }

  const initialLeads = Array.from(byLead.values()).sort((a, b) => b.score - a.score)

  return <HotLeadsClient initialLeads={initialLeads} />
}
```

- [ ] **Step 3: Write the client component**

```tsx
// src/app/(dashboard)/leads-chauds/hot-leads-client.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'

interface HotLead {
  lead_id: string
  first_name: string
  last_name: string
  instagram_handle: string | null
  score: number
  likes_count: number
  comments_count: number
  dm_count: number
  last_interaction_at: string
}

interface Props {
  initialLeads: HotLead[]
}

export default function HotLeadsClient({ initialLeads }: Props) {
  const [leads] = useState<HotLead[]>(initialLeads)

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 16 }}>
        Leads chauds à contacter
      </h1>

      {leads.length === 0 ? (
        <div style={{ color: 'var(--color-text-secondary)', textAlign: 'center', padding: 40 }}>
          Aucun lead avec une interaction Instagram récente.
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
              <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--color-text-secondary)' }}>Lead</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--color-text-secondary)' }}>Score</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--color-text-secondary)' }}>Détail</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--color-text-secondary)' }}>
                Dernière interaction
              </th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr key={lead.lead_id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td style={{ padding: '8px 12px' }}>
                  <Link href={`/leads/${lead.lead_id}`} style={{ color: 'var(--color-text-primary)' }}>
                    {lead.first_name} {lead.last_name}
                    {lead.instagram_handle ? ` (@${lead.instagram_handle})` : ''}
                  </Link>
                </td>
                <td style={{ padding: '8px 12px', color: 'var(--color-primary)', fontWeight: 600 }}>
                  🔥 {lead.score}
                </td>
                <td style={{ padding: '8px 12px', color: 'var(--color-text-secondary)' }}>
                  {lead.likes_count} likes · {lead.comments_count} commentaires · {lead.dm_count} DMs
                </td>
                <td style={{ padding: '8px 12px', color: 'var(--color-text-secondary)' }}>
                  {new Date(lead.last_interaction_at).toLocaleDateString('fr-FR')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Verify manually with the dev server**

Run: `npm run dev`, navigate to `http://localhost:3000/leads-chauds`.
Expected: page loads, shows a table of leads sorted by score descending (or the empty state if no `instagram_interactions` rows exist yet — insert one manually via `supabase db execute` to verify the populated state).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/leads/hot/route.ts "src/app/(dashboard)/leads-chauds/"
git commit -m "feat: add hot leads page ranked by Instagram engagement score"
```

---

## Self-Review Notes

- **Spec coverage**: all elements of spec section 1 are covered — schema (Tasks 1-4), integrations type + env var (Task 5), Apify client (Task 7), dataset processing/dedup (Task 8), CRUD routes (Task 9-10), cron launch + poll (Tasks 11-13), LeadJourneyBlock extension (Task 14), hot leads view (Task 15).
- **Not covered by this plan** (belongs to separate plans per the spec's own scoping): status pipeline extension (spec section 2), funnel widget (spec section 3), mobile app status list updates.
- **Type consistency checked**: `ApifyLikerItem` (Task 7) is the exact type consumed by `processLikersDataset` (Task 8) and returned by `getDatasetItems`. `WatchedPostCreateInput`/`WatchedPostUpdateInput` (Task 6) match the Zod schemas used in Task 9's routes. The `HotLead` shape in Task 15's route and page duplicate their computation intentionally (route for potential future client-side refresh, page for the initial server render) — both use the identical scoring/aggregation logic to avoid drift; flag this duplication for extraction into a shared function if the codebase's linting catches it.

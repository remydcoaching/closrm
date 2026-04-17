# T-031 — Import CSV Leads Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow coaches to import their existing lead portfolio from a CSV file via a 5-step wizard with auto-mapping, deduplication, inline error correction, and import history.

**Architecture:** Hybrid approach — CSV is parsed client-side (PapaParse) for instant preview and mapping. The mapped JSON is sent to the server for deduplication (DB query), Zod validation, batch insert (chunks of 100), and workflow trigger firing. State machine in the wizard component manages the 5 steps.

**Tech Stack:** Next.js 14 App Router, PapaParse (client CSV parsing), Zod (validation), Supabase (DB + RLS), lucide-react (icons), existing design system (dark theme, `#E53E3E` primary).

**Spec:** `docs/superpowers/specs/2026-04-15-import-leads-csv-design.md`

---

## File Structure

### Files to create

| File | Responsibility |
|------|---------------|
| `supabase/migrations/023_lead_import_batches.sql` | DB migration: `lead_import_batches` table + `leads.import_batch_id` column + RLS |
| `src/lib/leads/csv-parser.ts` | Auto-mapping heuristic (synonyms FR/EN), header normalization, confidence scoring |
| `src/lib/leads/import-engine.ts` | Dedup logic, validation adapter (Zod), batch insert, trigger firing |
| `src/app/api/leads/import/preview/route.ts` | POST — dry-run: dedup + validate without inserting, return diff counts |
| `src/app/api/leads/import/route.ts` | POST — real import: create batch, insert chunks, fire trigger |
| `src/app/api/leads/import/[batchId]/route.ts` | GET status, DELETE cancel batch |
| `src/app/api/leads/import/history/route.ts` | GET — list all batches for workspace |
| `src/app/(dashboard)/leads/import/page.tsx` | SSR wrapper for import wizard page |
| `src/app/(dashboard)/leads/import/import-client.tsx` | Client component: wizard state machine, orchestrates steps |
| `src/components/leads/import/ImportStepper.tsx` | Horizontal stepper UI (5 steps, active/done/future states) |
| `src/components/leads/import/Step1_UploadPreview.tsx` | Drag & drop zone, PapaParse parsing, preview table, auto-mapping trigger |
| `src/components/leads/import/Step2_MappingConfig.tsx` | Column mapping dropdowns + dedup/source/status/tags config |
| `src/components/leads/import/Step3_PreviewDiff.tsx` | Server diff display: 4 counters + tabbed examples |
| `src/components/leads/import/Step4_ImportProgress.tsx` | Progress bar + polling |
| `src/components/leads/import/Step5_Recap.tsx` | Final counters, error table with inline editing, reimport button |
| `src/app/(dashboard)/leads/import/history/page.tsx` | SSR wrapper for import history page |
| `src/components/leads/import/ImportHistory.tsx` | History table with cancel buttons |

### Files to modify

| File | Change |
|------|--------|
| `src/types/index.ts` | Add `import_batch_id` to `Lead`, add `LeadImportBatch` type, add `ImportDedupStrategy`/`ImportDedupAction` types |
| `src/app/(dashboard)/leads/leads-client.tsx` | Add "Importer" button next to "Ajouter un lead" |
| `supabase/schema.sql` | Reflect migration 023 |
| `package.json` | Add `papaparse` + `@types/papaparse` |

---

## Task 1: Database Migration + Types

**Files:**
- Create: `supabase/migrations/023_lead_import_batches.sql`
- Modify: `supabase/schema.sql` (add table + column at end)
- Modify: `src/types/index.ts` (add types)

- [ ] **Step 1: Create migration file**

```sql
-- 023_lead_import_batches.sql

-- Table to track import batches
create table lead_import_batches (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  file_name     text not null,
  status        text not null default 'pending'
                check (status in ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  total_rows    int not null default 0,
  created_count int not null default 0,
  updated_count int not null default 0,
  skipped_count int not null default 0,
  error_count   int not null default 0,
  errors        jsonb default '[]'::jsonb,
  config        jsonb not null default '{}'::jsonb,
  created_by    uuid references auth.users(id),
  created_at    timestamptz default now(),
  completed_at  timestamptz
);

-- RLS for lead_import_batches
alter table lead_import_batches enable row level security;

create policy "Users can view their workspace import batches"
  on lead_import_batches for select
  using (workspace_id in (
    select workspace_id from users where id = auth.uid()
  ));

create policy "Users can insert import batches in their workspace"
  on lead_import_batches for insert
  with check (workspace_id in (
    select workspace_id from users where id = auth.uid()
  ));

create policy "Users can update their workspace import batches"
  on lead_import_batches for update
  using (workspace_id in (
    select workspace_id from users where id = auth.uid()
  ));

create policy "Users can delete their workspace import batches"
  on lead_import_batches for delete
  using (workspace_id in (
    select workspace_id from users where id = auth.uid()
  ));

-- Add import_batch_id to leads
alter table leads add column import_batch_id uuid references lead_import_batches(id);
```

- [ ] **Step 2: Update schema.sql — add table definition after existing leads table**

Append at the end of `supabase/schema.sql`:

```sql
-- Import batches (migration 023)
create table lead_import_batches (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  file_name     text not null,
  status        text not null default 'pending'
                check (status in ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  total_rows    int not null default 0,
  created_count int not null default 0,
  updated_count int not null default 0,
  skipped_count int not null default 0,
  error_count   int not null default 0,
  errors        jsonb default '[]'::jsonb,
  config        jsonb not null default '{}'::jsonb,
  created_by    uuid references auth.users(id),
  created_at    timestamptz default now(),
  completed_at  timestamptz
);
```

And add to the leads table definition:

```sql
-- (in leads table) Added by migration 023
import_batch_id uuid references lead_import_batches(id),
```

- [ ] **Step 3: Add TypeScript types to `src/types/index.ts`**

Add `import_batch_id` to the `Lead` interface (after `closed_at`):

```typescript
  import_batch_id: string | null
```

Add new types after the `Lead` interface:

```typescript
export type ImportBatchStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'

export type ImportDedupStrategy = 'email' | 'phone' | 'email_and_phone' | 'none'

export type ImportDedupAction = 'skip' | 'update' | 'create'

export interface ImportConfig {
  mapping: Record<string, string>
  default_source: LeadSource
  default_status: LeadStatus
  batch_tags: string[]
  dedup_strategy: ImportDedupStrategy
  dedup_action: ImportDedupAction
}

export interface LeadImportBatch {
  id: string
  workspace_id: string
  file_name: string
  status: ImportBatchStatus
  total_rows: number
  created_count: number
  updated_count: number
  skipped_count: number
  error_count: number
  errors: ImportError[]
  config: ImportConfig
  created_by: string | null
  created_at: string
  completed_at: string | null
}

export interface ImportError {
  row: number
  field: string
  value: string
  reason: string
}

export interface ImportPreviewResult {
  to_create: number
  to_update: number
  to_skip: number
  errors: number
  error_details: ImportError[]
  sample_creates: Record<string, string>[]
  sample_updates: { before: Record<string, string>; after: Record<string, string> }[]
}
```

- [ ] **Step 4: Run the migration against Supabase**

```bash
npx supabase db push
```

Or apply manually in the Supabase SQL editor.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/023_lead_import_batches.sql supabase/schema.sql src/types/index.ts
git commit -m "feat(import): add lead_import_batches table + import types (T-031)"
```

---

## Task 2: Install PapaParse + CSV Parser Library

**Files:**
- Modify: `package.json`
- Create: `src/lib/leads/csv-parser.ts`

- [ ] **Step 1: Install PapaParse**

```bash
npm install papaparse
npm install -D @types/papaparse
```

- [ ] **Step 2: Create `src/lib/leads/csv-parser.ts`**

```typescript
import Papa from 'papaparse'

// ------------------------------------------------------------------
// Synonyms map: target field → known CSV header synonyms (FR + EN)
// ------------------------------------------------------------------
const COLUMN_SYNONYMS: Record<string, string[]> = {
  first_name:       ['prenom', 'prénom', 'first_name', 'firstname', 'first name', 'nom de bapteme'],
  last_name:        ['nom', 'nom de famille', 'last_name', 'lastname', 'last name', 'family name'],
  email:            ['email', 'e-mail', 'mail', 'adresse email', 'courriel'],
  phone:            ['telephone', 'téléphone', 'tel', 'phone', 'mobile', 'portable', 'numero', 'numéro'],
  instagram_handle: ['instagram', 'insta', 'ig', 'handle'],
  source:           ['source', 'origine', 'provenance', 'canal'],
  status:           ['statut', 'status', 'etat', 'état', 'pipeline'],
  tags:             ['tags', 'etiquettes', 'étiquettes', 'labels', 'categories', 'catégories'],
  notes:            ['notes', 'commentaires', 'remarques', 'description', 'observations'],
  created_at:       ['date', 'date de creation', 'date de création', 'created_at', 'cree le', 'créé le', 'ajoute le', 'ajouté le', 'date ajout'],
}

// All possible target fields
export const TARGET_FIELDS = Object.keys(COLUMN_SYNONYMS)

export type MappingConfidence = 'exact' | 'partial' | 'none'

export interface ColumnMapping {
  csvHeader: string
  targetField: string | null
  confidence: MappingConfidence
}

// ------------------------------------------------------------------
// Normalize: lowercase, trim, strip accents
// ------------------------------------------------------------------
function normalize(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

// ------------------------------------------------------------------
// Auto-map CSV headers to ClosRM fields
// ------------------------------------------------------------------
export function autoMapColumns(csvHeaders: string[]): ColumnMapping[] {
  const usedTargets = new Set<string>()

  return csvHeaders.map((header) => {
    const norm = normalize(header)

    // Pass 1: exact match
    for (const [target, synonyms] of Object.entries(COLUMN_SYNONYMS)) {
      if (usedTargets.has(target)) continue
      if (synonyms.some((s) => normalize(s) === norm)) {
        usedTargets.add(target)
        return { csvHeader: header, targetField: target, confidence: 'exact' as const }
      }
    }

    // Pass 2: inclusion match
    for (const [target, synonyms] of Object.entries(COLUMN_SYNONYMS)) {
      if (usedTargets.has(target)) continue
      if (synonyms.some((s) => norm.includes(normalize(s)) || normalize(s).includes(norm))) {
        usedTargets.add(target)
        return { csvHeader: header, targetField: target, confidence: 'partial' as const }
      }
    }

    return { csvHeader: header, targetField: null, confidence: 'none' as const }
  })
}

// ------------------------------------------------------------------
// Parse CSV file client-side
// ------------------------------------------------------------------
export interface CsvParseResult {
  headers: string[]
  rows: Record<string, string>[]
  totalRows: number
  detectedDelimiter: string
}

export function parseCsvFile(file: File): Promise<CsvParseResult> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      encoding: 'UTF-8',
      complete(results) {
        const headers = results.meta.fields || []
        const rows = results.data as Record<string, string>[]
        resolve({
          headers,
          rows,
          totalRows: rows.length,
          detectedDelimiter: results.meta.delimiter,
        })
      },
      error(err) {
        reject(new Error(`Erreur de parsing CSV : ${err.message}`))
      },
    })
  })
}

// ------------------------------------------------------------------
// Apply mapping: transform raw CSV rows to ClosRM lead objects
// ------------------------------------------------------------------
export function applyMapping(
  rows: Record<string, string>[],
  mapping: Record<string, string>, // csvHeader → targetField
): Record<string, string>[] {
  return rows.map((row) => {
    const mapped: Record<string, string> = {}
    for (const [csvHeader, targetField] of Object.entries(mapping)) {
      if (targetField && row[csvHeader] !== undefined) {
        mapped[targetField] = row[csvHeader]
      }
    }
    return mapped
  })
}
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json src/lib/leads/csv-parser.ts
git commit -m "feat(import): add PapaParse + CSV parser with auto-mapping (T-031)"
```

---

## Task 3: Import Engine (Server-Side)

**Files:**
- Create: `src/lib/leads/import-engine.ts`

- [ ] **Step 1: Create `src/lib/leads/import-engine.ts`**

```typescript
import { SupabaseClient } from '@supabase/supabase-js'
import { createLeadSchema } from '@/lib/validations/leads'
import { fireTriggersForEvent } from '@/lib/workflows/trigger'
import type {
  ImportConfig,
  ImportDedupStrategy,
  ImportError,
  ImportPreviewResult,
  LeadSource,
  LeadStatus,
} from '@/types'

// ------------------------------------------------------------------
// Phone normalization: keep digits and +
// ------------------------------------------------------------------
function normalizePhone(phone: string): string {
  return phone.replace(/[^\d+]/g, '')
}

// ------------------------------------------------------------------
// Email normalization
// ------------------------------------------------------------------
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

// ------------------------------------------------------------------
// Validate a single row with Zod, applying defaults from config
// ------------------------------------------------------------------
function validateRow(
  row: Record<string, string>,
  config: ImportConfig,
  rowIndex: number,
): { valid: boolean; data?: Record<string, unknown>; errors: ImportError[] } {
  const errors: ImportError[] = []

  // Prepare data with defaults
  const prepared: Record<string, unknown> = {
    first_name: row.first_name || '',
    last_name: row.last_name || '',
    phone: row.phone ? normalizePhone(row.phone) : '',
    email: row.email ? normalizeEmail(row.email) : '',
    source: row.source || config.default_source,
    status: row.status || config.default_status,
    instagram_handle: row.instagram_handle
      ? row.instagram_handle.replace(/^@/, '')
      : '',
    tags: row.tags
      ? row.tags.split(';').map((t: string) => t.trim()).filter(Boolean)
      : [],
    notes: row.notes || '',
  }

  // Add batch tags
  if (config.batch_tags.length > 0) {
    prepared.tags = [...(prepared.tags as string[]), ...config.batch_tags]
  }

  // Validate source against enum
  const validSources: LeadSource[] = ['facebook_ads', 'instagram_ads', 'follow_ads', 'formulaire', 'manuel', 'funnel']
  if (!validSources.includes(prepared.source as LeadSource)) {
    prepared.source = config.default_source
  }

  // Validate status against enum
  const validStatuses: LeadStatus[] = ['nouveau', 'setting_planifie', 'no_show_setting', 'closing_planifie', 'no_show_closing', 'clos', 'dead']
  if (!validStatuses.includes(prepared.status as LeadStatus)) {
    prepared.status = config.default_status
  }

  const parsed = createLeadSchema.safeParse(prepared)
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      errors.push({
        row: rowIndex + 1,
        field: issue.path.join('.') || 'unknown',
        value: String(row[issue.path[0] as string] || ''),
        reason: issue.message,
      })
    }
    return { valid: false, errors }
  }

  return { valid: true, data: parsed.data as Record<string, unknown>, errors: [] }
}

// ------------------------------------------------------------------
// Find duplicates based on dedup strategy
// ------------------------------------------------------------------
async function findDuplicate(
  supabase: SupabaseClient,
  workspaceId: string,
  row: Record<string, unknown>,
  strategy: ImportDedupStrategy,
): Promise<Record<string, unknown> | null> {
  if (strategy === 'none') return null

  let query = supabase
    .from('leads')
    .select('*')
    .eq('workspace_id', workspaceId)

  if (strategy === 'email' || strategy === 'email_and_phone') {
    const email = row.email as string
    if (!email) return null
    query = query.eq('email', email)
  }

  if (strategy === 'phone' || strategy === 'email_and_phone') {
    const phone = row.phone as string
    if (!phone) return null
    query = query.eq('phone', phone)
  }

  const { data } = await query.limit(1).single()
  return data
}

// ------------------------------------------------------------------
// Preview: dry-run the import and return diff stats
// ------------------------------------------------------------------
export async function previewImport(
  supabase: SupabaseClient,
  workspaceId: string,
  rows: Record<string, string>[],
  config: ImportConfig,
): Promise<ImportPreviewResult> {
  let toCreate = 0
  let toUpdate = 0
  let toSkip = 0
  const errorDetails: ImportError[] = []
  const sampleCreates: Record<string, string>[] = []
  const sampleUpdates: { before: Record<string, string>; after: Record<string, string> }[] = []

  for (let i = 0; i < rows.length; i++) {
    const { valid, data, errors } = validateRow(rows[i], config, i)

    if (!valid) {
      errorDetails.push(...errors)
      continue
    }

    const existing = await findDuplicate(supabase, workspaceId, data!, config.dedup_strategy)

    if (existing) {
      if (config.dedup_action === 'skip') {
        toSkip++
      } else if (config.dedup_action === 'update') {
        toUpdate++
        if (sampleUpdates.length < 5) {
          sampleUpdates.push({
            before: existing as Record<string, string>,
            after: data as Record<string, string>,
          })
        }
      } else {
        // dedup_action === 'create'
        toCreate++
        if (sampleCreates.length < 5) {
          sampleCreates.push(data as Record<string, string>)
        }
      }
    } else {
      toCreate++
      if (sampleCreates.length < 5) {
        sampleCreates.push(data as Record<string, string>)
      }
    }
  }

  return {
    to_create: toCreate,
    to_update: toUpdate,
    to_skip: toSkip,
    errors: errorDetails.length,
    error_details: errorDetails,
    sample_creates: sampleCreates,
    sample_updates: sampleUpdates,
  }
}

// ------------------------------------------------------------------
// Execute import: insert/update leads in chunks
// ------------------------------------------------------------------
export async function executeImport(
  supabase: SupabaseClient,
  workspaceId: string,
  batchId: string,
  rows: Record<string, string>[],
  config: ImportConfig,
): Promise<void> {
  let createdCount = 0
  let updatedCount = 0
  let skippedCount = 0
  const allErrors: ImportError[] = []

  const CHUNK_SIZE = 100

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE)
    const toInsert: Record<string, unknown>[] = []

    for (let j = 0; j < chunk.length; j++) {
      const rowIndex = i + j
      const { valid, data, errors } = validateRow(chunk[j], config, rowIndex)

      if (!valid) {
        allErrors.push(...errors)
        continue
      }

      const existing = await findDuplicate(supabase, workspaceId, data!, config.dedup_strategy)

      if (existing) {
        if (config.dedup_action === 'skip') {
          skippedCount++
        } else if (config.dedup_action === 'update') {
          // Update only non-empty fields
          const updateData: Record<string, unknown> = {}
          for (const [key, value] of Object.entries(data!)) {
            if (value !== '' && value !== null && value !== undefined) {
              updateData[key] = value
            }
          }
          await supabase
            .from('leads')
            .update(updateData)
            .eq('id', (existing as Record<string, string>).id)
          updatedCount++
        } else {
          // create anyway
          toInsert.push({
            ...data,
            workspace_id: workspaceId,
            import_batch_id: batchId,
            call_attempts: 0,
            reached: false,
          })
        }
      } else {
        toInsert.push({
          ...data,
          workspace_id: workspaceId,
          import_batch_id: batchId,
          call_attempts: 0,
          reached: false,
        })
      }
    }

    // Bulk insert the chunk
    if (toInsert.length > 0) {
      const { error } = await supabase.from('leads').insert(toInsert)
      if (error) {
        allErrors.push({
          row: i + 1,
          field: 'batch',
          value: '',
          reason: `Erreur d'insertion batch : ${error.message}`,
        })
      } else {
        createdCount += toInsert.length
      }
    }

    // Update batch progress
    await supabase
      .from('lead_import_batches')
      .update({
        created_count: createdCount,
        updated_count: updatedCount,
        skipped_count: skippedCount,
        error_count: allErrors.length,
        errors: allErrors,
      })
      .eq('id', batchId)
  }

  // Finalize batch
  await supabase
    .from('lead_import_batches')
    .update({
      status: allErrors.length > 0 && createdCount === 0 && updatedCount === 0 ? 'failed' : 'completed',
      created_count: createdCount,
      updated_count: updatedCount,
      skipped_count: skippedCount,
      error_count: allErrors.length,
      errors: allErrors,
      completed_at: new Date().toISOString(),
    })
    .eq('id', batchId)

  // Fire workflow trigger
  fireTriggersForEvent(workspaceId, 'lead_imported', {
    batch_id: batchId,
    lead_count: createdCount + updatedCount,
    source: config.default_source,
  }).catch(() => {})
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/leads/import-engine.ts
git commit -m "feat(import): add import engine — dedup, validation, batch insert (T-031)"
```

---

## Task 4: API Routes

**Files:**
- Create: `src/app/api/leads/import/preview/route.ts`
- Create: `src/app/api/leads/import/route.ts`
- Create: `src/app/api/leads/import/[batchId]/route.ts`
- Create: `src/app/api/leads/import/history/route.ts`

- [ ] **Step 1: Create `src/app/api/leads/import/preview/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { createClient } from '@/lib/supabase/server'
import { previewImport } from '@/lib/leads/import-engine'
import type { ImportConfig } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const body = await request.json()

    const { rows, config } = body as { rows: Record<string, string>[]; config: ImportConfig }

    if (!rows || !Array.isArray(rows)) {
      return NextResponse.json({ error: 'Données manquantes' }, { status: 400 })
    }

    if (rows.length > 5000) {
      return NextResponse.json({ error: 'Maximum 5 000 lignes par import' }, { status: 400 })
    }

    const result = await previewImport(supabase, workspaceId, rows, config)

    return NextResponse.json({ data: result })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Create `src/app/api/leads/import/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { createClient } from '@/lib/supabase/server'
import { executeImport } from '@/lib/leads/import-engine'
import type { ImportConfig } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const { workspaceId, userId } = await getWorkspaceId()
    const supabase = await createClient()
    const body = await request.json()

    const { rows, config, fileName } = body as {
      rows: Record<string, string>[]
      config: ImportConfig
      fileName: string
    }

    if (!rows || !Array.isArray(rows)) {
      return NextResponse.json({ error: 'Données manquantes' }, { status: 400 })
    }

    if (rows.length > 5000) {
      return NextResponse.json({ error: 'Maximum 5 000 lignes par import' }, { status: 400 })
    }

    // Create batch record
    const { data: batch, error: batchError } = await supabase
      .from('lead_import_batches')
      .insert({
        workspace_id: workspaceId,
        file_name: fileName || 'import.csv',
        status: 'processing',
        total_rows: rows.length,
        config,
        created_by: userId,
      })
      .select()
      .single()

    if (batchError || !batch) {
      return NextResponse.json({ error: 'Impossible de créer le batch' }, { status: 500 })
    }

    // Execute import (non-blocking for large datasets)
    // For V1 we run inline — the client handles chunking if > 2000 rows
    await executeImport(supabase, workspaceId, batch.id, rows, config)

    // Fetch final batch state
    const { data: finalBatch } = await supabase
      .from('lead_import_batches')
      .select('*')
      .eq('id', batch.id)
      .single()

    return NextResponse.json({ data: finalBatch }, { status: 201 })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Create `src/app/api/leads/import/[batchId]/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const { batchId } = await params

    const { data, error } = await supabase
      .from('lead_import_batches')
      .select('*')
      .eq('id', batchId)
      .eq('workspace_id', workspaceId)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Batch non trouvé' }, { status: 404 })
    }

    return NextResponse.json({ data })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const { batchId } = await params

    // Verify batch exists and belongs to workspace
    const { data: batch, error: batchError } = await supabase
      .from('lead_import_batches')
      .select('*')
      .eq('id', batchId)
      .eq('workspace_id', workspaceId)
      .single()

    if (batchError || !batch) {
      return NextResponse.json({ error: 'Batch non trouvé' }, { status: 404 })
    }

    // Find leads that have calls or follow-ups (can't delete)
    const { data: protectedLeads } = await supabase
      .from('leads')
      .select('id, calls(id), follow_ups(id)')
      .eq('import_batch_id', batchId)
      .eq('workspace_id', workspaceId)

    const deletableIds: string[] = []
    const protectedCount = (protectedLeads || []).filter((lead) => {
      const hasCalls = Array.isArray(lead.calls) && lead.calls.length > 0
      const hasFollowUps = Array.isArray(lead.follow_ups) && lead.follow_ups.length > 0
      if (hasCalls || hasFollowUps) return true
      deletableIds.push(lead.id)
      return false
    }).length

    // Delete eligible leads
    if (deletableIds.length > 0) {
      await supabase
        .from('leads')
        .delete()
        .in('id', deletableIds)
    }

    // Update batch status
    await supabase
      .from('lead_import_batches')
      .update({ status: 'cancelled' })
      .eq('id', batchId)

    return NextResponse.json({
      data: {
        deleted: deletableIds.length,
        protected: protectedCount,
        message: protectedCount > 0
          ? `${deletableIds.length} leads supprimés. ${protectedCount} leads conservés car ils ont des appels ou follow-ups.`
          : `${deletableIds.length} leads supprimés.`,
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

- [ ] **Step 4: Create `src/app/api/leads/import/history/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('lead_import_batches')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: data || [] })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/leads/import/
git commit -m "feat(import): add API routes — preview, import, batch status, history (T-031)"
```

---

## Task 5: Import Wizard — Page + Stepper + State Machine

**Files:**
- Create: `src/app/(dashboard)/leads/import/page.tsx`
- Create: `src/app/(dashboard)/leads/import/import-client.tsx`
- Create: `src/components/leads/import/ImportStepper.tsx`

- [ ] **Step 1: Create `src/app/(dashboard)/leads/import/page.tsx`**

```typescript
import ImportClient from './import-client'

export default function ImportPage() {
  return <ImportClient />
}
```

- [ ] **Step 2: Create `src/components/leads/import/ImportStepper.tsx`**

```typescript
'use client'

import { Check } from 'lucide-react'

const STEPS = [
  'Upload & Aperçu',
  'Mapping & Config',
  'Vérification',
  'Import',
  'Récapitulatif',
]

interface ImportStepperProps {
  currentStep: number
}

export default function ImportStepper({ currentStep }: ImportStepperProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 32 }}>
      {STEPS.map((label, index) => {
        const isActive = index === currentStep
        const isDone = index < currentStep
        const isFuture = index > currentStep

        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center', flex: index < STEPS.length - 1 ? 1 : undefined }}>
            {/* Circle */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 32, height: 32, borderRadius: '50%',
              fontSize: 13, fontWeight: 600,
              background: isDone ? '#38A169' : isActive ? '#E53E3E' : '#262626',
              color: isFuture ? '#666' : '#fff',
              flexShrink: 0,
            }}>
              {isDone ? <Check size={16} /> : index + 1}
            </div>
            {/* Label */}
            <span style={{
              marginLeft: 8, fontSize: 13, fontWeight: isActive ? 600 : 400,
              color: isFuture ? '#666' : isActive ? '#fff' : '#A0A0A0',
              whiteSpace: 'nowrap',
            }}>
              {label}
            </span>
            {/* Connector line */}
            {index < STEPS.length - 1 && (
              <div style={{
                flex: 1, height: 2, marginLeft: 12, marginRight: 12,
                background: isDone ? '#38A169' : '#262626',
              }} />
            )}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 3: Create `src/app/(dashboard)/leads/import/import-client.tsx`**

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import ImportStepper from '@/components/leads/import/ImportStepper'
import Step1_UploadPreview from '@/components/leads/import/Step1_UploadPreview'
import Step2_MappingConfig from '@/components/leads/import/Step2_MappingConfig'
import Step3_PreviewDiff from '@/components/leads/import/Step3_PreviewDiff'
import Step4_ImportProgress from '@/components/leads/import/Step4_ImportProgress'
import Step5_Recap from '@/components/leads/import/Step5_Recap'
import type { ColumnMapping } from '@/lib/leads/csv-parser'
import type { ImportConfig, ImportPreviewResult, LeadImportBatch } from '@/types'

export interface WizardState {
  // Step 1
  fileName: string
  headers: string[]
  rows: Record<string, string>[]
  totalRows: number
  detectedDelimiter: string
  columnMappings: ColumnMapping[]
  // Step 2
  config: ImportConfig
  mappedRows: Record<string, string>[]
  // Step 3
  previewResult: ImportPreviewResult | null
  // Step 4-5
  batch: LeadImportBatch | null
}

const INITIAL_CONFIG: ImportConfig = {
  mapping: {},
  default_source: 'manuel',
  default_status: 'nouveau',
  batch_tags: [],
  dedup_strategy: 'email',
  dedup_action: 'skip',
}

export default function ImportClient() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [state, setState] = useState<WizardState>({
    fileName: '',
    headers: [],
    rows: [],
    totalRows: 0,
    detectedDelimiter: ',',
    columnMappings: [],
    config: INITIAL_CONFIG,
    mappedRows: [],
    previewResult: null,
    batch: null,
  })

  const updateState = (partial: Partial<WizardState>) => {
    setState((prev) => ({ ...prev, ...partial }))
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', margin: 0 }}>
          Importer des leads
        </h1>
        <button
          onClick={() => router.push('/leads')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 8, fontSize: 13,
            background: 'transparent', border: '1px solid #333',
            color: '#A0A0A0', cursor: 'pointer',
          }}
        >
          <X size={14} />
          Annuler
        </button>
      </div>

      {/* Stepper */}
      <ImportStepper currentStep={step} />

      {/* Step content */}
      {step === 0 && (
        <Step1_UploadPreview
          state={state}
          updateState={updateState}
          onNext={() => setStep(1)}
        />
      )}
      {step === 1 && (
        <Step2_MappingConfig
          state={state}
          updateState={updateState}
          onBack={() => setStep(0)}
          onNext={() => setStep(2)}
        />
      )}
      {step === 2 && (
        <Step3_PreviewDiff
          state={state}
          updateState={updateState}
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
        />
      )}
      {step === 3 && (
        <Step4_ImportProgress
          state={state}
          updateState={updateState}
          onNext={() => setStep(4)}
        />
      )}
      {step === 4 && (
        <Step5_Recap
          state={state}
          updateState={updateState}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/leads/import/ src/components/leads/import/ImportStepper.tsx
git commit -m "feat(import): add wizard page, stepper, and state machine (T-031)"
```

---

## Task 6: Step 1 — Upload & Preview

**Files:**
- Create: `src/components/leads/import/Step1_UploadPreview.tsx`

- [ ] **Step 1: Create `src/components/leads/import/Step1_UploadPreview.tsx`**

```typescript
'use client'

import { useCallback, useRef } from 'react'
import { Upload, FileText, ArrowRight } from 'lucide-react'
import { parseCsvFile, autoMapColumns } from '@/lib/leads/csv-parser'
import type { WizardState } from '@/app/(dashboard)/leads/import/import-client'

interface Props {
  state: WizardState
  updateState: (partial: Partial<WizardState>) => void
  onNext: () => void
}

const MAX_SIZE = 5 * 1024 * 1024 // 5 MB
const MAX_ROWS = 5000

export default function Step1_UploadPreview({ state, updateState, onNext }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.csv')) {
      alert('Seuls les fichiers CSV sont acceptés.')
      return
    }
    if (file.size > MAX_SIZE) {
      alert('Le fichier dépasse 5 Mo.')
      return
    }

    const result = await parseCsvFile(file)

    if (result.totalRows > MAX_ROWS) {
      alert(`Le fichier contient ${result.totalRows} lignes. Maximum : ${MAX_ROWS}.`)
      return
    }

    const mappings = autoMapColumns(result.headers)

    updateState({
      fileName: file.name,
      headers: result.headers,
      rows: result.rows,
      totalRows: result.totalRows,
      detectedDelimiter: result.detectedDelimiter,
      columnMappings: mappings,
    })
  }, [updateState])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }, [handleFile])

  const previewRows = state.rows.slice(0, 10)
  const hasFile = state.totalRows > 0

  return (
    <div>
      {/* Drop zone */}
      {!hasFile && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: '2px dashed #333', borderRadius: 12, padding: '60px 40px',
            textAlign: 'center', cursor: 'pointer', background: '#141414',
            transition: 'border-color 0.2s',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = '#E53E3E' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = '#333' }}
        >
          <Upload size={40} color="#666" style={{ marginBottom: 12 }} />
          <p style={{ fontSize: 15, color: '#fff', fontWeight: 600, margin: '0 0 6px' }}>
            Glissez votre fichier CSV ici ou cliquez pour sélectionner
          </p>
          <p style={{ fontSize: 13, color: '#666', margin: 0 }}>
            CSV uniquement — 5 Mo max — 5 000 lignes max
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleInputChange}
            style={{ display: 'none' }}
          />
        </div>
      )}

      {/* File info + preview */}
      {hasFile && (
        <>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20,
            padding: '12px 16px', background: '#141414', borderRadius: 8, border: '1px solid #262626',
          }}>
            <FileText size={18} color="#E53E3E" />
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#fff', margin: 0 }}>{state.fileName}</p>
              <p style={{ fontSize: 12, color: '#A0A0A0', margin: 0 }}>
                {state.totalRows} lignes — séparateur : « {state.detectedDelimiter === ',' ? ',' : state.detectedDelimiter === ';' ? ';' : 'tab'} »
              </p>
            </div>
            <button
              onClick={() => {
                updateState({ fileName: '', headers: [], rows: [], totalRows: 0, columnMappings: [] })
              }}
              style={{
                padding: '6px 12px', borderRadius: 6, fontSize: 12,
                background: 'transparent', border: '1px solid #333', color: '#A0A0A0', cursor: 'pointer',
              }}
            >
              Changer de fichier
            </button>
          </div>

          {/* Preview table */}
          <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid #262626' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {state.headers.map((h) => (
                    <th key={h} style={{
                      padding: '10px 14px', textAlign: 'left', fontWeight: 600,
                      color: '#fff', background: '#1a1a1a', borderBottom: '1px solid #262626',
                      whiteSpace: 'nowrap',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, i) => (
                  <tr key={i}>
                    {state.headers.map((h) => (
                      <td key={h} style={{
                        padding: '8px 14px', color: '#A0A0A0', borderBottom: '1px solid #1a1a1a',
                        whiteSpace: 'nowrap', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {row[h] || '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {state.totalRows > 10 && (
            <p style={{ fontSize: 12, color: '#666', marginTop: 8 }}>
              Aperçu des 10 premières lignes sur {state.totalRows}
            </p>
          )}

          {/* Next button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
            <button onClick={onNext} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600,
              background: '#E53E3E', border: 'none', color: '#000', cursor: 'pointer',
            }}>
              Continuer
              <ArrowRight size={16} />
            </button>
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/leads/import/Step1_UploadPreview.tsx
git commit -m "feat(import): add Step 1 — CSV upload & preview (T-031)"
```

---

## Task 7: Step 2 — Mapping & Config

**Files:**
- Create: `src/components/leads/import/Step2_MappingConfig.tsx`

- [ ] **Step 1: Create `src/components/leads/import/Step2_MappingConfig.tsx`**

```typescript
'use client'

import { useMemo } from 'react'
import { ArrowLeft, ArrowRight, Circle } from 'lucide-react'
import { TARGET_FIELDS, applyMapping } from '@/lib/leads/csv-parser'
import type { ColumnMapping } from '@/lib/leads/csv-parser'
import type { WizardState } from '@/app/(dashboard)/leads/import/import-client'
import type { ImportDedupAction, ImportDedupStrategy, LeadSource, LeadStatus } from '@/types'

interface Props {
  state: WizardState
  updateState: (partial: Partial<WizardState>) => void
  onBack: () => void
  onNext: () => void
}

const FIELD_LABELS: Record<string, string> = {
  first_name: 'Prénom',
  last_name: 'Nom',
  email: 'Email',
  phone: 'Téléphone',
  instagram_handle: 'Instagram',
  source: 'Source',
  status: 'Statut',
  tags: 'Tags',
  notes: 'Notes',
  created_at: 'Date de création',
}

const CONFIDENCE_COLORS: Record<string, string> = {
  exact: '#38A169',
  partial: '#D69E2E',
  none: '#666',
}

const SOURCE_OPTIONS: { value: LeadSource; label: string }[] = [
  { value: 'manuel', label: 'Manuel' },
  { value: 'facebook_ads', label: 'Facebook Ads' },
  { value: 'instagram_ads', label: 'Instagram Ads' },
  { value: 'follow_ads', label: 'Follow Ads' },
  { value: 'formulaire', label: 'Formulaire' },
  { value: 'funnel', label: 'Funnel' },
]

const STATUS_OPTIONS: { value: LeadStatus; label: string }[] = [
  { value: 'nouveau', label: 'Nouveau' },
  { value: 'setting_planifie', label: 'Setting planifié' },
  { value: 'closing_planifie', label: 'Closing planifié' },
  { value: 'clos', label: 'Closé' },
  { value: 'dead', label: 'Dead' },
]

const selectStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: 6, fontSize: 13,
  background: '#1a1a1a', border: '1px solid #333', color: '#fff',
  cursor: 'pointer',
}

const labelStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: '#A0A0A0', marginBottom: 6, display: 'block',
}

export default function Step2_MappingConfig({ state, updateState, onBack, onNext }: Props) {
  const { columnMappings, config } = state

  const hasRequiredField = useMemo(() => {
    return columnMappings.some(
      (m) => m.targetField === 'email' || m.targetField === 'phone'
    )
  }, [columnMappings])

  const updateMapping = (index: number, targetField: string | null) => {
    const updated = [...columnMappings]
    updated[index] = { ...updated[index], targetField, confidence: targetField ? 'exact' : 'none' }
    updateState({ columnMappings: updated })
  }

  const updateConfig = (partial: Partial<typeof config>) => {
    updateState({ config: { ...config, ...partial } })
  }

  const handleNext = () => {
    // Build mapping record and apply
    const mapping: Record<string, string> = {}
    for (const m of columnMappings) {
      if (m.targetField) mapping[m.csvHeader] = m.targetField
    }
    const mappedRows = applyMapping(state.rows, mapping)
    updateState({ config: { ...config, mapping }, mappedRows })
    onNext()
  }

  // Track which target fields are already used
  const usedTargets = new Set(columnMappings.map((m) => m.targetField).filter(Boolean))

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 32 }}>
        {/* Left: Mapping */}
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 16 }}>
            Mapping des colonnes
          </h2>
          <div style={{ borderRadius: 8, border: '1px solid #262626', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#A0A0A0', background: '#1a1a1a' }}>
                    Colonne CSV
                  </th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#A0A0A0', background: '#1a1a1a', width: 200 }}>
                    Champ ClosRM
                  </th>
                  <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600, color: '#A0A0A0', background: '#1a1a1a', width: 40 }} />
                </tr>
              </thead>
              <tbody>
                {columnMappings.map((m, i) => (
                  <tr key={m.csvHeader} style={{ borderBottom: '1px solid #1a1a1a' }}>
                    <td style={{ padding: '8px 14px', color: '#fff' }}>{m.csvHeader}</td>
                    <td style={{ padding: '8px 14px' }}>
                      <select
                        value={m.targetField || ''}
                        onChange={(e) => updateMapping(i, e.target.value || null)}
                        style={{
                          ...selectStyle,
                          color: m.targetField ? '#fff' : '#666',
                        }}
                      >
                        <option value="">— Ignorer —</option>
                        {TARGET_FIELDS.map((f) => (
                          <option key={f} value={f} disabled={usedTargets.has(f) && f !== m.targetField}>
                            {FIELD_LABELS[f] || f}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: '8px 14px', textAlign: 'center' }}>
                      <Circle
                        size={10}
                        fill={CONFIDENCE_COLORS[m.confidence]}
                        color={CONFIDENCE_COLORS[m.confidence]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!hasRequiredField && (
            <p style={{ fontSize: 12, color: '#E53E3E', marginTop: 8 }}>
              Au moins « Email » ou « Téléphone » doit être mappé pour continuer.
            </p>
          )}
        </div>

        {/* Right: Config */}
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 16 }}>
            Configuration
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={labelStyle}>Source par défaut</label>
              <select
                value={config.default_source}
                onChange={(e) => updateConfig({ default_source: e.target.value as LeadSource })}
                style={selectStyle}
              >
                {SOURCE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Statut par défaut</label>
              <select
                value={config.default_status}
                onChange={(e) => updateConfig({ default_status: e.target.value as LeadStatus })}
                style={selectStyle}
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Tags à appliquer au batch</label>
              <input
                type="text"
                placeholder="Ex: import-avril, prospect"
                value={config.batch_tags.join(', ')}
                onChange={(e) => updateConfig({
                  batch_tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean),
                })}
                style={{ ...selectStyle, cursor: 'text' }}
              />
              <p style={{ fontSize: 11, color: '#666', marginTop: 4 }}>Séparez les tags par des virgules</p>
            </div>

            <div>
              <label style={labelStyle}>Stratégie de déduplication</label>
              {(['email', 'phone', 'email_and_phone', 'none'] as ImportDedupStrategy[]).map((s) => (
                <label key={s} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0',
                  fontSize: 13, color: '#fff', cursor: 'pointer',
                }}>
                  <input
                    type="radio"
                    name="dedup_strategy"
                    checked={config.dedup_strategy === s}
                    onChange={() => updateConfig({ dedup_strategy: s })}
                    style={{ accentColor: '#E53E3E' }}
                  />
                  {{ email: 'Par email', phone: 'Par téléphone', email_and_phone: 'Email + téléphone', none: 'Aucune' }[s]}
                </label>
              ))}
            </div>

            <div>
              <label style={labelStyle}>En cas de doublon</label>
              {(['skip', 'update', 'create'] as ImportDedupAction[]).map((a) => (
                <label key={a} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0',
                  fontSize: 13, color: '#fff', cursor: 'pointer',
                }}>
                  <input
                    type="radio"
                    name="dedup_action"
                    checked={config.dedup_action === a}
                    onChange={() => updateConfig({ dedup_action: a })}
                    style={{ accentColor: '#E53E3E' }}
                  />
                  {{ skip: 'Ignorer (garder l\'existant)', update: 'Mettre à jour', create: 'Créer quand même' }[a]}
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 32 }}>
        <button onClick={onBack} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '10px 20px', borderRadius: 8, fontSize: 14,
          background: 'transparent', border: '1px solid #333', color: '#A0A0A0', cursor: 'pointer',
        }}>
          <ArrowLeft size={16} />
          Retour
        </button>
        <button
          onClick={handleNext}
          disabled={!hasRequiredField}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '10px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600,
            background: hasRequiredField ? '#E53E3E' : '#333', border: 'none',
            color: hasRequiredField ? '#000' : '#666', cursor: hasRequiredField ? 'pointer' : 'not-allowed',
          }}
        >
          Continuer
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/leads/import/Step2_MappingConfig.tsx
git commit -m "feat(import): add Step 2 — column mapping & dedup config (T-031)"
```

---

## Task 8: Step 3 — Preview Diff

**Files:**
- Create: `src/components/leads/import/Step3_PreviewDiff.tsx`

- [ ] **Step 1: Create `src/components/leads/import/Step3_PreviewDiff.tsx`**

```typescript
'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react'
import type { WizardState } from '@/app/(dashboard)/leads/import/import-client'
import type { ImportPreviewResult } from '@/types'

interface Props {
  state: WizardState
  updateState: (partial: Partial<WizardState>) => void
  onBack: () => void
  onNext: () => void
}

type Tab = 'create' | 'update' | 'skip' | 'errors'

const COUNTER_STYLES: Record<Tab, { bg: string; color: string; label: string }> = {
  create:  { bg: '#38A16920', color: '#38A169', label: 'À créer' },
  update:  { bg: '#3B82F620', color: '#3B82F6', label: 'À mettre à jour' },
  skip:    { bg: '#66666620', color: '#666', label: 'Ignorés' },
  errors:  { bg: '#E53E3E20', color: '#E53E3E', label: 'Erreurs' },
}

export default function Step3_PreviewDiff({ state, updateState, onBack, onNext }: Props) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('create')

  useEffect(() => {
    const fetchPreview = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/leads/import/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: state.mappedRows, config: state.config }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Erreur serveur')
        updateState({ previewResult: json.data as ImportPreviewResult })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur inconnue')
      } finally {
        setLoading(false)
      }
    }
    fetchPreview()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const preview = state.previewResult

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0' }}>
        <Loader2 size={32} color="#E53E3E" style={{ animation: 'spin 1s linear infinite' }} />
        <p style={{ fontSize: 14, color: '#A0A0A0', marginTop: 12 }}>Analyse en cours...</p>
        <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0' }}>
        <p style={{ fontSize: 14, color: '#E53E3E' }}>{error}</p>
        <button onClick={onBack} style={{
          marginTop: 16, padding: '10px 20px', borderRadius: 8, fontSize: 14,
          background: 'transparent', border: '1px solid #333', color: '#A0A0A0', cursor: 'pointer',
        }}>
          Retour
        </button>
      </div>
    )
  }

  if (!preview) return null

  const counts: Record<Tab, number> = {
    create: preview.to_create,
    update: preview.to_update,
    skip: preview.to_skip,
    errors: preview.errors,
  }

  return (
    <div>
      {/* Counters */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {(Object.keys(COUNTER_STYLES) as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '16px', borderRadius: 10, textAlign: 'center', cursor: 'pointer',
              background: COUNTER_STYLES[tab].bg,
              border: activeTab === tab ? `2px solid ${COUNTER_STYLES[tab].color}` : '2px solid transparent',
            }}
          >
            <p style={{ fontSize: 28, fontWeight: 700, color: COUNTER_STYLES[tab].color, margin: 0 }}>
              {counts[tab]}
            </p>
            <p style={{ fontSize: 12, color: COUNTER_STYLES[tab].color, margin: '4px 0 0' }}>
              {COUNTER_STYLES[tab].label}
            </p>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{
        background: '#141414', borderRadius: 8, border: '1px solid #262626',
        padding: 16, minHeight: 200,
      }}>
        {activeTab === 'create' && preview.sample_creates.length > 0 && (
          <div>
            <p style={{ fontSize: 13, color: '#A0A0A0', marginBottom: 12 }}>
              Exemples de leads à créer :
            </p>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {Object.keys(preview.sample_creates[0]).map((k) => (
                    <th key={k} style={{ padding: '8px 12px', textAlign: 'left', color: '#A0A0A0', borderBottom: '1px solid #262626' }}>{k}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.sample_creates.map((row, i) => (
                  <tr key={i}>
                    {Object.values(row).map((v, j) => (
                      <td key={j} style={{ padding: '8px 12px', color: '#fff', borderBottom: '1px solid #1a1a1a' }}>{v || '—'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'update' && preview.sample_updates.length > 0 && (
          <div>
            <p style={{ fontSize: 13, color: '#A0A0A0', marginBottom: 12 }}>
              Exemples de mises à jour :
            </p>
            {preview.sample_updates.map((u, i) => (
              <div key={i} style={{ marginBottom: 16, padding: 12, background: '#1a1a1a', borderRadius: 6 }}>
                <p style={{ fontSize: 12, color: '#3B82F6', marginBottom: 8 }}>Mise à jour #{i + 1}</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
                  <div>
                    <p style={{ color: '#666', marginBottom: 4 }}>Avant</p>
                    {Object.entries(u.before).slice(0, 5).map(([k, v]) => (
                      <p key={k} style={{ color: '#A0A0A0', margin: '2px 0' }}>{k}: {v}</p>
                    ))}
                  </div>
                  <div>
                    <p style={{ color: '#3B82F6', marginBottom: 4 }}>Après</p>
                    {Object.entries(u.after).map(([k, v]) => (
                      <p key={k} style={{ color: '#fff', margin: '2px 0' }}>{k}: {v}</p>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'errors' && preview.error_details.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ padding: '8px 12px', textAlign: 'left', color: '#A0A0A0', borderBottom: '1px solid #262626' }}>Ligne</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', color: '#A0A0A0', borderBottom: '1px solid #262626' }}>Champ</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', color: '#A0A0A0', borderBottom: '1px solid #262626' }}>Valeur</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', color: '#A0A0A0', borderBottom: '1px solid #262626' }}>Raison</th>
              </tr>
            </thead>
            <tbody>
              {preview.error_details.map((e, i) => (
                <tr key={i}>
                  <td style={{ padding: '8px 12px', color: '#E53E3E', borderBottom: '1px solid #1a1a1a' }}>{e.row}</td>
                  <td style={{ padding: '8px 12px', color: '#fff', borderBottom: '1px solid #1a1a1a' }}>{e.field}</td>
                  <td style={{ padding: '8px 12px', color: '#A0A0A0', borderBottom: '1px solid #1a1a1a' }}>{e.value || '—'}</td>
                  <td style={{ padding: '8px 12px', color: '#A0A0A0', borderBottom: '1px solid #1a1a1a' }}>{e.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {activeTab === 'skip' && (
          <p style={{ fontSize: 13, color: '#666', textAlign: 'center', padding: 24 }}>
            {preview.to_skip > 0
              ? `${preview.to_skip} lignes seront ignorées (doublons détectés).`
              : 'Aucun doublon détecté.'}
          </p>
        )}

        {counts[activeTab] === 0 && activeTab !== 'skip' && (
          <p style={{ fontSize: 13, color: '#666', textAlign: 'center', padding: 24 }}>
            Aucun élément dans cette catégorie.
          </p>
        )}
      </div>

      {/* Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 32 }}>
        <button onClick={onBack} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '10px 20px', borderRadius: 8, fontSize: 14,
          background: 'transparent', border: '1px solid #333', color: '#A0A0A0', cursor: 'pointer',
        }}>
          <ArrowLeft size={16} />
          Retour
        </button>
        <button
          onClick={onNext}
          disabled={preview.to_create === 0 && preview.to_update === 0}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '10px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600,
            background: (preview.to_create > 0 || preview.to_update > 0) ? '#E53E3E' : '#333',
            border: 'none',
            color: (preview.to_create > 0 || preview.to_update > 0) ? '#000' : '#666',
            cursor: (preview.to_create > 0 || preview.to_update > 0) ? 'pointer' : 'not-allowed',
          }}
        >
          Lancer l'import
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/leads/import/Step3_PreviewDiff.tsx
git commit -m "feat(import): add Step 3 — preview diff with counters & tabs (T-031)"
```

---

## Task 9: Step 4 — Import Progress

**Files:**
- Create: `src/components/leads/import/Step4_ImportProgress.tsx`

- [ ] **Step 1: Create `src/components/leads/import/Step4_ImportProgress.tsx`**

```typescript
'use client'

import { useState, useEffect, useRef } from 'react'
import { Loader2, CheckCircle2 } from 'lucide-react'
import type { WizardState } from '@/app/(dashboard)/leads/import/import-client'
import type { LeadImportBatch } from '@/types'

interface Props {
  state: WizardState
  updateState: (partial: Partial<WizardState>) => void
  onNext: () => void
}

const CHUNK_SIZE = 2000

export default function Step4_ImportProgress({ state, updateState, onNext }: Props) {
  const [progress, setProgress] = useState(0)
  const [statusText, setStatusText] = useState('Préparation de l\'import...')
  const [done, setDone] = useState(false)
  const startedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    const runImport = async () => {
      const totalRows = state.mappedRows.length

      if (totalRows <= CHUNK_SIZE) {
        // Single request
        setStatusText('Import en cours...')
        const res = await fetch('/api/leads/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rows: state.mappedRows,
            config: state.config,
            fileName: state.fileName,
          }),
        })
        const json = await res.json()
        if (res.ok) {
          updateState({ batch: json.data as LeadImportBatch })
          setProgress(100)
          setStatusText('Import terminé !')
          setDone(true)
        } else {
          setStatusText(`Erreur : ${json.error}`)
        }
      } else {
        // Multi-chunk: split rows and send sequentially
        let batchId: string | null = null
        const chunks = []
        for (let i = 0; i < totalRows; i += CHUNK_SIZE) {
          chunks.push(state.mappedRows.slice(i, i + CHUNK_SIZE))
        }

        for (let c = 0; c < chunks.length; c++) {
          setStatusText(`Import en cours... (lot ${c + 1}/${chunks.length})`)

          const res = await fetch('/api/leads/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              rows: chunks[c],
              config: state.config,
              fileName: state.fileName,
            }),
          })
          const json = await res.json()
          if (!res.ok) {
            setStatusText(`Erreur au lot ${c + 1} : ${json.error}`)
            return
          }
          batchId = json.data.id
          setProgress(Math.round(((c + 1) / chunks.length) * 100))
        }

        // Fetch final batch
        if (batchId) {
          const res = await fetch(`/api/leads/import/${batchId}`)
          const json = await res.json()
          updateState({ batch: json.data as LeadImportBatch })
        }

        setProgress(100)
        setStatusText('Import terminé !')
        setDone(true)
      }
    }

    runImport()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div style={{ textAlign: 'center', padding: '40px 0' }}>
      {/* Icon */}
      {done ? (
        <CheckCircle2 size={48} color="#38A169" style={{ marginBottom: 16 }} />
      ) : (
        <Loader2 size={48} color="#E53E3E" style={{ animation: 'spin 1s linear infinite', marginBottom: 16 }} />
      )}
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>

      {/* Status */}
      <p style={{ fontSize: 16, fontWeight: 600, color: '#fff', marginBottom: 8 }}>
        {statusText}
      </p>

      {/* Progress bar */}
      <div style={{
        width: 400, maxWidth: '100%', height: 8, borderRadius: 4,
        background: '#262626', margin: '0 auto 12px',
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${progress}%`, height: '100%', borderRadius: 4,
          background: done ? '#38A169' : '#E53E3E',
          transition: 'width 0.5s ease',
        }} />
      </div>

      {/* Percentage */}
      <p style={{ fontSize: 13, color: '#A0A0A0' }}>
        {progress}%
        {state.totalRows > 1000 && !done && (
          <span> — cela peut prendre quelques secondes</span>
        )}
      </p>

      {/* Continue button */}
      {done && (
        <button onClick={onNext} style={{
          marginTop: 24, padding: '10px 24px', borderRadius: 8, fontSize: 14, fontWeight: 600,
          background: '#E53E3E', border: 'none', color: '#000', cursor: 'pointer',
        }}>
          Voir le récapitulatif
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/leads/import/Step4_ImportProgress.tsx
git commit -m "feat(import): add Step 4 — import progress with chunking (T-031)"
```

---

## Task 10: Step 5 — Recap with Inline Error Correction

**Files:**
- Create: `src/components/leads/import/Step5_Recap.tsx`

- [ ] **Step 1: Create `src/components/leads/import/Step5_Recap.tsx`**

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, AlertTriangle, ExternalLink, RotateCw } from 'lucide-react'
import type { WizardState } from '@/app/(dashboard)/leads/import/import-client'
import type { ImportError } from '@/types'

interface Props {
  state: WizardState
  updateState: (partial: Partial<WizardState>) => void
}

export default function Step5_Recap({ state }: Props) {
  const router = useRouter()
  const batch = state.batch
  const [editedErrors, setEditedErrors] = useState<(ImportError & { edited?: Record<string, string> })[]>(
    () => (batch?.errors || []).map((e) => ({ ...e }))
  )
  const [reimporting, setReimporting] = useState(false)
  const [reimportResult, setReimportResult] = useState<string | null>(null)

  if (!batch) return null

  const counters = [
    { label: 'Créés', value: batch.created_count, bg: '#38A16920', color: '#38A169' },
    { label: 'Mis à jour', value: batch.updated_count, bg: '#3B82F620', color: '#3B82F6' },
    { label: 'Ignorés', value: batch.skipped_count, bg: '#66666620', color: '#666' },
    { label: 'Erreurs', value: batch.error_count, bg: '#E53E3E20', color: '#E53E3E' },
  ]

  const handleEditErrorField = (index: number, field: string, value: string) => {
    setEditedErrors((prev) => {
      const updated = [...prev]
      updated[index] = {
        ...updated[index],
        edited: { ...updated[index].edited, [field]: value },
      }
      return updated
    })
  }

  const handleReimportErrors = async () => {
    setReimporting(true)
    setReimportResult(null)

    // Build corrected rows from edited errors
    const correctedRows: Record<string, string>[] = editedErrors
      .filter((e) => e.edited && Object.keys(e.edited).length > 0)
      .map((e) => ({
        // Original row data reconstructed from the error + correction
        [e.field]: e.edited?.[e.field] || e.value,
        ...e.edited,
      }))

    if (correctedRows.length === 0) {
      setReimportResult('Aucune correction à réimporter.')
      setReimporting(false)
      return
    }

    try {
      const res = await fetch('/api/leads/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: correctedRows,
          config: state.config,
          fileName: `${state.fileName} (corrections)`,
        }),
      })
      const json = await res.json()
      if (res.ok) {
        setReimportResult(`${json.data.created_count} leads créés, ${json.data.error_count} erreurs restantes.`)
      } else {
        setReimportResult(`Erreur : ${json.error}`)
      }
    } catch {
      setReimportResult('Erreur réseau.')
    } finally {
      setReimporting(false)
    }
  }

  return (
    <div>
      {/* Success icon */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        {batch.error_count === 0 ? (
          <CheckCircle2 size={48} color="#38A169" />
        ) : (
          <AlertTriangle size={48} color="#D69E2E" />
        )}
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginTop: 12 }}>
          Import terminé
        </h2>
      </div>

      {/* Counters */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {counters.map((c) => (
          <div key={c.label} style={{
            padding: 16, borderRadius: 10, textAlign: 'center', background: c.bg,
          }}>
            <p style={{ fontSize: 28, fontWeight: 700, color: c.color, margin: 0 }}>{c.value}</p>
            <p style={{ fontSize: 12, color: c.color, margin: '4px 0 0' }}>{c.label}</p>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <button
          onClick={() => router.push(`/leads?import_batch_id=${batch.id}`)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '10px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600,
            background: '#E53E3E', border: 'none', color: '#000', cursor: 'pointer',
          }}
        >
          <ExternalLink size={14} />
          Voir les leads importés
        </button>
        <button
          onClick={() => router.push('/leads/import')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '10px 20px', borderRadius: 8, fontSize: 14,
            background: 'transparent', border: '1px solid #333', color: '#A0A0A0', cursor: 'pointer',
          }}
        >
          Nouvel import
        </button>
        <button
          onClick={() => router.push('/leads/import/history')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '10px 20px', borderRadius: 8, fontSize: 14,
            background: 'transparent', border: '1px solid #333', color: '#A0A0A0', cursor: 'pointer',
          }}
        >
          Historique des imports
        </button>
      </div>

      {/* Error table with inline editing */}
      {editedErrors.length > 0 && (
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: '#fff', marginBottom: 12 }}>
            Lignes en erreur ({editedErrors.length})
          </h3>
          <div style={{ borderRadius: 8, border: '1px solid #262626', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: '#A0A0A0', background: '#1a1a1a' }}>Ligne</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: '#A0A0A0', background: '#1a1a1a' }}>Champ</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: '#A0A0A0', background: '#1a1a1a' }}>Valeur originale</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: '#A0A0A0', background: '#1a1a1a' }}>Correction</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: '#A0A0A0', background: '#1a1a1a' }}>Raison</th>
                </tr>
              </thead>
              <tbody>
                {editedErrors.map((e, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #1a1a1a' }}>
                    <td style={{ padding: '8px 12px', color: '#E53E3E' }}>{e.row}</td>
                    <td style={{ padding: '8px 12px', color: '#fff' }}>{e.field}</td>
                    <td style={{ padding: '8px 12px', color: '#666' }}>{e.value || '—'}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <input
                        type="text"
                        defaultValue={e.value}
                        onChange={(ev) => handleEditErrorField(i, e.field, ev.target.value)}
                        style={{
                          width: '100%', padding: '6px 8px', borderRadius: 4, fontSize: 13,
                          background: '#1a1a1a', border: '1px solid #333', color: '#fff',
                        }}
                      />
                    </td>
                    <td style={{ padding: '8px 12px', color: '#A0A0A0' }}>{e.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
            <button
              onClick={handleReimportErrors}
              disabled={reimporting}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                background: '#E53E3E', border: 'none', color: '#000',
                cursor: reimporting ? 'not-allowed' : 'pointer',
                opacity: reimporting ? 0.6 : 1,
              }}
            >
              <RotateCw size={14} />
              {reimporting ? 'Réimport en cours...' : 'Réimporter les lignes corrigées'}
            </button>
            {reimportResult && (
              <p style={{ fontSize: 13, color: '#A0A0A0', margin: 0 }}>{reimportResult}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/leads/import/Step5_Recap.tsx
git commit -m "feat(import): add Step 5 — recap with inline error correction (T-031)"
```

---

## Task 11: Import History Page

**Files:**
- Create: `src/app/(dashboard)/leads/import/history/page.tsx`
- Create: `src/components/leads/import/ImportHistory.tsx`

- [ ] **Step 1: Create `src/components/leads/import/ImportHistory.tsx`**

```typescript
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Trash2, Loader2 } from 'lucide-react'
import type { LeadImportBatch } from '@/types'

const STATUS_BADGES: Record<string, { label: string; color: string; bg: string }> = {
  pending:    { label: 'En attente', color: '#D69E2E', bg: '#D69E2E20' },
  processing: { label: 'En cours', color: '#3B82F6', bg: '#3B82F620' },
  completed:  { label: 'Terminé', color: '#38A169', bg: '#38A16920' },
  failed:     { label: 'Échoué', color: '#E53E3E', bg: '#E53E3E20' },
  cancelled:  { label: 'Annulé', color: '#666', bg: '#66666620' },
}

export default function ImportHistory() {
  const router = useRouter()
  const [batches, setBatches] = useState<LeadImportBatch[]>([])
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState<string | null>(null)

  useEffect(() => {
    const fetchHistory = async () => {
      const res = await fetch('/api/leads/import/history')
      const json = await res.json()
      if (res.ok) setBatches(json.data || [])
      setLoading(false)
    }
    fetchHistory()
  }, [])

  const handleCancel = async (batchId: string) => {
    if (!confirm('Annuler cet import ? Les leads sans appels ni follow-ups seront supprimés.')) return
    setCancelling(batchId)
    const res = await fetch(`/api/leads/import/${batchId}`, { method: 'DELETE' })
    const json = await res.json()
    if (res.ok) {
      alert(json.data.message)
      setBatches((prev) => prev.map((b) => b.id === batchId ? { ...b, status: 'cancelled' } : b))
    } else {
      alert(`Erreur : ${json.error}`)
    }
    setCancelling(null)
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button
          onClick={() => router.push('/leads')}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 32, height: 32, borderRadius: 6,
            background: 'transparent', border: '1px solid #333', color: '#A0A0A0', cursor: 'pointer',
          }}
        >
          <ArrowLeft size={16} />
        </button>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', margin: 0 }}>
          Historique des imports
        </h1>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Loader2 size={24} color="#666" style={{ animation: 'spin 1s linear infinite' }} />
          <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
        </div>
      )}

      {!loading && batches.length === 0 && (
        <p style={{ fontSize: 14, color: '#666', textAlign: 'center', padding: 40 }}>
          Aucun import effectué.
        </p>
      )}

      {!loading && batches.length > 0 && (
        <div style={{ borderRadius: 8, border: '1px solid #262626', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ padding: '10px 14px', textAlign: 'left', color: '#A0A0A0', background: '#1a1a1a' }}>Date</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', color: '#A0A0A0', background: '#1a1a1a' }}>Fichier</th>
                <th style={{ padding: '10px 14px', textAlign: 'center', color: '#A0A0A0', background: '#1a1a1a' }}>Total</th>
                <th style={{ padding: '10px 14px', textAlign: 'center', color: '#38A169', background: '#1a1a1a' }}>Créés</th>
                <th style={{ padding: '10px 14px', textAlign: 'center', color: '#3B82F6', background: '#1a1a1a' }}>MAJ</th>
                <th style={{ padding: '10px 14px', textAlign: 'center', color: '#666', background: '#1a1a1a' }}>Ignorés</th>
                <th style={{ padding: '10px 14px', textAlign: 'center', color: '#E53E3E', background: '#1a1a1a' }}>Erreurs</th>
                <th style={{ padding: '10px 14px', textAlign: 'center', color: '#A0A0A0', background: '#1a1a1a' }}>Statut</th>
                <th style={{ padding: '10px 14px', textAlign: 'center', color: '#A0A0A0', background: '#1a1a1a' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => {
                const badge = STATUS_BADGES[b.status] || STATUS_BADGES.pending
                return (
                  <tr key={b.id} style={{ borderBottom: '1px solid #1a1a1a' }}>
                    <td style={{ padding: '10px 14px', color: '#fff' }}>
                      {new Date(b.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ padding: '10px 14px', color: '#A0A0A0' }}>{b.file_name}</td>
                    <td style={{ padding: '10px 14px', color: '#fff', textAlign: 'center' }}>{b.total_rows}</td>
                    <td style={{ padding: '10px 14px', color: '#38A169', textAlign: 'center' }}>{b.created_count}</td>
                    <td style={{ padding: '10px 14px', color: '#3B82F6', textAlign: 'center' }}>{b.updated_count}</td>
                    <td style={{ padding: '10px 14px', color: '#666', textAlign: 'center' }}>{b.skipped_count}</td>
                    <td style={{ padding: '10px 14px', color: '#E53E3E', textAlign: 'center' }}>{b.error_count}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-block', padding: '3px 10px', borderRadius: 20,
                        fontSize: 11, fontWeight: 600, background: badge.bg, color: badge.color,
                      }}>
                        {badge.label}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                      {(b.status === 'completed' || b.status === 'failed') && (
                        <button
                          onClick={() => handleCancel(b.id)}
                          disabled={cancelling === b.id}
                          title="Annuler cet import"
                          style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: 28, height: 28, borderRadius: 6,
                            background: 'transparent', border: '1px solid #333', color: '#E53E3E',
                            cursor: cancelling === b.id ? 'not-allowed' : 'pointer',
                            opacity: cancelling === b.id ? 0.5 : 1,
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create `src/app/(dashboard)/leads/import/history/page.tsx`**

```typescript
import ImportHistory from '@/components/leads/import/ImportHistory'

export default function ImportHistoryPage() {
  return <ImportHistory />
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/leads/import/history/ src/components/leads/import/ImportHistory.tsx
git commit -m "feat(import): add import history page with cancel (T-031)"
```

---

## Task 12: Wire Up "Importer" Button + Final Integration

**Files:**
- Modify: `src/app/(dashboard)/leads/leads-client.tsx`

- [ ] **Step 1: Add "Importer" button in `leads-client.tsx`**

Find the header section (around line 223-239) and add the import button. Add `Upload` to the lucide-react import and `useRouter` from next/navigation.

Add to imports at top of file:

```typescript
import { useRouter } from 'next/navigation'
```

Add `Upload` to the existing lucide-react import:

```typescript
import { Plus, Upload, ChevronLeft, ChevronRight, ExternalLink, Archive, Phone, ChevronDown, X, Calendar } from 'lucide-react'
```

Add `useRouter` inside the component:

```typescript
const router = useRouter()
```

Replace the single "Ajouter un lead" button with a button group:

```typescript
<div style={{ display: 'flex', gap: 8 }}>
  <button onClick={() => router.push('/leads/import')} style={{
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
    background: 'transparent', border: '1px solid #333', color: '#A0A0A0', cursor: 'pointer',
  }}>
    <Upload size={15} />
    Importer
  </button>
  <button onClick={() => setShowForm(true)} style={{
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
    background: 'var(--color-primary)', border: 'none', color: '#000', cursor: 'pointer',
  }}>
    <Plus size={15} />
    Ajouter un lead
  </button>
</div>
```

- [ ] **Step 2: Verify the app compiles**

```bash
npm run build
```

Fix any TypeScript errors that arise.

- [ ] **Step 3: Manual smoke test**

1. Navigate to `/leads` — confirm "Importer" button appears
2. Click "Importer" — redirects to `/leads/import`
3. Upload a test CSV file — preview appears
4. Map columns — config section works
5. Preview diff — counters display
6. Run import — progress bar completes
7. Recap — results shown, error correction works
8. Visit `/leads/import/history` — batch appears

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/leads/leads-client.tsx
git commit -m "feat(import): wire up Importer button on leads page (T-031)"
```

---

## Task 13: Update Project Tracking Files

**Files:**
- Modify: `taches/tache-031-import-leads.md`
- Modify: `taches/taches-remy.md`
- Modify: `etat.md`
- Modify: `ameliorations.md`

- [ ] **Step 1: Update tache-031 status and results**

Set status to `✅ Terminé` and fill in the "Résultat final" section with:
- List of files created/modified
- Features delivered: 5-step wizard, auto-mapping, dedup, inline error correction, history, cancel
- Dependencies installed: papaparse, @types/papaparse
- Migration applied: 023

- [ ] **Step 2: Update taches-remy.md**

Change T-031 status from `⬜` to `✅` with date `2026-04-15`.

- [ ] **Step 3: Update etat.md**

Add entry for T-031 completion: import CSV module functional, wizard 5 steps, history + cancel.

- [ ] **Step 4: Update ameliorations.md with any improvements identified**

Potential improvements to log:
- Phase 4: support Excel (.xlsx) via SheetJS
- Phase 4: Google Contacts import via People API
- Dedup avancée: libphonenumber-js pour normalisation internationale
- SSE au lieu du polling pour la progression (si Vercel Pro)
- Import en background via Vercel Queue pour > 5000 leads

- [ ] **Step 5: Commit**

```bash
git add taches/ etat.md ameliorations.md
git commit -m "chore: update tracking files — T-031 import leads completed"
```

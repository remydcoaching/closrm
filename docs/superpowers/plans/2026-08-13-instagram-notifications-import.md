# Import de leads depuis screenshots Instagram — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à Pierre d'uploader 1 à 10 captures d'écran du centre de notifications Instagram et de créer automatiquement les leads correspondants aux nouveaux followers/follow-backs détectés, avec relance groupée optionnelle.

**Architecture:** Une route API extrait les handles via Claude vision (`claude-sonnet-4`) et les croise avec la table `leads` pour détecter les doublons ; une seconde route confirme la création en réutilisant la logique déjà en place dans `POST /api/leads`. Le web envoie les images en `multipart/form-data`, converties en base64 côté serveur avant l'appel Claude. Le mobile encode en base64 côté client (`expo-file-system`) et envoie du JSON, cohérent avec `api.post` qui force `Content-Type: application/json`.

**Tech Stack:** Next.js API routes, `@anthropic-ai/sdk` (déjà en dépendance, v0.85.0), Supabase, React (web), React Native + Expo SDK 54 (mobile).

## Testing Note

This codebase has **no test runner installed** (no jest, no vitest, no `*.test.ts` files anywhere in the repo — verified before writing this plan). Tasks below use ad-hoc Node scripts run via `npx tsx` for verifying pure-function logic (Task 1, Task 2), and manual UI/curl verification for routes and components, consistent with how the rest of the codebase is validated (no existing precedent for unit tests to follow).

## Global Constraints

- Cap dur de 10 images par batch (validé avec l'utilisateur).
- Extraction : uniquement les patterns `"{handle} a commencé à vous suivre"` et `"{handle} a accepté votre demande de suivi"` — traités identiquement, aucune distinction de tag.
- Handle validé par le même regex que l'existant : `^[a-zA-Z0-9._]{1,30}$` (voir `src/lib/validations/leads.ts:9`).
- Leads créés avec `source: 'follow_ads'`, auto-assignés au créateur (réutilise la logique de `src/app/api/leads/route.ts:158-160`, ne pas la dupliquer).
- Doublons (même `instagram_handle` déjà en base pour le workspace) : affichés dans la review, décochés par défaut, badge "déjà en base".
- Relance batch optionnelle : délai par défaut 7 jours, raison par défaut `"Nouveau follower — premier contact"` éditable pour tout le lot, canal fixé à `instagram_dm`.
- Clé API Claude : `getApiKey(workspaceId)` de `src/lib/ai/brief.ts:16` — si `null`, erreur claire invitant à configurer Paramètres > Assistant IA.

---

## File Structure

**Backend (partagé web + mobile) :**
- Create: `src/lib/validations/instagram-import.ts` — schémas Zod pour les deux routes
- Create: `src/lib/ai/instagram-import.ts` — logique d'extraction vision (appel Claude, parsing JSON, dédup)
- Create: `src/app/api/leads/import-from-screenshots/route.ts` — `POST` extraction
- Create: `src/app/api/leads/import-from-screenshots/confirm/route.ts` — `POST` confirmation (création leads + relances)

**Web :**
- Create: `src/app/(dashboard)/leads/import-screenshots/page.tsx` — page serveur (auth wrapper minimal, suit le pattern de `src/app/(dashboard)/leads/import/page.tsx` si présent, sinon simple wrapper client)
- Create: `src/app/(dashboard)/leads/import-screenshots/import-screenshots-client.tsx` — état + orchestration (upload → extraction → review → confirm)
- Create: `src/components/leads/import-screenshots/UploadStep.tsx` — drop zone multi-image
- Create: `src/components/leads/import-screenshots/ReviewStep.tsx` — liste cochée + config relance batch
- Modify: `src/app/(dashboard)/leads/leads-client.tsx:292-297` — ajoute une entrée "Importer depuis screenshots" au menu d'actions

**Mobile :**
- Create: `mobile/src/app/leads/ImportScreenshotsScreen.tsx` — écran complet (upload → extraction → review → confirm), un seul fichier vu la taille contenue de l'écran
- Modify: `mobile/src/navigation/stacks/LeadsStack.tsx` — ajoute l'écran au stack
- Modify: `mobile/src/navigation/types.ts` — ajoute `ImportScreenshots: undefined` à `LeadsStackParamList`
- Modify: `mobile/src/app/leads/LeadsListScreen.tsx` — ajoute un bouton dans `rightSlot` de `NavLarge` pour naviguer vers l'écran
- Modify: `mobile/package.json` — ajoute `expo-image-picker`, `expo-file-system`

---

## Task 1: Schémas de validation

**Files:**
- Create: `src/lib/validations/instagram-import.ts`
- Verification script (not committed): `/tmp/verify-instagram-import-validations.ts`

**Interfaces:**
- Produces: `extractImagesSchema` (Zod, `{ images: string[] }` où chaque string est une data URL base64 `data:image/{jpeg,png};base64,...`), `confirmImportSchema` (Zod, `{ handles: string[]; create_follow_up: boolean; follow_up_delay_days?: number; follow_up_reason?: string }`), types `ExtractImagesInput`, `ConfirmImportInput`.

- [ ] **Step 1: Write the implementation**

```typescript
// src/lib/validations/instagram-import.ts
import { z } from 'zod'

const INSTAGRAM_HANDLE_REGEX = /^[a-zA-Z0-9._]{1,30}$/
const DATA_URL_REGEX = /^data:image\/(jpeg|png|webp);base64,/

export const extractImagesSchema = z.object({
  images: z
    .array(z.string().regex(DATA_URL_REGEX, 'Format image invalide (attendu: data URL base64)'))
    .min(1, 'Au moins une image requise')
    .max(10, 'Maximum 10 images par import'),
})

export const confirmImportSchema = z.object({
  handles: z
    .array(z.string().regex(INSTAGRAM_HANDLE_REGEX, 'Handle Instagram invalide'))
    .min(1, 'Au moins un handle requis'),
  create_follow_up: z.boolean(),
  follow_up_delay_days: z.number().int().min(1).max(90).optional().default(7),
  follow_up_reason: z.string().max(500).optional().default('Nouveau follower — premier contact'),
})

export type ExtractImagesInput = z.infer<typeof extractImagesSchema>
export type ConfirmImportInput = z.infer<typeof confirmImportSchema>
```

- [ ] **Step 2: Write and run a verification script**

This repo has no test runner installed (no jest/vitest anywhere). Verify with a throwaway script run via `npx tsx`:

```typescript
// /tmp/verify-instagram-import-validations.ts
import { extractImagesSchema, confirmImportSchema } from '/Users/pierrerebmann/closrm-lead-journey/src/lib/validations/instagram-import'

function assert(condition: boolean, label: string) {
  if (!condition) throw new Error(`FAILED: ${label}`)
  console.log(`OK: ${label}`)
}

assert(
  extractImagesSchema.safeParse({ images: ['data:image/jpeg;base64,AAAA'] }).success === true,
  'accepts 1 valid image',
)
assert(
  extractImagesSchema.safeParse({
    images: Array.from({ length: 11 }, (_, i) => `data:image/jpeg;base64,IMG${i}`),
  }).success === false,
  'rejects 11 images',
)
assert(extractImagesSchema.safeParse({ images: [] }).success === false, 'rejects empty images')
assert(
  extractImagesSchema.safeParse({ images: ['not-a-data-url'] }).success === false,
  'rejects non-data-URL string',
)

assert(
  confirmImportSchema.safeParse({ handles: ['killtran93', 'alexia.sss'], create_follow_up: false })
    .success === true,
  'accepts minimal confirm payload',
)
assert(
  confirmImportSchema.safeParse({
    handles: ['killtran93'],
    create_follow_up: true,
    follow_up_delay_days: 7,
    follow_up_reason: 'Nouveau follower — premier contact',
  }).success === true,
  'accepts full confirm payload',
)
assert(
  confirmImportSchema.safeParse({ handles: [], create_follow_up: false }).success === false,
  'rejects empty handles',
)
assert(
  confirmImportSchema.safeParse({ handles: ['not a valid handle!'], create_follow_up: false })
    .success === false,
  'rejects invalid handle format',
)

console.log('All checks passed.')
```

Run: `cd /Users/pierrerebmann/closrm-lead-journey && npx tsx /tmp/verify-instagram-import-validations.ts`
Expected: 8 lines of `OK: ...` followed by `All checks passed.` with exit code 0. If any assertion throws, fix `instagram-import.ts` and re-run.

- [ ] **Step 3: Commit**

```bash
git add src/lib/validations/instagram-import.ts
git commit -m "feat(leads): schémas validation import screenshots Instagram"
```

---

## Task 2: Extraction vision — logique métier

**Files:**
- Create: `src/lib/ai/instagram-import.ts`
- Verification script (not committed): `/tmp/verify-instagram-import-parsing.ts`

**Interfaces:**
- Consumes: `getApiKey(workspaceId: string): Promise<string | null>` de `src/lib/ai/brief.ts:16`
- Produces: `parseHandlesFromResponseText(text: string): string[]` (pure function, testable without network), `extractHandlesFromImage(imageDataUrl: string, apiKey: string): Promise<string[]>` (network call, built on top of `parseHandlesFromResponseText`), `dedupHandles(handles: string[]): string[]`

Design note: the JSON-parsing/filtering logic is factored into a standalone pure function (`parseHandlesFromResponseText`) so it can be verified without mocking the Anthropic SDK — this repo has no mocking library installed either. `extractHandlesFromImage` itself (the network-calling part) is verified manually against a real screenshot in Step 4, not via a script.

- [ ] **Step 1: Write the implementation**

```typescript
// src/lib/ai/instagram-import.ts
import Anthropic from '@anthropic-ai/sdk'

const INSTAGRAM_HANDLE_REGEX = /^[a-zA-Z0-9._]{1,30}$/

const EXTRACTION_PROMPT = `Tu regardes une capture d'écran du centre de notifications Instagram (app iOS).

Extrais UNIQUEMENT les notifications qui correspondent exactement à l'un de ces deux textes (le {handle} est en gras, cliquable, au début de la ligne) :
- "{handle} a commencé à vous suivre"
- "{handle} a accepté votre demande de suivi"

Ignore complètement tout le reste : likes sur reels/stories, commentaires, republications, "Thread suggéré pour vous", trophées de vues, "reel programmé publié", etc.

Réponds UNIQUEMENT avec un objet JSON de cette forme, sans aucun texte avant ou après :
{"handles": ["handle1", "handle2"]}

Si aucune notification pertinente n'est trouvée, réponds {"handles": []}.`

function parseDataUrl(dataUrl: string): { mediaType: 'image/jpeg' | 'image/png' | 'image/webp'; base64: string } {
  const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/)
  if (!match) throw new Error('Format de data URL image invalide')
  return { mediaType: match[1] as 'image/jpeg' | 'image/png' | 'image/webp', base64: match[2] }
}

/** Pure function: parses Claude's raw text response into a filtered handle
 *  list. Extracted from extractHandlesFromImage so it's testable without
 *  mocking the network call. */
export function parseHandlesFromResponseText(text: string): string[] {
  try {
    const parsed = JSON.parse(text) as { handles?: unknown }
    if (!Array.isArray(parsed.handles)) return []
    return parsed.handles
      .filter((h): h is string => typeof h === 'string')
      .map((h) => h.replace(/^@/, ''))
      .filter((h) => INSTAGRAM_HANDLE_REGEX.test(h))
  } catch {
    return []
  }
}

export async function extractHandlesFromImage(imageDataUrl: string, apiKey: string): Promise<string[]> {
  const { mediaType, base64 } = parseDataUrl(imageDataUrl)
  const client = new Anthropic({ apiKey })

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          { type: 'text', text: EXTRACTION_PROMPT },
        ],
      },
    ],
  })

  const block = response.content[0]
  const text = block.type === 'text' ? block.text : ''
  return parseHandlesFromResponseText(text)
}

export function dedupHandles(handles: string[]): string[] {
  return [...new Set(handles)]
}
```

- [ ] **Step 2: Write and run a verification script for the pure functions**

```typescript
// /tmp/verify-instagram-import-parsing.ts
import { parseHandlesFromResponseText, dedupHandles } from '/Users/pierrerebmann/closrm-lead-journey/src/lib/ai/instagram-import'

function assert(condition: boolean, label: string) {
  if (!condition) throw new Error(`FAILED: ${label}`)
  console.log(`OK: ${label}`)
}

assert(
  JSON.stringify(parseHandlesFromResponseText('{"handles":["killtran93","alexia.sss"]}')) ===
    JSON.stringify(['killtran93', 'alexia.sss']),
  'parses handles from valid JSON response',
)
assert(
  JSON.stringify(parseHandlesFromResponseText('{"handles":[]}')) === JSON.stringify([]),
  'returns empty array for empty handles field',
)
assert(
  JSON.stringify(parseHandlesFromResponseText('not json at all')) === JSON.stringify([]),
  'returns empty array for malformed JSON (does not throw)',
)
assert(
  JSON.stringify(parseHandlesFromResponseText('{"handles":["valid_handle","not a valid one!"]}')) ===
    JSON.stringify(['valid_handle']),
  'filters out handles failing the Instagram regex',
)
assert(
  JSON.stringify(parseHandlesFromResponseText('{"handles":["@killtran93"]}')) ===
    JSON.stringify(['killtran93']),
  'strips leading @ from handles',
)

assert(
  JSON.stringify(dedupHandles(['killtran93', 'alexia.sss', 'killtran93'])) ===
    JSON.stringify(['killtran93', 'alexia.sss']),
  'dedupHandles removes duplicates preserving order',
)
assert(JSON.stringify(dedupHandles([])) === JSON.stringify([]), 'dedupHandles handles empty input')

console.log('All checks passed.')
```

Run: `cd /Users/pierrerebmann/closrm-lead-journey && npx tsx /tmp/verify-instagram-import-parsing.ts`
Expected: 7 lines of `OK: ...` followed by `All checks passed.` with exit code 0.

- [ ] **Step 3: Commit**

```bash
git add src/lib/ai/instagram-import.ts
git commit -m "feat(leads): extraction handles Instagram via Claude vision"
```

- [ ] **Step 4: Manual verification of the network-calling path (do this once Task 3's route exists, or via a scratch script with a real API key)**

This step validates `extractHandlesFromImage` end-to-end against the real Claude API — not automatable without spending real API credits, so it's deferred to Task 3's manual verification step (which exercises the whole route, including this function) rather than repeated here.

---
## Task 3: Route API extraction

**Files:**
- Create: `src/app/api/leads/import-from-screenshots/route.ts`

**Interfaces:**
- Consumes: `extractImagesSchema` de Task 1, `extractHandlesFromImage`/`dedupHandles` de Task 2, `getWorkspaceId()` de `src/lib/supabase/get-workspace.ts`, `getApiKey(workspaceId)` de `src/lib/ai/brief.ts:16`, `createClient()` de `src/lib/supabase/server.ts`
- Produces: `POST /api/leads/import-from-screenshots` → `{ results: { handle: string, already_exists: boolean, existing_lead_id?: string }[] }`

- [ ] **Step 1: Write the route**

```typescript
// src/app/api/leads/import-from-screenshots/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { getApiKey } from '@/lib/ai/brief'
import { extractHandlesFromImage, dedupHandles } from '@/lib/ai/instagram-import'
import { extractImagesSchema } from '@/lib/validations/instagram-import'

export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const body = await request.json()
    const parsed = extractImagesSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const apiKey = await getApiKey(workspaceId)
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Clé API Claude non configurée. Allez dans Paramètres > Assistant IA.' },
        { status: 400 },
      )
    }

    const perImageResults = await Promise.all(
      parsed.data.images.map((img) => extractHandlesFromImage(img, apiKey)),
    )
    const allHandles = dedupHandles(perImageResults.flat())

    if (allHandles.length === 0) {
      return NextResponse.json({ results: [] })
    }

    const { data: existingLeads } = await supabase
      .from('leads')
      .select('id, instagram_handle')
      .eq('workspace_id', workspaceId)
      .in('instagram_handle', allHandles)

    const existingByHandle = new Map((existingLeads ?? []).map((l) => [l.instagram_handle, l.id]))

    const results = allHandles.map((handle) => ({
      handle,
      already_exists: existingByHandle.has(handle),
      existing_lead_id: existingByHandle.get(handle),
    }))

    return NextResponse.json({ results })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    console.error('[API /leads/import-from-screenshots] Error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Manual verification (no automated test — network call to Anthropic)**

Run the dev server (`npm run dev`) and verify with curl using a real small test image, or verify via the UI once Task 6 (web) is implemented. Confirm:
1. A request with `images: []` returns 400.
2. A request with 11 images returns 400.
3. A request without a configured API key returns 400 with the "Clé API" message.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/leads/import-from-screenshots/route.ts
git commit -m "feat(leads): route API extraction handles depuis screenshots"
```

---

## Task 4: Route API confirmation (création leads + relances)

**Files:**
- Create: `src/app/api/leads/import-from-screenshots/confirm/route.ts`

**Interfaces:**
- Consumes: `confirmImportSchema` de Task 1, `getWorkspaceId()`, `createClient()`
- Produces: `POST /api/leads/import-from-screenshots/confirm` → `{ created: number, follow_ups_created: number, lead_ids: string[] }`

- [ ] **Step 1: Write the route**

```typescript
// src/app/api/leads/import-from-screenshots/confirm/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { confirmImportSchema } from '@/lib/validations/instagram-import'

export async function POST(request: NextRequest) {
  try {
    const { userId, workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const body = await request.json()
    const parsed = confirmImportSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { handles, create_follow_up, follow_up_delay_days, follow_up_reason } = parsed.data

    const leadsToInsert = handles.map((handle) => ({
      workspace_id: workspaceId,
      status: 'nouveau' as const,
      call_attempts: 0,
      reached: false,
      first_name: handle,
      last_name: '',
      phone: '',
      email: null,
      source: 'follow_ads' as const,
      instagram_handle: handle,
      tags: [],
      notes: null,
      assigned_to: userId,
    }))

    const { data: createdLeads, error } = await supabase
      .from('leads')
      .insert(leadsToInsert)
      .select('id')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const leadIds = (createdLeads ?? []).map((l) => l.id)
    let followUpsCreated = 0

    if (create_follow_up && leadIds.length > 0) {
      const scheduledAt = new Date()
      scheduledAt.setDate(scheduledAt.getDate() + follow_up_delay_days)
      scheduledAt.setHours(10, 0, 0, 0)

      const followUpsToInsert = leadIds.map((leadId) => ({
        workspace_id: workspaceId,
        lead_id: leadId,
        reason: follow_up_reason,
        scheduled_at: scheduledAt.toISOString(),
        channel: 'instagram_dm' as const,
        status: 'en_attente' as const,
        notes: null,
      }))

      const { error: fuError, count } = await supabase
        .from('follow_ups')
        .insert(followUpsToInsert, { count: 'exact' })

      if (!fuError) followUpsCreated = count ?? followUpsToInsert.length
    }

    return NextResponse.json({
      created: leadIds.length,
      follow_ups_created: followUpsCreated,
      lead_ids: leadIds,
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    console.error('[API /leads/import-from-screenshots/confirm] Error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Manual verification**

Via curl or the UI (Task 6/7): confirm a batch of 2-3 handles creates that many leads with `source: 'follow_ads'` and `assigned_to` = the calling user's id, and that `create_follow_up: true` creates one `follow_up` per lead with `scheduled_at` ≈ now + delay days.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/leads/import-from-screenshots/confirm/route.ts
git commit -m "feat(leads): route API confirmation import + relance batch"
```

---

## Task 5: Web — composant UploadStep

**Files:**
- Create: `src/components/leads/import-screenshots/UploadStep.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks (pure UI component)
- Produces: `UploadStep` component with props `{ onImagesReady: (dataUrls: string[]) => void }` — reads dropped/selected files, converts to base64 data URLs via `FileReader`, caps at 10 files with an alert beyond that.

- [ ] **Step 1: Write the component**

```typescript
// src/components/leads/import-screenshots/UploadStep.tsx
'use client'

import { useCallback, useRef, useState } from 'react'
import { Upload, X } from 'lucide-react'

const MAX_IMAGES = 10

interface Props {
  onImagesReady: (dataUrls: string[]) => void
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function UploadStep({ onImagesReady }: Props) {
  const [previews, setPreviews] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFiles = useCallback(async (files: FileList) => {
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'))
    if (imageFiles.length === 0) return
    if (previews.length + imageFiles.length > MAX_IMAGES) {
      alert(`Maximum ${MAX_IMAGES} images par import.`)
      return
    }
    const dataUrls = await Promise.all(imageFiles.map(fileToDataUrl))
    setPreviews((prev) => [...prev, ...dataUrls])
  }, [previews.length])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files)
  }, [handleFiles])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFiles(e.target.files)
    e.target.value = ''
  }, [handleFiles])

  const removeAt = (idx: number) => {
    setPreviews((prev) => prev.filter((_, i) => i !== idx))
  }

  return (
    <div>
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: '2px dashed var(--border-primary)', borderRadius: 12, padding: '40px 30px',
          textAlign: 'center', cursor: 'pointer', background: 'var(--bg-elevated)',
        }}
      >
        <Upload size={32} color="var(--text-muted)" style={{ marginBottom: 10 }} />
        <p style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 600, margin: '0 0 4px' }}>
          Glissez vos captures d'écran ici ou cliquez pour sélectionner
        </p>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
          {previews.length}/{MAX_IMAGES} images
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleInputChange}
          style={{ display: 'none' }}
        />
      </div>

      {previews.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginTop: 16 }}>
          {previews.map((src, idx) => (
            <div key={idx} style={{ position: 'relative' }}>
              <img
                src={src}
                alt={`Capture ${idx + 1}`}
                style={{ width: '100%', aspectRatio: '9/16', objectFit: 'cover', borderRadius: 8 }}
              />
              <button
                onClick={() => removeAt(idx)}
                style={{
                  position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11,
                  background: 'rgba(0,0,0,0.7)', border: 'none', color: '#fff', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {previews.length > 0 && (
        <button
          onClick={() => onImagesReady(previews)}
          style={{
            marginTop: 16, padding: '10px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600,
            background: 'var(--color-primary)', color: '#000', border: 'none', cursor: 'pointer',
          }}
        >
          Analyser {previews.length} capture{previews.length > 1 ? 's' : ''}
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Manual verification**

This component is exercised end-to-end in Task 6. No isolated test — it's a thin file-reading wrapper around browser APIs (`FileReader`) that aren't worth mocking in isolation.

- [ ] **Step 3: Commit**

```bash
git add src/components/leads/import-screenshots/UploadStep.tsx
git commit -m "feat(leads): UploadStep — drop zone multi-image import screenshots"
```

---

## Task 6: Web — composant ReviewStep

**Files:**
- Create: `src/components/leads/import-screenshots/ReviewStep.tsx`

**Interfaces:**
- Consumes: the `{ handle: string, already_exists: boolean, existing_lead_id?: string }[]` shape produced by Task 3's route
- Produces: `ReviewStep` component with props `{ results: { handle: string, already_exists: boolean, existing_lead_id?: string }[], onConfirm: (payload: { handles: string[]; create_follow_up: boolean; follow_up_delay_days: number; follow_up_reason: string }) => void, submitting: boolean }`

- [ ] **Step 1: Write the component**

```typescript
// src/components/leads/import-screenshots/ReviewStep.tsx
'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'

interface ImportResult {
  handle: string
  already_exists: boolean
  existing_lead_id?: string
}

interface Props {
  results: ImportResult[]
  onConfirm: (payload: {
    handles: string[]
    create_follow_up: boolean
    follow_up_delay_days: number
    follow_up_reason: string
  }) => void
  submitting: boolean
}

export default function ReviewStep({ results, onConfirm, submitting }: Props) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(results.filter((r) => !r.already_exists).map((r) => r.handle)),
  )
  const [createFollowUp, setCreateFollowUp] = useState(true)
  const [delayDays, setDelayDays] = useState(7)
  const [reason, setReason] = useState('Nouveau follower — premier contact')

  const toggle = (handle: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(handle)) next.delete(handle)
      else next.add(handle)
      return next
    })
  }

  const handleSubmit = () => {
    onConfirm({
      handles: [...selected],
      create_follow_up: createFollowUp,
      follow_up_delay_days: delayDays,
      follow_up_reason: reason,
    })
  }

  if (results.length === 0) {
    return (
      <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
        Aucun nouveau follower détecté sur ces captures.
      </p>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        {results.map((r) => {
          const isSelected = selected.has(r.handle)
          return (
            <div
              key={r.handle}
              onClick={() => toggle(r.handle)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                borderBottom: '1px solid var(--border-primary)', cursor: 'pointer',
              }}
            >
              <div
                style={{
                  width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                  border: isSelected ? 'none' : '1.5px solid var(--border-primary)',
                  background: isSelected ? 'var(--color-primary)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                {isSelected && <Check size={12} color="#000" strokeWidth={3} />}
              </div>
              <span style={{ fontSize: 14, color: 'var(--text-primary)', flex: 1 }}>@{r.handle}</span>
              {r.already_exists && (
                <span
                  style={{
                    fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
                    background: 'var(--bg-elevated)', color: 'var(--text-secondary)',
                  }}
                >
                  déjà en base
                </span>
              )}
            </div>
          )
        })}
      </div>

      <div style={{ padding: 12, background: 'var(--bg-elevated)', borderRadius: 8, marginBottom: 16 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
          <input
            type="checkbox"
            checked={createFollowUp}
            onChange={(e) => setCreateFollowUp(e.target.checked)}
          />
          Créer une relance pour les leads sélectionnés
        </label>
        {createFollowUp && (
          <div style={{ display: 'flex', gap: 10, flexDirection: 'column' }}>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Délai (jours)
              <input
                type="number"
                min={1}
                max={90}
                value={delayDays}
                onChange={(e) => setDelayDays(Number(e.target.value))}
                style={{
                  display: 'block', width: 80, marginTop: 4, padding: '6px 8px',
                  border: '1px solid var(--border-primary)', borderRadius: 6, background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                }}
              />
            </label>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Raison
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                style={{
                  display: 'block', width: '100%', marginTop: 4, padding: '6px 8px',
                  border: '1px solid var(--border-primary)', borderRadius: 6, background: 'var(--bg-primary)',
                  color: 'var(--text-primary)', boxSizing: 'border-box',
                }}
              />
            </label>
          </div>
        )}
      </div>

      <button
        onClick={handleSubmit}
        disabled={selected.size === 0 || submitting}
        style={{
          padding: '10px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600,
          background: 'var(--color-primary)', color: '#000', border: 'none',
          cursor: selected.size === 0 || submitting ? 'not-allowed' : 'pointer',
          opacity: selected.size === 0 || submitting ? 0.5 : 1,
        }}
      >
        {submitting ? 'Création…' : `Créer ${selected.size} lead${selected.size > 1 ? 's' : ''}`}
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Manual verification**

Exercised end-to-end in Task 7 (orchestration page). Verify visually: pre-checked items exclude `already_exists: true`, toggling works, follow-up config fields hide when checkbox is off.

- [ ] **Step 3: Commit**

```bash
git add src/components/leads/import-screenshots/ReviewStep.tsx
git commit -m "feat(leads): ReviewStep — liste cochée + config relance batch"
```

---

## Task 7: Web — page d'orchestration + entrée menu

**Files:**
- Create: `src/app/(dashboard)/leads/import-screenshots/page.tsx`
- Create: `src/app/(dashboard)/leads/import-screenshots/import-screenshots-client.tsx`
- Modify: `src/app/(dashboard)/leads/leads-client.tsx:292-297`

**Interfaces:**
- Consumes: `UploadStep` (Task 5), `ReviewStep` (Task 6), `POST /api/leads/import-from-screenshots` (Task 3), `POST /api/leads/import-from-screenshots/confirm` (Task 4)

- [ ] **Step 1: Write the client orchestration component**

```typescript
// src/app/(dashboard)/leads/import-screenshots/import-screenshots-client.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import UploadStep from '@/components/leads/import-screenshots/UploadStep'
import ReviewStep from '@/components/leads/import-screenshots/ReviewStep'

interface ImportResult {
  handle: string
  already_exists: boolean
  existing_lead_id?: string
}

type Step = 'upload' | 'extracting' | 'review' | 'done'

export default function ImportScreenshotsClient() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('upload')
  const [results, setResults] = useState<ImportResult[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<{ created: number; follow_ups_created: number } | null>(null)

  async function handleImagesReady(images: string[]) {
    setStep('extracting')
    setError(null)
    try {
      const res = await fetch('/api/leads/import-from-screenshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.toString() ?? 'Erreur extraction')
      setResults(json.results ?? [])
      setStep('review')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur extraction')
      setStep('upload')
    }
  }

  async function handleConfirm(payload: {
    handles: string[]
    create_follow_up: boolean
    follow_up_delay_days: number
    follow_up_reason: string
  }) {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/leads/import-from-screenshots/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.toString() ?? 'Erreur création')
      setSummary({ created: json.created, follow_ups_created: json.follow_ups_created })
      setStep('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur création')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 24 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
        Importer depuis screenshots Instagram
      </h1>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
        Capture le centre de notifications Instagram, on détecte les nouveaux followers automatiquement.
      </p>

      {error && (
        <div style={{ padding: 10, background: '#ef444422', color: '#ef4444', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
          {error}
        </div>
      )}

      {step === 'upload' && <UploadStep onImagesReady={handleImagesReady} />}

      {step === 'extracting' && (
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Analyse des captures en cours…</p>
      )}

      {step === 'review' && (
        <ReviewStep results={results} onConfirm={handleConfirm} submitting={submitting} />
      )}

      {step === 'done' && summary && (
        <div>
          <p style={{ fontSize: 14, color: 'var(--text-primary)', marginBottom: 12 }}>
            {summary.created} lead{summary.created > 1 ? 's' : ''} créé{summary.created > 1 ? 's' : ''}
            {summary.follow_ups_created > 0 ? ` · ${summary.follow_ups_created} relance${summary.follow_ups_created > 1 ? 's' : ''} programmée${summary.follow_ups_created > 1 ? 's' : ''}` : ''}.
          </p>
          <button
            onClick={() => router.push('/leads')}
            style={{
              padding: '10px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600,
              background: 'var(--color-primary)', color: '#000', border: 'none', cursor: 'pointer',
            }}
          >
            Retour aux leads
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Write the server page wrapper**

```typescript
// src/app/(dashboard)/leads/import-screenshots/page.tsx
import ImportScreenshotsClient from './import-screenshots-client'

export default function ImportScreenshotsPage() {
  return <ImportScreenshotsClient />
}
```

- [ ] **Step 3: Add menu entry in leads-client.tsx**

In `src/app/(dashboard)/leads/leads-client.tsx`, locate the actions array around line 292-297 (the array passed to the dropdown menu with entries "Ajouter un lead", "Importer des leads", "Exporter des leads", "Historique des imports"). Add a new entry right after "Importer des leads":

```typescript
{ icon: <Upload size={15} />, label: 'Importer des leads', onClick: () => { router.push('/leads/import'); setShowActionsMenu(false) } },
{ icon: <Upload size={15} />, label: 'Importer depuis screenshots', onClick: () => { router.push('/leads/import-screenshots'); setShowActionsMenu(false) } },
{ icon: <Download size={15} />, label: 'Exporter des leads', onClick: () => { router.push('/base-de-donnees'); setShowActionsMenu(false) } },
```

- [ ] **Step 4: Manual verification**

Run `npm run dev`, navigate to `/leads`, open the actions menu, click "Importer depuis screenshots", upload 1-2 real Instagram notification screenshots, verify extraction returns the expected handles, verify review step pre-checks new ones, confirm creates leads visible in `/leads`.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(dashboard\)/leads/import-screenshots/ src/app/\(dashboard\)/leads/leads-client.tsx
git commit -m "feat(leads): page web import screenshots Instagram + entrée menu"
```

---

## Task 8: Mobile — dépendances image picker

**Files:**
- Modify: `mobile/package.json`

- [ ] **Step 1: Install expo-image-picker and expo-file-system**

Run from `mobile/`:
```bash
npx expo install expo-image-picker expo-file-system
```

- [ ] **Step 2: Verify install**

Run: `cd mobile && npx tsc --noEmit -p .`
Expected: no new errors (packages installed but not yet imported anywhere).

- [ ] **Step 3: Commit**

```bash
cd mobile
git add package.json package-lock.json
git commit -m "chore(mobile): ajoute expo-image-picker + expo-file-system"
```

---

## Task 9: Mobile — navigation types + stack

**Files:**
- Modify: `mobile/src/navigation/types.ts`
- Modify: `mobile/src/navigation/stacks/LeadsStack.tsx`

**Interfaces:**
- Produces: `LeadsStackParamList` gains `ImportScreenshots: undefined`

- [ ] **Step 1: Add the route to LeadsStackParamList**

In `mobile/src/navigation/types.ts`, modify:

```typescript
export type LeadsStackParamList = {
  LeadsList: undefined
  LeadDetail: { leadId: string }
}
```

to:

```typescript
export type LeadsStackParamList = {
  LeadsList: undefined
  LeadDetail: { leadId: string }
  ImportScreenshots: undefined
}
```

- [ ] **Step 2: Register the screen in the stack (placeholder component first)**

This step is combined with Task 10 — the screen component doesn't exist yet. Skip registering it here; Task 10 will modify `LeadsStack.tsx` once `ImportScreenshotsScreen` exists. Mark this step as informational only — no file change yet.

- [ ] **Step 3: Commit**

```bash
cd mobile
git add src/navigation/types.ts
git commit -m "feat(mobile): ajoute route ImportScreenshots à LeadsStackParamList"
```

---

## Task 10: Mobile — écran ImportScreenshotsScreen

**Files:**
- Create: `mobile/src/app/leads/ImportScreenshotsScreen.tsx`
- Modify: `mobile/src/navigation/stacks/LeadsStack.tsx`
- Modify: `mobile/src/app/leads/LeadsListScreen.tsx`

**Interfaces:**
- Consumes: `api.post<T>(path, body)` de `mobile/src/services/api.ts`, `LeadsStackParamList` de Task 9
- Produces: full screen at route `ImportScreenshots`, reachable via a button in `LeadsListScreen`'s `NavLarge` `rightSlot`

- [ ] **Step 1: Write the screen**

```typescript
// mobile/src/app/leads/ImportScreenshotsScreen.tsx
import React, { useState } from 'react'
import { View, Text, ScrollView, Pressable, ActivityIndicator, Image, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import type { LeadsStackParamList } from '../../navigation/types'
import { api } from '../../services/api'
import { NavLarge } from '../../components/ui'
import { colors } from '../../theme/colors'
import { type as t, spacing, radius } from '../../theme/tokens'

type Nav = NativeStackNavigationProp<LeadsStackParamList, 'ImportScreenshots'>

const MAX_IMAGES = 10

interface ImportResult {
  handle: string
  already_exists: boolean
  existing_lead_id?: string
}

type Step = 'upload' | 'extracting' | 'review' | 'creating' | 'done'

async function uriToDataUrl(uri: string): Promise<string> {
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 })
  const ext = uri.split('.').pop()?.toLowerCase()
  const mediaType = ext === 'png' ? 'image/png' : 'image/jpeg'
  return `data:${mediaType};base64,${base64}`
}

export function ImportScreenshotsScreen() {
  const navigation = useNavigation<Nav>()
  const [step, setStep] = useState<Step>('upload')
  const [previews, setPreviews] = useState<string[]>([])
  const [results, setResults] = useState<ImportResult[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [createFollowUp, setCreateFollowUp] = useState(true)
  const [summary, setSummary] = useState<{ created: number; follow_ups_created: number } | null>(null)

  const pickImages = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      Alert.alert('Permission requise', 'Autorise l\'accès aux photos pour importer des captures.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: MAX_IMAGES,
      quality: 0.8,
    })
    if (result.canceled) return
    const uris = result.assets.map((a) => a.uri)
    if (uris.length > MAX_IMAGES) {
      Alert.alert('Trop d\'images', `Maximum ${MAX_IMAGES} images par import.`)
      return
    }
    setPreviews(uris)
  }

  const analyze = async () => {
    setStep('extracting')
    try {
      const dataUrls = await Promise.all(previews.map(uriToDataUrl))
      const res = await api.post<{ results: ImportResult[] }>('/api/leads/import-from-screenshots', {
        images: dataUrls,
      })
      setResults(res.results ?? [])
      setSelected(new Set(res.results.filter((r) => !r.already_exists).map((r) => r.handle)))
      setStep('review')
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Erreur extraction')
      setStep('upload')
    }
  }

  const toggle = (handle: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(handle)) next.delete(handle)
      else next.add(handle)
      return next
    })
  }

  const confirm = async () => {
    setStep('creating')
    try {
      const res = await api.post<{ created: number; follow_ups_created: number }>(
        '/api/leads/import-from-screenshots/confirm',
        {
          handles: [...selected],
          create_follow_up: createFollowUp,
          follow_up_delay_days: 7,
          follow_up_reason: 'Nouveau follower — premier contact',
        },
      )
      setSummary(res)
      setStep('done')
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Erreur création')
      setStep('review')
    }
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
      <NavLarge title="Import screenshots" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}>
        {step === 'upload' && (
          <View>
            <Pressable onPress={pickImages}>
              {({ pressed }) => (
                <View
                  style={{
                    borderWidth: 2, borderStyle: 'dashed', borderColor: colors.border,
                    borderRadius: radius.lg, padding: spacing.xl, alignItems: 'center',
                    opacity: pressed ? 0.7 : 1,
                  }}
                >
                  <Ionicons name="images-outline" size={32} color={colors.textTertiary} />
                  <Text style={{ ...t.body, color: colors.textPrimary, marginTop: 8, fontWeight: '600' }}>
                    Sélectionner des captures ({previews.length}/{MAX_IMAGES})
                  </Text>
                </View>
              )}
            </Pressable>
            {previews.length > 0 && (
              <Pressable onPress={analyze} style={{ marginTop: spacing.lg }}>
                {({ pressed }) => (
                  <View
                    style={{
                      backgroundColor: colors.primary, borderRadius: radius.lg,
                      paddingVertical: 14, alignItems: 'center', opacity: pressed ? 0.85 : 1,
                    }}
                  >
                    <Text style={{ color: '#000', fontWeight: '700', fontSize: 16 }}>
                      Analyser {previews.length} capture{previews.length > 1 ? 's' : ''}
                    </Text>
                  </View>
                )}
              </Pressable>
            )}
          </View>
        )}

        {step === 'extracting' && (
          <View style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
            <ActivityIndicator color={colors.primary} />
            <Text style={{ ...t.body, color: colors.textSecondary, marginTop: 12 }}>
              Analyse des captures…
            </Text>
          </View>
        )}

        {step === 'review' && (
          <View>
            {results.length === 0 ? (
              <Text style={{ ...t.body, color: colors.textSecondary }}>
                Aucun nouveau follower détecté sur ces captures.
              </Text>
            ) : (
              <>
                <View style={{ backgroundColor: colors.bgSecondary, borderRadius: radius.lg, overflow: 'hidden', marginBottom: spacing.lg }}>
                  {results.map((r, idx) => {
                    const isSelected = selected.has(r.handle)
                    return (
                      <Pressable key={r.handle} onPress={() => toggle(r.handle)}>
                        {({ pressed }) => (
                          <View
                            style={{
                              flexDirection: 'row', alignItems: 'center', gap: 10,
                              paddingHorizontal: 14, paddingVertical: 12,
                              borderBottomWidth: idx === results.length - 1 ? 0 : 0.33,
                              borderBottomColor: colors.border,
                              opacity: pressed ? 0.7 : 1,
                            }}
                          >
                            <Ionicons
                              name={isSelected ? 'checkbox' : 'square-outline'}
                              size={20}
                              color={isSelected ? colors.primary : colors.textTertiary}
                            />
                            <Text style={{ ...t.body, color: colors.textPrimary, flex: 1 }}>
                              @{r.handle}
                            </Text>
                            {r.already_exists && (
                              <View
                                style={{
                                  paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99,
                                  backgroundColor: colors.bgPrimary,
                                }}
                              >
                                <Text style={{ ...t.caption2, color: colors.textSecondary }}>déjà en base</Text>
                              </View>
                            )}
                          </View>
                        )}
                      </Pressable>
                    )
                  })}
                </View>

                <Pressable onPress={() => setCreateFollowUp((v) => !v)} style={{ marginBottom: spacing.lg }}>
                  {({ pressed }) => (
                    <View
                      style={{
                        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                        paddingHorizontal: 14, paddingVertical: 12, borderRadius: radius.lg,
                        backgroundColor: colors.bgSecondary, opacity: pressed ? 0.85 : 1,
                      }}
                    >
                      <Text style={{ ...t.body, color: colors.textPrimary, fontWeight: '600' }}>
                        Relance à J+7 pour les sélectionnés
                      </Text>
                      <Ionicons
                        name={createFollowUp ? 'checkbox' : 'square-outline'}
                        size={22}
                        color={createFollowUp ? colors.primary : colors.textTertiary}
                      />
                    </View>
                  )}
                </Pressable>

                <Pressable onPress={confirm} disabled={selected.size === 0}>
                  {({ pressed }) => (
                    <View
                      style={{
                        backgroundColor: colors.primary, borderRadius: radius.lg,
                        paddingVertical: 14, alignItems: 'center',
                        opacity: selected.size === 0 ? 0.5 : pressed ? 0.85 : 1,
                      }}
                    >
                      <Text style={{ color: '#000', fontWeight: '700', fontSize: 16 }}>
                        Créer {selected.size} lead{selected.size > 1 ? 's' : ''}
                      </Text>
                    </View>
                  )}
                </Pressable>
              </>
            )}
          </View>
        )}

        {step === 'creating' && (
          <View style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        )}

        {step === 'done' && summary && (
          <View>
            <Text style={{ ...t.body, color: colors.textPrimary, marginBottom: spacing.lg }}>
              {summary.created} lead{summary.created > 1 ? 's' : ''} créé{summary.created > 1 ? 's' : ''}
              {summary.follow_ups_created > 0
                ? ` · ${summary.follow_ups_created} relance${summary.follow_ups_created > 1 ? 's' : ''} programmée${summary.follow_ups_created > 1 ? 's' : ''}`
                : ''}
              .
            </Text>
            <Pressable onPress={() => navigation.goBack()}>
              {({ pressed }) => (
                <View
                  style={{
                    backgroundColor: colors.primary, borderRadius: radius.lg,
                    paddingVertical: 14, alignItems: 'center', opacity: pressed ? 0.85 : 1,
                  }}
                >
                  <Text style={{ color: '#000', fontWeight: '700', fontSize: 16 }}>Retour aux leads</Text>
                </View>
              )}
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
```

- [ ] **Step 2: Register the screen in LeadsStack**

Modify `mobile/src/navigation/stacks/LeadsStack.tsx`:

```typescript
import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import type { LeadsStackParamList } from '../types'
import { LeadsListScreen } from '../../app/leads/LeadsListScreen'
import { LeadDetailScreen } from '../../app/leads/LeadDetailScreen'
import { ImportScreenshotsScreen } from '../../app/leads/ImportScreenshotsScreen'

const Stack = createNativeStackNavigator<LeadsStackParamList>()

export default function LeadsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="LeadsList" component={LeadsListScreen} />
      <Stack.Screen name="LeadDetail" component={LeadDetailScreen} />
      <Stack.Screen name="ImportScreenshots" component={ImportScreenshotsScreen} />
    </Stack.Navigator>
  )
}
```

- [ ] **Step 3: Add entry point button in LeadsListScreen**

In `mobile/src/app/leads/LeadsListScreen.tsx`, find the `<NavLarge title=...` usage (around line 137-ish, right before the `FilterChips` row per the file structure seen in Task exploration) and add a `rightSlot` with a button navigating to `ImportScreenshots`. The exact current call is:

```typescript
<NavLarge title="Leads" />
```

Change it to:

```typescript
<NavLarge
  title="Leads"
  rightSlot={
    <Pressable onPress={() => navigation.navigate('ImportScreenshots')} hitSlop={8}>
      <Ionicons name="camera-outline" size={22} color={colors.textPrimary} />
    </Pressable>
  }
/>
```

If `Pressable` and `Ionicons` are not already imported in this file, add:
```typescript
import { Pressable } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
```
(Check existing imports first — `View, Text, ScrollView, RefreshControl, ActivityIndicator, Pressable` is the likely existing import line; only add what's missing.)

- [ ] **Step 4: Type-check**

Run: `cd mobile && npx tsc --noEmit -p .`
Expected: no errors

- [ ] **Step 5: Manual verification**

Build and run on a device/simulator (or publish via `eas update` once verified working, per this project's established OTA workflow). Navigate to Leads tab, tap the camera icon, pick 1-2 real screenshots, verify extraction and creation flow end-to-end.

- [ ] **Step 6: Commit**

```bash
cd mobile
git add src/app/leads/ImportScreenshotsScreen.tsx src/navigation/stacks/LeadsStack.tsx src/app/leads/LeadsListScreen.tsx
git commit -m "feat(mobile): écran import screenshots Instagram + entrée depuis Leads"
```

---

## Task 11: Publish mobile OTA update

**Files:** none (deployment step)

- [ ] **Step 1: Type-check the full mobile project**

Run: `cd mobile && npx tsc --noEmit -p .`
Expected: no errors

- [ ] **Step 2: Publish OTA update**

Per this project's established workflow (see `taches/bug-ota-expo-updates-sdk54.md` for context on why `--environment` is required):

```bash
cd mobile
CI=1 npx eas update --branch preview --environment preview --message "feat(leads): import screenshots Instagram (extraction handles + création batch)" --platform ios
```

- [ ] **Step 3: Verify on device**

Force-close and reopen the app on a device with the preview build installed. Confirm the camera icon appears on the Leads screen and the import flow works end-to-end.

---

## Self-Review Notes

- **Spec coverage:** extraction (Task 2-3), review avec pré-coche + doublons (Task 6/10), confirmation + relance batch (Task 4), web entry point (Task 7), mobile entry point (Task 8-10), cap 10 images (enforced in Task 1 schema + Task 5/10 UI) — all covered.
- **Type consistency:** `ImportResult` shape (`handle`, `already_exists`, `existing_lead_id?`) is identical across Task 3 (route output), Task 6 (web ReviewStep props), Task 10 (mobile screen state) — verified consistent.
- **No placeholders:** all code blocks are complete and runnable, no TBD/TODO left.
- **Deviation from spec:** the spec mentions "upload direct multipart ou base64" for the extraction route — this plan settles on JSON base64 for both platforms, since the mobile `api.post` helper (`mobile/src/services/api.ts:39-41`) always sends `Content-Type: application/json` and doesn't support `FormData`; using base64 JSON for both keeps the two clients symmetric and avoids adding a second request path to `mobile/src/services/api.ts`. This is noted here rather than silently diverging from the spec.
- **Testing approach correction:** the plan initially assumed `vitest` was available (it isn't — verified via `grep` on `package.json` and a repo-wide search for `*.test.ts`/`*.spec.ts`, both came up empty). Task 1 and Task 2 were rewritten to use throwaway `npx tsx` verification scripts against pure functions instead. Task 2's `extractHandlesFromImage` (the network-calling half) was split from a new pure function `parseHandlesFromResponseText` specifically so the parsing/filtering logic stays verifiable without a mocking library (also absent from this repo).

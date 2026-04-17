# Linktree interne (A-010) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Système de liens courts trackables (1 par paire lead×lead-magnet) avec analytics et intégration IA.

**Architecture:** 2 tables Supabase (`lead_magnets`, `tracked_links`) + migration du JSON existant. Route publique `/c/[code]` pour redirect+tracking. Post-process IA qui remplace les URLs brutes par les short links. Page dédiée `/acquisition/lead-magnets` + widget dans fiche lead. Cron Vercel pour purge à 90j.

**Tech Stack:** Next.js 16 App Router, Supabase (Postgres + RLS), TypeScript, Zod, Tailwind, Recharts.

**Spec source :** `docs/superpowers/specs/2026-04-17-linktree-interne-design.md`

**Note testing :** Le projet n'a pas de framework de tests unitaires. Vérification = build (`pnpm build`), dev server (`pnpm dev`) + test manuel de l'UI. Chaque tâche se termine par un build propre.

**Convention commits :** `feat(linktree): ...` / `fix(linktree): ...` / `chore(linktree): ...`

**Branche :** `feature/pierre-linktree` (partir de `develop` à jour).

---

## Task 1: Branche + setup

**Files:** aucun

- [ ] **Step 1.1: Vérifier develop à jour**

```bash
git checkout develop
git pull origin develop
git status
```

Expected: `On branch develop`, `nothing to commit, working tree clean`.

- [ ] **Step 1.2: Créer branche feature**

```bash
git checkout -b feature/pierre-linktree
```

---

## Task 2: Migration SQL

**Files:**
- Create: `supabase/migrations/029_lead_magnets.sql`

- [ ] **Step 2.1: Créer la migration**

```sql
-- supabase/migrations/029_lead_magnets.sql

-- 1. Table lead_magnets
CREATE TABLE lead_magnets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title text NOT NULL,
  url text NOT NULL,
  platform text NOT NULL DEFAULT 'other'
    CHECK (platform IN ('youtube','tiktok','instagram','podcast','blog','pdf','other')),
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lead_magnets_workspace ON lead_magnets(workspace_id);

-- 2. Table tracked_links
CREATE TABLE tracked_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  lead_magnet_id uuid NOT NULL REFERENCES lead_magnets(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  short_code text NOT NULL UNIQUE,
  clicks_count int NOT NULL DEFAULT 0,
  first_clicked_at timestamptz,
  last_clicked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE(lead_magnet_id, lead_id)
);

CREATE INDEX idx_tracked_links_short_code ON tracked_links(short_code);
CREATE INDEX idx_tracked_links_lead ON tracked_links(lead_id);
CREATE INDEX idx_tracked_links_magnet ON tracked_links(lead_magnet_id);

-- 3. RLS
ALTER TABLE lead_magnets ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracked_links ENABLE ROW LEVEL SECURITY;

-- Policies lead_magnets (workspace scoped via workspace_members)
CREATE POLICY "lead_magnets_select" ON lead_magnets FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "lead_magnets_insert" ON lead_magnets FOR INSERT
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "lead_magnets_update" ON lead_magnets FOR UPDATE
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "lead_magnets_delete" ON lead_magnets FOR DELETE
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

-- Policies tracked_links (idem)
CREATE POLICY "tracked_links_select" ON tracked_links FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "tracked_links_insert" ON tracked_links FOR INSERT
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

-- UPDATE (pour clicks_count) : uniquement via service role côté serveur (pas de policy user)
-- DELETE : service role (cron) ou cascade
CREATE POLICY "tracked_links_delete" ON tracked_links FOR DELETE
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

-- 4. Migration des données JSON existantes
-- Parse ai_coach_briefs.lead_magnets (JSON string) et insère des rows
DO $$
DECLARE
  brief_row RECORD;
  item jsonb;
BEGIN
  FOR brief_row IN
    SELECT workspace_id, lead_magnets
    FROM ai_coach_briefs
    WHERE lead_magnets IS NOT NULL AND lead_magnets != ''
  LOOP
    BEGIN
      -- Tente de parser comme JSON array
      FOR item IN SELECT * FROM jsonb_array_elements(brief_row.lead_magnets::jsonb)
      LOOP
        IF (item->>'url') IS NOT NULL AND (item->>'url') != '' THEN
          INSERT INTO lead_magnets (workspace_id, title, url, platform)
          VALUES (
            brief_row.workspace_id,
            COALESCE(item->>'title', 'Sans titre'),
            item->>'url',
            'other'
          );
        END IF;
      END LOOP;
    EXCEPTION WHEN OTHERS THEN
      -- JSON invalide → on skip ce workspace
      RAISE NOTICE 'Skipping invalid JSON for workspace %', brief_row.workspace_id;
    END;
  END LOOP;
END $$;

-- 5. Drop colonne devenue inutile
ALTER TABLE ai_coach_briefs DROP COLUMN IF EXISTS lead_magnets;
```

- [ ] **Step 2.2: Appliquer la migration sur Supabase**

```bash
# Via CLI Supabase (si configuré) ou via dashboard SQL editor
# Vérifier que les 2 tables existent :
```

Exécuter dans Supabase SQL editor :
```sql
SELECT table_name FROM information_schema.tables
WHERE table_name IN ('lead_magnets','tracked_links');
```
Expected: 2 rows.

- [ ] **Step 2.3: Commit**

```bash
git add supabase/migrations/029_lead_magnets.sql
git commit -m "feat(linktree): migration 029 — tables lead_magnets + tracked_links"
```

---

## Task 3: Types TypeScript

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 3.1: Ajouter les types**

Ajouter en fin de fichier :

```typescript
export type LeadMagnetPlatform =
  | 'youtube' | 'tiktok' | 'instagram'
  | 'podcast' | 'blog' | 'pdf' | 'other'

export interface LeadMagnet {
  id: string
  workspace_id: string
  title: string
  url: string
  platform: LeadMagnetPlatform
  created_at: string
  updated_at: string
}

export interface TrackedLink {
  id: string
  workspace_id: string
  lead_magnet_id: string
  lead_id: string
  short_code: string
  clicks_count: number
  first_clicked_at: string | null
  last_clicked_at: string | null
  created_at: string
}

export interface LeadMagnetWithStats extends LeadMagnet {
  total_clicks: number
  unique_leads: number
}
```

- [ ] **Step 3.2: Vérifier build TypeScript**

```bash
pnpm build
```

Expected: build réussi.

- [ ] **Step 3.3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(linktree): types LeadMagnet + TrackedLink + LeadMagnetPlatform"
```

---

## Task 4: Générateur de short_code

**Files:**
- Create: `src/lib/lead-magnets/shortcode.ts`

- [ ] **Step 4.1: Écrire le générateur**

```typescript
// src/lib/lead-magnets/shortcode.ts
import { randomBytes } from 'crypto'

const ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const LENGTH = 6

/**
 * Génère un short_code aléatoire en base62.
 * Longueur 6 → ~56 milliards de combinaisons.
 */
export function generateShortCode(): string {
  const bytes = randomBytes(LENGTH)
  let code = ''
  for (let i = 0; i < LENGTH; i++) {
    code += ALPHABET[bytes[i] % ALPHABET.length]
  }
  return code
}
```

- [ ] **Step 4.2: Commit**

```bash
git add src/lib/lead-magnets/shortcode.ts
git commit -m "feat(linktree): générateur short_code base62"
```

---

## Task 5: Schémas de validation Zod

**Files:**
- Create: `src/lib/validations/lead-magnets.ts`

- [ ] **Step 5.1: Créer les schémas**

```typescript
// src/lib/validations/lead-magnets.ts
import { z } from 'zod'

const PLATFORMS = ['youtube','tiktok','instagram','podcast','blog','pdf','other'] as const

export const createLeadMagnetSchema = z.object({
  title: z.string().min(1).max(200),
  url: z.string().url().regex(/^https?:\/\//, 'URL doit commencer par http(s)://'),
  platform: z.enum(PLATFORMS).default('other'),
})

export const updateLeadMagnetSchema = createLeadMagnetSchema.partial()

export const trackForLeadSchema = z.object({
  lead_id: z.string().uuid(),
})

export type CreateLeadMagnetInput = z.infer<typeof createLeadMagnetSchema>
export type UpdateLeadMagnetInput = z.infer<typeof updateLeadMagnetSchema>
```

- [ ] **Step 5.2: Commit**

```bash
git add src/lib/validations/lead-magnets.ts
git commit -m "feat(linktree): schémas Zod lead-magnets"
```

---

## Task 6: API CRUD lead_magnets

**Files:**
- Create: `src/app/api/lead-magnets/route.ts`
- Create: `src/app/api/lead-magnets/[id]/route.ts`

- [ ] **Step 6.1: Route collection (GET + POST)**

```typescript
// src/app/api/lead-magnets/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { createLeadMagnetSchema } from '@/lib/validations/lead-magnets'

export async function GET() {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('lead_magnets')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return NextResponse.json({ lead_magnets: data })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const body = await request.json()
    const input = createLeadMagnetSchema.parse(body)
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('lead_magnets')
      .insert({ ...input, workspace_id: workspaceId })
      .select()
      .single()
    if (error) throw error
    return NextResponse.json({ lead_magnet: data }, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
```

- [ ] **Step 6.2: Route item (PATCH + DELETE)**

```typescript
// src/app/api/lead-magnets/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { updateLeadMagnetSchema } from '@/lib/validations/lead-magnets'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { workspaceId } = await getWorkspaceId()
    const body = await request.json()
    const input = updateLeadMagnetSchema.parse(body)
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('lead_magnets')
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .select()
      .single()
    if (error) throw error
    return NextResponse.json({ lead_magnet: data })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const { error } = await supabase
      .from('lead_magnets')
      .delete()
      .eq('id', id)
      .eq('workspace_id', workspaceId)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
```

- [ ] **Step 6.3: Vérifier build + commit**

```bash
pnpm build
```

```bash
git add src/app/api/lead-magnets
git commit -m "feat(linktree): API CRUD lead_magnets"
```

---

## Task 7: API track-for-lead (idempotent)

**Files:**
- Create: `src/app/api/lead-magnets/[id]/track-for-lead/route.ts`

- [ ] **Step 7.1: Écrire la route**

```typescript
// src/app/api/lead-magnets/[id]/track-for-lead/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { trackForLeadSchema } from '@/lib/validations/lead-magnets'
import { generateShortCode } from '@/lib/lead-magnets/shortcode'

const MAX_RETRIES = 3

function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leadMagnetId } = await params
    const { workspaceId } = await getWorkspaceId()
    const body = await request.json()
    const { lead_id } = trackForLeadSchema.parse(body)
    const supabase = await createClient()

    // Vérifier que lead_magnet et lead appartiennent au workspace
    const [{ data: lm }, { data: lead }] = await Promise.all([
      supabase.from('lead_magnets').select('id').eq('id', leadMagnetId).eq('workspace_id', workspaceId).single(),
      supabase.from('leads').select('id').eq('id', lead_id).eq('workspace_id', workspaceId).single(),
    ])
    if (!lm || !lead) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Idempotent : renvoyer l'existant si déjà présent
    const { data: existing } = await supabase
      .from('tracked_links')
      .select('short_code')
      .eq('lead_magnet_id', leadMagnetId)
      .eq('lead_id', lead_id)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({
        short_code: existing.short_code,
        full_url: `${getAppUrl()}/c/${existing.short_code}`,
      })
    }

    // Génération avec retry sur collision
    let attempt = 0
    while (attempt < MAX_RETRIES) {
      const short_code = generateShortCode()
      const { data, error } = await supabase
        .from('tracked_links')
        .insert({
          workspace_id: workspaceId,
          lead_magnet_id: leadMagnetId,
          lead_id,
          short_code,
        })
        .select('short_code')
        .single()
      if (!error && data) {
        return NextResponse.json({
          short_code: data.short_code,
          full_url: `${getAppUrl()}/c/${data.short_code}`,
        }, { status: 201 })
      }
      // Collision UNIQUE → retry
      if (error && error.code === '23505') {
        attempt++
        continue
      }
      throw error
    }
    return NextResponse.json({ error: 'Shortcode generation failed' }, { status: 500 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
```

- [ ] **Step 7.2: Vérifier build + commit**

```bash
pnpm build
```

```bash
git add src/app/api/lead-magnets/[id]/track-for-lead
git commit -m "feat(linktree): API track-for-lead idempotente"
```

---

## Task 8: Route publique /c/[code]

**Files:**
- Create: `src/app/c/[code]/route.ts`

- [ ] **Step 8.1: Écrire la route**

```typescript
// src/app/c/[code]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params
  const homepage = new URL('/', request.url).toString()

  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('tracked_links')
      .select('id, lead_magnet_id, clicks_count, first_clicked_at, lead_magnets(url)')
      .eq('short_code', code)
      .maybeSingle()

    if (error || !data || !data.lead_magnets) {
      return NextResponse.redirect(homepage, 302)
    }

    const targetUrl = (data.lead_magnets as unknown as { url: string }).url
    const now = new Date().toISOString()

    // Increment (fire-and-forget — ne pas bloquer le redirect si ça échoue)
    supabase
      .from('tracked_links')
      .update({
        clicks_count: (data.clicks_count ?? 0) + 1,
        last_clicked_at: now,
        first_clicked_at: data.first_clicked_at ?? now,
      })
      .eq('id', data.id)
      .then(() => {})

    return NextResponse.redirect(targetUrl, 302)
  } catch {
    return NextResponse.redirect(homepage, 302)
  }
}
```

- [ ] **Step 8.2: Vérifier service client existe**

```bash
grep -n "createServiceClient" src/lib/supabase/service.ts
```

Si la fonction s'appelle autrement, adapter l'import. Expected: exports `createServiceClient` ou similaire.

- [ ] **Step 8.3: Test manuel**

```bash
pnpm dev
```

1. Via Supabase SQL : insérer manuellement un `lead_magnet` + `tracked_link` avec short_code `test01`.
2. Ouvrir `http://localhost:3000/c/test01` dans le navigateur.
3. Vérifier : redirect vers l'URL du lead_magnet + `clicks_count` incrémenté.

- [ ] **Step 8.4: Commit**

```bash
git add src/app/c
git commit -m "feat(linktree): route publique /c/[code] redirect + tracking"
```

---

## Task 9: API stats par lead_magnet

**Files:**
- Create: `src/app/api/lead-magnets/[id]/stats/route.ts`

- [ ] **Step 9.1: Écrire la route**

```typescript
// src/app/api/lead-magnets/[id]/stats/route.ts
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

    const { data: links, error } = await supabase
      .from('tracked_links')
      .select('lead_id, clicks_count, last_clicked_at, leads(first_name, last_name)')
      .eq('lead_magnet_id', id)
      .eq('workspace_id', workspaceId)

    if (error) throw error
    const rows = links ?? []

    const total_clicks = rows.reduce((s, r) => s + (r.clicks_count ?? 0), 0)
    const unique_leads = rows.filter(r => (r.clicks_count ?? 0) > 0).length

    const top_leads = rows
      .filter(r => (r.clicks_count ?? 0) > 0)
      .sort((a, b) => (b.clicks_count ?? 0) - (a.clicks_count ?? 0))
      .slice(0, 10)
      .map(r => {
        const lead = r.leads as unknown as { first_name: string; last_name: string } | null
        return {
          lead_id: r.lead_id,
          name: lead ? `${lead.first_name} ${lead.last_name}` : 'Inconnu',
          clicks: r.clicks_count,
          last_clicked_at: r.last_clicked_at,
        }
      })

    return NextResponse.json({ total_clicks, unique_leads, top_leads })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
```

- [ ] **Step 9.2: Build + commit**

```bash
pnpm build
git add src/app/api/lead-magnets/[id]/stats
git commit -m "feat(linktree): API stats par lead_magnet"
```

---

## Task 10: API clics par lead

**Files:**
- Create: `src/app/api/leads/[id]/clicks/route.ts`

- [ ] **Step 10.1: Écrire la route**

```typescript
// src/app/api/leads/[id]/clicks/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leadId } = await params
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('tracked_links')
      .select('short_code, clicks_count, first_clicked_at, last_clicked_at, lead_magnet_id, lead_magnets(title, url, platform)')
      .eq('lead_id', leadId)
      .eq('workspace_id', workspaceId)
      .order('last_clicked_at', { ascending: false, nullsFirst: false })

    if (error) throw error
    return NextResponse.json({ tracked_links: data })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
```

- [ ] **Step 10.2: Build + commit**

```bash
pnpm build
git add src/app/api/leads/[id]/clicks
git commit -m "feat(linktree): API historique clics par lead"
```

---

## Task 11: Cron de purge

**Files:**
- Create: `src/app/api/cron/purge-tracked-links/route.ts`
- Modify: `vercel.json`

- [ ] **Step 11.1: Regarder comment est auth un autre cron existant**

```bash
cat src/app/api/cron/workflow-scheduler/route.ts
```

Noter le pattern de vérification `CRON_SECRET` header pour le reproduire.

- [ ] **Step 11.2: Écrire le cron**

```typescript
// src/app/api/cron/purge-tracked-links/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(request: NextRequest) {
  // Auth via CRON_SECRET (adapter selon le pattern existant)
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createServiceClient()
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

    const { data, error } = await supabase
      .from('tracked_links')
      .delete()
      .eq('clicks_count', 0)
      .lt('created_at', cutoff)
      .select('id')

    if (error) throw error

    return NextResponse.json({
      deleted: data?.length ?? 0,
      cutoff,
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
```

- [ ] **Step 11.3: Ajouter entrée dans vercel.json**

État actuel :
```json
{
  "crons": [
    { "path": "/api/cron/workflow-scheduler", "schedule": "0 8 * * *" }
  ]
}
```

À remplacer par :
```json
{
  "crons": [
    { "path": "/api/cron/workflow-scheduler", "schedule": "0 8 * * *" },
    { "path": "/api/cron/purge-tracked-links", "schedule": "0 3 * * *" }
  ]
}
```

- [ ] **Step 11.4: Build + commit**

```bash
pnpm build
git add src/app/api/cron/purge-tracked-links vercel.json
git commit -m "feat(linktree): cron quotidien purge tracked_links non cliqués >90j"
```

---

## Task 12: Refactor IA — charger lead_magnets depuis table

**Files:**
- Modify: `src/lib/ai/brief.ts`

- [ ] **Step 12.1: Lire l'état actuel**

```bash
cat src/lib/ai/brief.ts
```

Identifier comment `lead_magnets` (string JSON) est lu actuellement, et où la valeur est injectée dans le prompt.

- [ ] **Step 12.2: Remplacer le chargement**

Remplacer la lecture de `ai_coach_briefs.lead_magnets` par une requête sur la table :

```typescript
// Dans la fonction qui charge le brief :
const { data: leadMagnets } = await supabase
  .from('lead_magnets')
  .select('id, title, url, platform')
  .eq('workspace_id', workspaceId)
  .order('created_at', { ascending: false })

// Utiliser leadMagnets (tableau de {id,title,url,platform}) au lieu du JSON parsé
```

- [ ] **Step 12.3: Ajuster le prompt pour qu'il reçoive la liste structurée**

Dans `src/lib/ai/prompts.ts`, adapter la section qui injecte `lead_magnets` dans le prompt : passer de `const text = brief.lead_magnets` à une liste formatée :

```typescript
const leadMagnetsText = leadMagnets.length > 0
  ? leadMagnets.map(m => `- ${m.title}: ${m.url}`).join('\n')
  : 'Aucun lead magnet configuré.'
```

- [ ] **Step 12.4: Build + smoke test IA**

```bash
pnpm build
```

Lancer `pnpm dev`, ouvrir une fiche lead, déclencher une suggestion IA → vérifier qu'elle inclut bien les lead_magnets de la table.

- [ ] **Step 12.5: Commit**

```bash
git add src/lib/ai/brief.ts src/lib/ai/prompts.ts
git commit -m "refactor(ai): charger lead_magnets depuis table au lieu du JSON blob"
```

---

## Task 13: Post-process IA — remplacer URLs par short links

**Files:**
- Create: `src/lib/ai/replace-lead-magnet-urls.ts`
- Modify: appelant de la génération IA (cherché à l'étape 13.1)

- [ ] **Step 13.1: Identifier l'appelant**

```bash
grep -rn "anthropic\|generateMessage\|ai/brief" src/app/api/ai | head
```

Noter le fichier qui produit le message final renvoyé au client (probablement `src/app/api/ai/brief/route.ts` ou une route de génération de message).

- [ ] **Step 13.2: Écrire le helper**

```typescript
// src/lib/ai/replace-lead-magnet-urls.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { LeadMagnet } from '@/types'

interface Args {
  message: string
  leadId: string
  workspaceId: string
  leadMagnets: Pick<LeadMagnet, 'id' | 'url'>[]
  supabase: SupabaseClient
  appUrl: string
}

/**
 * Parcourt le message, détecte les URLs de lead_magnets,
 * remplace chacune par un short link trackable pour le lead donné.
 */
export async function replaceLeadMagnetUrls({
  message, leadId, workspaceId, leadMagnets, supabase, appUrl,
}: Args): Promise<string> {
  let out = message
  for (const lm of leadMagnets) {
    if (!out.includes(lm.url)) continue
    const shortCode = await ensureTrackedLink(supabase, workspaceId, lm.id, leadId)
    if (shortCode) {
      out = out.split(lm.url).join(`${appUrl}/c/${shortCode}`)
    }
  }
  return out
}

async function ensureTrackedLink(
  supabase: SupabaseClient,
  workspaceId: string,
  leadMagnetId: string,
  leadId: string,
): Promise<string | null> {
  const { data: existing } = await supabase
    .from('tracked_links')
    .select('short_code')
    .eq('lead_magnet_id', leadMagnetId)
    .eq('lead_id', leadId)
    .maybeSingle()
  if (existing) return existing.short_code

  const { generateShortCode } = await import('@/lib/lead-magnets/shortcode')
  for (let i = 0; i < 3; i++) {
    const short_code = generateShortCode()
    const { data, error } = await supabase
      .from('tracked_links')
      .insert({ workspace_id: workspaceId, lead_magnet_id: leadMagnetId, lead_id: leadId, short_code })
      .select('short_code')
      .single()
    if (!error && data) return data.short_code
    if (error?.code !== '23505') return null
  }
  return null
}
```

- [ ] **Step 13.3: Brancher le helper dans la route AI**

Dans le fichier identifié en 13.1, après la génération du message par Claude, avant de le renvoyer au client :

```typescript
import { replaceLeadMagnetUrls } from '@/lib/ai/replace-lead-magnet-urls'

// ... après la génération du message :
const finalMessage = await replaceLeadMagnetUrls({
  message: generatedMessage,
  leadId,
  workspaceId,
  leadMagnets, // déjà chargé à la task 12
  supabase,
  appUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
})

return NextResponse.json({ message: finalMessage })
```

- [ ] **Step 13.4: Smoke test**

`pnpm dev` → ouvrir une fiche lead avec lead_magnets configurés → générer une suggestion IA → vérifier que les URLs dans le message sont remplacées par `/c/xxx`.

- [ ] **Step 13.5: Commit**

```bash
git add src/lib/ai/replace-lead-magnet-urls.ts src/app/api/ai
git commit -m "feat(linktree): post-process IA — remplace URLs par short links trackables"
```

---

## Task 14: Page /acquisition/lead-magnets — CRUD

**Files:**
- Create: `src/app/(dashboard)/acquisition/lead-magnets/page.tsx`
- Create: `src/app/(dashboard)/acquisition/lead-magnets/lead-magnets-client.tsx`

- [ ] **Step 14.1: Server component (page.tsx)**

```tsx
// src/app/(dashboard)/acquisition/lead-magnets/page.tsx
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import LeadMagnetsClient from './lead-magnets-client'

export default async function LeadMagnetsPage() {
  const { workspaceId } = await getWorkspaceId()
  const supabase = await createClient()

  const { data: magnets } = await supabase
    .from('lead_magnets')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })

  // Agrégation stats via tracked_links (simple pour V1)
  const { data: stats } = await supabase
    .from('tracked_links')
    .select('lead_magnet_id, clicks_count, lead_id')
    .eq('workspace_id', workspaceId)

  return <LeadMagnetsClient initialMagnets={magnets ?? []} initialStats={stats ?? []} />
}
```

- [ ] **Step 14.2: Client component — tableau + modale CRUD**

```tsx
// src/app/(dashboard)/acquisition/lead-magnets/lead-magnets-client.tsx
'use client'
import { useState, useMemo } from 'react'
import type { LeadMagnet } from '@/types'

interface Stat { lead_magnet_id: string; clicks_count: number; lead_id: string }

interface Props {
  initialMagnets: LeadMagnet[]
  initialStats: Stat[]
}

const PLATFORMS: Array<{ value: LeadMagnet['platform']; label: string; emoji: string }> = [
  { value: 'youtube', label: 'YouTube', emoji: '🎥' },
  { value: 'tiktok', label: 'TikTok', emoji: '🎵' },
  { value: 'instagram', label: 'Instagram', emoji: '📷' },
  { value: 'podcast', label: 'Podcast', emoji: '🎧' },
  { value: 'blog', label: 'Blog', emoji: '📝' },
  { value: 'pdf', label: 'PDF', emoji: '📘' },
  { value: 'other', label: 'Autre', emoji: '🔗' },
]

export default function LeadMagnetsClient({ initialMagnets, initialStats }: Props) {
  const [magnets, setMagnets] = useState(initialMagnets)
  const [stats] = useState(initialStats)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<LeadMagnet | null>(null)

  const statsByMagnet = useMemo(() => {
    const map = new Map<string, { clicks: number; leads: Set<string> }>()
    stats.forEach(s => {
      if (!map.has(s.lead_magnet_id)) map.set(s.lead_magnet_id, { clicks: 0, leads: new Set() })
      const entry = map.get(s.lead_magnet_id)!
      entry.clicks += s.clicks_count
      if (s.clicks_count > 0) entry.leads.add(s.lead_id)
    })
    return map
  }, [stats])

  async function handleSave(input: Omit<LeadMagnet, 'id' | 'workspace_id' | 'created_at' | 'updated_at'>) {
    if (editing) {
      const res = await fetch(`/api/lead-magnets/${editing.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      const { lead_magnet } = await res.json()
      setMagnets(magnets.map(m => m.id === editing.id ? lead_magnet : m))
    } else {
      const res = await fetch('/api/lead-magnets', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      const { lead_magnet } = await res.json()
      setMagnets([lead_magnet, ...magnets])
    }
    setModalOpen(false); setEditing(null)
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer ce lead magnet ?')) return
    await fetch(`/api/lead-magnets/${id}`, { method: 'DELETE' })
    setMagnets(magnets.filter(m => m.id !== id))
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ color: 'var(--color-text-primary)', fontSize: 24, fontWeight: 700 }}>Lead Magnets</h1>
        <button
          onClick={() => { setEditing(null); setModalOpen(true) }}
          style={{
            padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer',
          }}
        >
          + Nouveau contenu
        </button>
      </div>

      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
              <th style={th}>Titre</th>
              <th style={th}>Plateforme</th>
              <th style={th}>Clics totaux</th>
              <th style={th}>Leads uniques</th>
              <th style={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {magnets.length === 0 && (
              <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-secondary)' }}>Aucun lead magnet</td></tr>
            )}
            {magnets.map(m => {
              const s = statsByMagnet.get(m.id)
              const platform = PLATFORMS.find(p => p.value === m.platform)
              return (
                <tr key={m.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={td}>
                    <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{m.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>{m.url}</div>
                  </td>
                  <td style={td}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <span>{platform?.emoji}</span>
                      <span>{platform?.label}</span>
                    </span>
                  </td>
                  <td style={td}>{s?.clicks ?? 0}</td>
                  <td style={td}>{s?.leads.size ?? 0}</td>
                  <td style={td}>
                    <button onClick={() => { setEditing(m); setModalOpen(true) }} style={btnSecondary}>Éditer</button>
                    <button onClick={() => handleDelete(m.id)} style={{ ...btnSecondary, marginLeft: 8, color: '#E53E3E' }}>Supprimer</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <LeadMagnetModal
          initial={editing}
          onClose={() => { setModalOpen(false); setEditing(null) }}
          onSave={handleSave}
        />
      )}
    </div>
  )
}

const th: React.CSSProperties = { padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }
const td: React.CSSProperties = { padding: '14px 16px', fontSize: 13, color: 'var(--color-text-primary)' }
const btnSecondary: React.CSSProperties = { padding: '4px 10px', borderRadius: 6, fontSize: 12, background: 'transparent', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', cursor: 'pointer' }

function LeadMagnetModal({ initial, onClose, onSave }: {
  initial: LeadMagnet | null
  onClose: () => void
  onSave: (input: { title: string; url: string; platform: LeadMagnet['platform'] }) => void
}) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [url, setUrl] = useState(initial?.url ?? '')
  const [platform, setPlatform] = useState<LeadMagnet['platform']>(initial?.platform ?? 'other')

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--color-surface)', padding: 24, borderRadius: 12, width: 480, border: '1px solid var(--color-border)' }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: 'var(--color-text-primary)' }}>{initial ? 'Éditer' : 'Nouveau'} lead magnet</h2>
        <label style={labelStyle}>Titre</label>
        <input value={title} onChange={e => setTitle(e.target.value)} style={inputStyle} />
        <label style={labelStyle}>URL</label>
        <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." style={inputStyle} />
        <label style={labelStyle}>Plateforme</label>
        <select value={platform} onChange={e => setPlatform(e.target.value as LeadMagnet['platform'])} style={inputStyle}>
          {PLATFORMS.map(p => <option key={p.value} value={p.value}>{p.emoji} {p.label}</option>)}
        </select>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button onClick={onClose} style={btnSecondary}>Annuler</button>
          <button
            onClick={() => title && url && onSave({ title, url, platform })}
            style={{ padding: '8px 16px', borderRadius: 6, background: 'var(--color-primary)', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer' }}
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginTop: 12, marginBottom: 4 }
const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 6, background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', fontSize: 13 }
```

- [ ] **Step 14.3: Build + test UI**

```bash
pnpm build
pnpm dev
```

Ouvrir `http://localhost:3000/acquisition/lead-magnets`. Tester : créer, éditer, supprimer un lead magnet.

- [ ] **Step 14.4: Commit**

```bash
git add "src/app/(dashboard)/acquisition/lead-magnets"
git commit -m "feat(linktree): page Acquisition > Lead Magnets (CRUD)"
```

---

## Task 15: Widget LeadMagnetsWidget (fiche lead)

**Files:**
- Create: `src/components/leads/LeadMagnetsWidget.tsx`
- Modify: `src/components/shared/LeadSidePanel.tsx`
- Modify: `src/app/(dashboard)/leads/[id]/page.tsx` (ou équivalent server)

- [ ] **Step 15.1: Écrire le widget**

```tsx
// src/components/leads/LeadMagnetsWidget.tsx
'use client'
import { useEffect, useState } from 'react'
import type { LeadMagnet } from '@/types'

interface TrackedLinkInfo {
  short_code: string
  clicks_count: number
  last_clicked_at: string | null
  lead_magnet_id: string
}

interface Props { leadId: string }

const PLATFORM_EMOJI: Record<LeadMagnet['platform'], string> = {
  youtube: '🎥', tiktok: '🎵', instagram: '📷',
  podcast: '🎧', blog: '📝', pdf: '📘', other: '🔗',
}

export default function LeadMagnetsWidget({ leadId }: Props) {
  const [magnets, setMagnets] = useState<LeadMagnet[]>([])
  const [tracks, setTracks] = useState<TrackedLinkInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/lead-magnets').then(r => r.json()),
      fetch(`/api/leads/${leadId}/clicks`).then(r => r.json()),
    ]).then(([{ lead_magnets }, { tracked_links }]) => {
      setMagnets(lead_magnets ?? [])
      setTracks(tracked_links ?? [])
      setLoading(false)
    })
  }, [leadId])

  async function handleCopy(magnetId: string) {
    const res = await fetch(`/api/lead-magnets/${magnetId}/track-for-lead`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lead_id: leadId }),
    })
    const { full_url, short_code } = await res.json()
    if (full_url) {
      await navigator.clipboard.writeText(full_url)
      setToast('Lien copié !')
      setTimeout(() => setToast(null), 2000)
      // Maj locale des tracks pour afficher le lien créé si nouveau
      setTracks(prev => prev.some(t => t.lead_magnet_id === magnetId)
        ? prev
        : [...prev, { short_code, clicks_count: 0, last_clicked_at: null, lead_magnet_id: magnetId }])
    }
  }

  if (loading) return <div style={{ padding: 12, color: 'var(--color-text-secondary)', fontSize: 12 }}>Chargement…</div>
  if (magnets.length === 0) return (
    <div style={{ padding: 12, color: 'var(--color-text-secondary)', fontSize: 12 }}>
      Aucun lead magnet configuré. <a href="/acquisition/lead-magnets" style={{ color: 'var(--color-primary)' }}>En créer un</a>.
    </div>
  )

  const trackByMagnet = new Map(tracks.map(t => [t.lead_magnet_id, t]))

  return (
    <div style={{ padding: 12, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 10, textTransform: 'uppercase' }}>
        Lead Magnets
      </div>
      {magnets.map(m => {
        const t = trackByMagnet.get(m.id)
        const lastLabel = t?.last_clicked_at
          ? `${t.clicks_count} clic${t.clicks_count > 1 ? 's' : ''} · dernier ${formatRelative(t.last_clicked_at)}`
          : 'pas encore cliqué'
        return (
          <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 13, color: 'var(--color-text-primary)' }}>
                <span style={{ marginRight: 6 }}>{PLATFORM_EMOJI[m.platform]}</span>{m.title}
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>{lastLabel}</div>
            </div>
            <button
              onClick={() => handleCopy(m.id)}
              style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer' }}
            >
              Copier lien
            </button>
          </div>
        )
      })}
      {toast && (
        <div style={{ position: 'fixed', bottom: 20, right: 20, padding: '10px 16px', background: '#38A169', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 600, zIndex: 100 }}>
          {toast}
        </div>
      )}
    </div>
  )
}

function formatRelative(iso: string): string {
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 60) return `il y a ${minutes}min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `il y a ${hours}h`
  const days = Math.floor(hours / 24)
  return `il y a ${days}j`
}
```

- [ ] **Step 15.2: Intégrer dans LeadSidePanel**

Dans `src/components/shared/LeadSidePanel.tsx`, ajouter l'import et le widget dans le body du panel :

```tsx
import LeadMagnetsWidget from '@/components/leads/LeadMagnetsWidget'

// ... dans le JSX, après les sections existantes (ex. après tags ou notes) :
<div style={{ marginTop: 16 }}>
  <LeadMagnetsWidget leadId={lead.id} />
</div>
```

(Emplacement exact à adapter selon la structure du panel.)

- [ ] **Step 15.3: Intégrer dans la page fiche lead `/leads/[id]`**

Repérer le fichier :
```bash
ls "src/app/(dashboard)/leads/[id]"
```

Ajouter le widget dans une section visible (sidebar droite ou colonne principale), avec le même pattern qu'au 15.2.

- [ ] **Step 15.4: Test UI**

```bash
pnpm dev
```

1. Ouvrir un lead (side panel + fiche).
2. Vérifier : widget affiche les magnets, bouton "Copier lien" marche (vérif presse-papier + toast).
3. Coller le lien dans un onglet → doit rediriger correctement.
4. Rouvrir la fiche → le magnet cliqué affiche maintenant "1 clic · dernier il y a Xmin".

- [ ] **Step 15.5: Commit**

```bash
git add src/components/leads/LeadMagnetsWidget.tsx src/components/shared/LeadSidePanel.tsx "src/app/(dashboard)/leads/[id]"
git commit -m "feat(linktree): widget LeadMagnets dans fiche lead + side panel"
```

---

## Task 16: Simplifier AI settings step 5

**Files:**
- Modify: `src/app/(dashboard)/parametres/assistant-ia/ai-settings-client.tsx`
- Delete: `src/components/ai/LeadMagnetEditor.tsx`

- [ ] **Step 16.1: Remplacer l'étape 5**

Dans `ai-settings-client.tsx`, remplacer le `<LeadMagnetEditor />` (ligne ~377 et ~702) par un écran informatif :

```tsx
{step === 5 && (
  <div style={{ padding: 24, textAlign: 'center' }}>
    <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Lead Magnets</h3>
    <p style={{ color: 'var(--color-text-secondary)', fontSize: 13, marginBottom: 16 }}>
      Les lead magnets sont gérés dans la page dédiée.
    </p>
    <a href="/acquisition/lead-magnets" style={{ color: 'var(--color-primary)', fontSize: 13, fontWeight: 600 }}>
      Aller à Acquisition › Lead Magnets →
    </a>
  </div>
)}
```

Et supprimer le 2ème emplacement (ligne ~702) de la même façon.

Supprimer aussi l'import `import LeadMagnetEditor from '@/components/ai/LeadMagnetEditor'` et toutes les refs à `answers.lead_magnets` / `brief.lead_magnets` (la colonne n'existe plus en DB).

- [ ] **Step 16.2: Supprimer le composant obsolète**

```bash
rm src/components/ai/LeadMagnetEditor.tsx
```

- [ ] **Step 16.3: Nettoyer le type `Brief` dans `src/types/index.ts`**

Retirer `lead_magnets: string` du type du brief (le champ n'existe plus).

- [ ] **Step 16.4: Vérifier build**

```bash
pnpm build
```

Si erreurs TS sur d'autres fichiers qui utilisaient `brief.lead_magnets`, les corriger (probablement `src/lib/ai/brief.ts` déjà fait en task 12).

- [ ] **Step 16.5: Commit**

```bash
git add -A
git commit -m "refactor(ai): étape 5 settings renvoie vers page Lead Magnets + drop LeadMagnetEditor"
```

---

## Task 17: Entrée sidebar

**Files:**
- Modify: `src/components/layout/Sidebar.tsx` (ou équivalent — localiser d'abord)

- [ ] **Step 17.1: Localiser la sidebar**

```bash
grep -rn "Automations\|Publicités\|Acquisition" src/components/layout src/components/shared 2>/dev/null | head
```

Noter le fichier qui contient les entrées de la section Acquisition.

- [ ] **Step 17.2: Ajouter l'entrée**

Ajouter une entrée "Lead Magnets" entre Automations et Publicités, suivant le pattern existant :

```tsx
// Exemple (adapter au format réel trouvé) :
{
  label: 'Lead Magnets',
  href: '/acquisition/lead-magnets',
  icon: LinkIcon, // ou équivalent
}
```

- [ ] **Step 17.3: Build + test**

```bash
pnpm build
pnpm dev
```

Vérifier que l'entrée apparaît dans la sidebar, que le lien route bien vers la page.

- [ ] **Step 17.4: Commit**

```bash
git add src/components/layout src/components/shared
git commit -m "feat(linktree): entrée sidebar Acquisition > Lead Magnets"
```

---

## Task 18: Vérification finale + docs

**Files:**
- Modify: `etat.md`
- Modify: `ameliorations.md` (marquer A-010 comme fait)
- Modify: `taches/taches-pierre.md`

- [ ] **Step 18.1: Test E2E manuel complet**

1. Créer 2 lead magnets (YouTube + PDF) depuis la page dédiée.
2. Ouvrir un lead, copier le lien YouTube trackable → coller dans un onglet → redirect OK + app native (mobile).
3. Rouvrir la fiche lead → "1 clic" affiché.
4. Rouvrir `/acquisition/lead-magnets` → "clics totaux" + "leads uniques" incrémenté.
5. Déclencher une suggestion IA → vérifier que l'URL est remplacée par `/c/xxx`.
6. Supprimer un lead magnet → vérifier que ses tracked_links disparaissent (cascade).

- [ ] **Step 18.2: Mettre à jour etat.md**

Ajouter une ligne dans le tableau des modules terminés :

```markdown
| Linktree interne (A-010) | Pierre | ✅ |
```

Mettre à jour la date en entête.

- [ ] **Step 18.3: Mettre à jour ameliorations.md**

Remplacer `### [A-010] Linktree interne` par `### [A-010] ✅ Linktree interne — liens trackables par lead` en notant la date de livraison.

- [ ] **Step 18.4: Mettre à jour taches-pierre.md**

Dans le backlog, remplacer :
```markdown
- [ ] **A-010** — Linktree interne : liens trackables par lead
```

par :
```markdown
- [x] **A-010** — Linktree interne : liens trackables par lead (livré 2026-04-17)
```

- [ ] **Step 18.5: Commit final**

```bash
git add etat.md ameliorations.md taches/taches-pierre.md
git commit -m "docs(linktree): marque A-010 comme livré"
```

---

## Task 19: PR develop + main

- [ ] **Step 19.1: Push**

```bash
git push -u origin feature/pierre-linktree
```

- [ ] **Step 19.2: PR vers develop**

```bash
gh pr create --base develop --title "feat: A-010 Linktree interne — liens trackables par lead" --body "$(cat <<'EOF'
## Summary
- Nouvelles tables `lead_magnets` + `tracked_links` (migration 029)
- Migration du JSON `ai_coach_briefs.lead_magnets` → rows structurées
- Route publique `/c/[code]` (redirect + tracking)
- Page Acquisition > Lead Magnets (CRUD + stats)
- Widget fiche lead (liste + bouton copier lien)
- Post-process IA : URLs brutes remplacées par short links dans messages suggérés
- Cron purge quotidien (tracked_links non cliqués > 90j)

Spec : `docs/superpowers/specs/2026-04-17-linktree-interne-design.md`

## Test plan
- [x] Build passe
- [x] CRUD lead_magnets depuis la page dédiée
- [x] Copier lien → presse-papier → redirect OK + incrément clics
- [x] IA remplace les URLs dans les messages suggérés
- [x] Migration 029 appliquée sur Supabase

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 19.3: Merge après review**

```bash
gh pr merge <PR_NUMBER> --merge --admin
```

- [ ] **Step 19.4: Release vers main**

```bash
git checkout develop && git pull
gh pr create --base main --head develop --title "release: Linktree interne (A-010)" --body "Promote develop → main.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
gh pr merge <PR_NUMBER> --merge --admin
```

---

## Spec coverage check (self-review)

| Spec requirement | Task |
|---|---|
| Table `lead_magnets` + RLS | Task 2 |
| Table `tracked_links` + RLS + unique(lead_magnet_id,lead_id) | Task 2 |
| Migration JSON → rows + drop column | Task 2 |
| Types TypeScript | Task 3 |
| Générateur short_code base62 | Task 4 |
| Validation Zod | Task 5 |
| API CRUD lead_magnets | Task 6 |
| API track-for-lead idempotente + retry collision | Task 7 |
| Redirect public `/c/[code]` + increment | Task 8 |
| Stats par magnet (total/unique/top_leads) | Task 9 |
| Historique clics par lead | Task 10 |
| Cron purge 90j + entrée vercel.json | Task 11 |
| IA charge lead_magnets depuis table | Task 12 |
| Post-process IA remplace URLs | Task 13 |
| Page `/acquisition/lead-magnets` | Task 14 |
| Widget fiche lead | Task 15 |
| Settings AI step 5 simplifié | Task 16 |
| Sidebar entry | Task 17 |
| Vérif E2E + docs | Task 18 |

**Rate limit bot sur `/c/[code]`** : accepté dans le spec pour V1 (dup mineure ok). Pas de task dédiée — on verra en V2 si besoin.

**Drawer stats détaillé (timeline Recharts + top leads)** : la page liste affiche les chiffres agrégés. Le drawer avec timeline est repoussé : tâche post-livraison si besoin. Ajouté au backlog implicite via le commentaire « dernière date » / top leads — si tu veux un drawer, dis-le et on ajoute Task 14bis.

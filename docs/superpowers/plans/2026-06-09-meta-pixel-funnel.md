# Meta Pixel Funnel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow a coach to enter a Meta Pixel ID per funnel so that public pages automatically inject the fbq script and fire `PageView`, `Lead`, and `Schedule` events.

**Architecture:** Add `meta_pixel_id TEXT` to the `funnels` table, expose it through the existing PUT API, wire a new `TrackingPanel` sidebar component in the builder, then inject `<Script>` on the public SSR page and fire standard events from FormBlock and BookingBlock.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase (PostgreSQL), shadcn/ui (not used here — raw inline styles matching existing pattern), `next/script`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `supabase/migrations/083_funnel_meta_pixel.sql` | Create | Add `meta_pixel_id` column to `funnels` |
| `src/types/index.ts` | Modify | Add `meta_pixel_id` to `Funnel` interface |
| `src/types/globals.d.ts` | Create | Declare `window.fbq` globally |
| `src/app/api/funnels/[id]/route.ts` | Modify | Accept `meta_pixel_id` in PUT body |
| `src/components/funnels/v2/sidebar/TrackingPanel.tsx` | Create | UI: Pixel ID input + collapsible guide |
| `src/components/funnels/v2/FunnelBuilderV2.tsx` | Modify | Add `meta_pixel_id` prop + `onMetaPixelChange` callback + render TrackingPanel |
| `src/app/(dashboard)/acquisition/funnels/[id]/page.tsx` | Modify | State + PATCH handler for `meta_pixel_id` |
| `src/app/f/[workspaceSlug]/[funnelSlug]/[pageSlug]/page.tsx` | Modify | Load + inject `<Script>` fbq |
| `src/components/funnels/blocks/FormBlock.tsx` | Modify | Fire `Lead` on successful submit |
| `src/components/funnels/blocks/BookingBlock.tsx` | Modify | Fire `Schedule` on booking confirmed |

---

## Task 1: DB Migration + Funnel type

**Files:**
- Create: `supabase/migrations/083_funnel_meta_pixel.sql`
- Modify: `src/types/index.ts`

- [ ] **Step 1: Create migration file**

```sql
-- supabase/migrations/083_funnel_meta_pixel.sql
ALTER TABLE funnels ADD COLUMN meta_pixel_id TEXT;
```

- [ ] **Step 2: Run migration in Supabase dashboard**

Go to Supabase > SQL Editor, paste and run the migration.
Expected: no error, column `meta_pixel_id` appears in the `funnels` table.

- [ ] **Step 3: Add `meta_pixel_id` to the `Funnel` interface**

In `src/types/index.ts`, find the `Funnel` interface (around line 558) and add the new field after `effects_config`:

```typescript
export interface Funnel {
  id: string
  workspace_id: string
  name: string
  slug: string
  description: string | null
  domain_id: string | null
  status: FunnelStatus
  preset_id: string
  preset_override: FunnelPresetOverrideJSON | null
  effects_config: FunnelEffectsConfigJSON
  meta_pixel_id: string | null   // ← add this line
  created_at: string
  updated_at: string
}
```

- [ ] **Step 4: Type check**

```bash
npx tsc --noEmit
```

Expected: no new errors (there may be pre-existing ones — only care about new ones).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/083_funnel_meta_pixel.sql src/types/index.ts
git commit -m "feat(funnels/pixel): add meta_pixel_id column + Funnel type"
```

---

## Task 2: Declare `window.fbq` globally

**Files:**
- Create: `src/types/globals.d.ts`

- [ ] **Step 1: Create the global type declaration**

```typescript
// src/types/globals.d.ts
export {}

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void
    _fbq?: unknown
  }
}
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/types/globals.d.ts
git commit -m "feat(funnels/pixel): declare window.fbq global type"
```

---

## Task 3: Update PUT API route to accept `meta_pixel_id`

**Files:**
- Modify: `src/app/api/funnels/[id]/route.ts` (lines 55–85)

The GET route already uses `select('*')` so it will return `meta_pixel_id` automatically after the migration. Only the PUT needs updating.

- [ ] **Step 1: Destructure `meta_pixel_id` from the request body**

In `PUT`, find the destructuring block (around line 55) and add `meta_pixel_id`:

```typescript
const {
  name,
  slug,
  description,
  domain_id,
  preset_id,
  preset_override,
  effects_config,
  meta_pixel_id,   // ← add this
} = body
```

- [ ] **Step 2: Add it to the `updates` object**

After the `effects_config` block (around line 84), add:

```typescript
// meta_pixel_id: null clears the pixel, string sets it, undefined = no change
if (meta_pixel_id !== undefined) {
  updates.meta_pixel_id = typeof meta_pixel_id === 'string' && meta_pixel_id.trim()
    ? meta_pixel_id.trim()
    : null
}
```

- [ ] **Step 3: Type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/funnels/\[id\]/route.ts
git commit -m "feat(funnels/pixel): PUT route accepts meta_pixel_id"
```

---

## Task 4: Create `TrackingPanel` sidebar component

**Files:**
- Create: `src/components/funnels/v2/sidebar/TrackingPanel.tsx`

This panel matches the visual style of `DirectionArtistiquePanel` (dark background, inline styles, no Tailwind).

- [ ] **Step 1: Create the component**

```typescript
'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

interface Props {
  metaPixelId: string | null
  onMetaPixelChange: (pixelId: string | null) => void
}

export default function TrackingPanel({ metaPixelId, onMetaPixelChange }: Props) {
  const [open, setOpen] = useState(true)
  const [guideOpen, setGuideOpen] = useState(false)

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value.trim()
    onMetaPixelChange(val || null)
  }

  return (
    <div style={{ borderTop: '1px solid #262626' }}>
      {/* ─── Header ──────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', padding: '12px 16px',
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: '#A0A0A0', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        TRACKING &amp; PIXELS
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div style={{ padding: '0 16px 16px' }}>
          {/* ─── Pixel ID field ──────────────────────────────────── */}
          <label style={labelStyle}>Facebook Pixel ID</label>
          <input
            type="text"
            placeholder="Ex: 123456789012345"
            defaultValue={metaPixelId ?? ''}
            onBlur={handleInput}
            style={inputStyle}
          />

          {/* ─── Guide accordion ─────────────────────────────────── */}
          <button
            onClick={() => setGuideOpen((v) => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: '#E53E3E', fontSize: 12, fontWeight: 600,
              padding: '8px 0 0', marginTop: 4,
            }}
          >
            {guideOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {guideOpen ? 'Masquer le guide' : 'Afficher le guide'}
          </button>

          {guideOpen && (
            <div style={guideStyle}>
              <p style={guideTitleStyle}>Facebook Pixel</p>
              <ol style={{ margin: '8px 0', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {[
                  'Allez dans Meta Events Manager',
                  'Cliquez sur "Connecter des sources de données → Web"',
                  'Choisissez "Meta Pixel"',
                  "Copiez l'ID du pixel (nombre à 15 chiffres)",
                  'Collez-le dans le champ Facebook Pixel ID ci-dessus',
                ].map((step, i) => (
                  <li key={i} style={{ fontSize: 12, color: '#A0A0A0', lineHeight: 1.5 }}>{step}</li>
                ))}
              </ol>
              <p style={{ fontSize: 11, color: '#666', margin: '8px 0 0', lineHeight: 1.5 }}>
                Les events (PageView, Lead, Schedule) se déclenchent automatiquement sur vos funnels.
              </p>
              <div style={{ borderTop: '1px solid #262626', marginTop: 12, paddingTop: 12 }}>
                <p style={guideTitleStyle}>Events automatiques</p>
                {[
                  { name: 'PageView', desc: 'chargement de chaque page' },
                  { name: 'Lead', desc: 'formulaire soumis' },
                  { name: 'Schedule', desc: 'call réservé' },
                ].map(({ name, desc }) => (
                  <div key={name} style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#E53E3E', minWidth: 80 }}>{name}</span>
                    <span style={{ fontSize: 11, color: '#A0A0A0' }}>{desc}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600,
  color: '#A0A0A0', marginBottom: 6,
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', fontSize: 13,
  background: '#1A1A1A', border: '1px solid #333',
  borderRadius: 8, color: '#fff', outline: 'none',
  fontFamily: 'Poppins, sans-serif', boxSizing: 'border-box',
}

const guideStyle: React.CSSProperties = {
  marginTop: 12, padding: 12,
  background: '#1A1A1A', borderRadius: 8,
  border: '1px solid #262626',
}

const guideTitleStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, color: '#fff', margin: 0,
}
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/funnels/v2/sidebar/TrackingPanel.tsx
git commit -m "feat(funnels/pixel): TrackingPanel sidebar component"
```

---

## Task 5: Integrate `TrackingPanel` in `FunnelBuilderV2`

**Files:**
- Modify: `src/components/funnels/v2/FunnelBuilderV2.tsx`

- [ ] **Step 1: Add `meta_pixel_id` to the `funnel` prop type and add `onMetaPixelChange` callback**

Find the `interface Props` block (around line 78) and update it:

```typescript
interface Props {
  /** Funnel parent (avec design system v2). */
  funnel: Pick<Funnel, 'id' | 'preset_id' | 'preset_override' | 'effects_config' | 'meta_pixel_id'>
  pages: FunnelPage[]
  activePageId: string
  onPagesChange: (pages: FunnelPage[]) => void
  onFunnelDesignChange: (changes: {
    preset_id?: string
    preset_override?: FunnelPresetOverrideJSON | null
    effects_config?: FunnelEffectsConfigJSON
  }) => void
  onMetaPixelChange: (pixelId: string | null) => void   // ← add this
  mode: FunnelPreviewMode
}
```

- [ ] **Step 2: Import TrackingPanel**

At the top of the file, add the import after the other sidebar imports:

```typescript
import TrackingPanel from './sidebar/TrackingPanel'
```

- [ ] **Step 3: Destructure the new props and render TrackingPanel**

In the function signature, add `onMetaPixelChange` to the destructuring:

```typescript
export default function FunnelBuilderV2({
  funnel,
  pages,
  activePageId,
  onPagesChange,
  onFunnelDesignChange,
  onMetaPixelChange,   // ← add this
  mode,
}: Props) {
```

In the sidebar JSX (after the `SectionsListPanel` and its separator), add:

```tsx
{/* Tracking & Pixels */}
<TrackingPanel
  metaPixelId={funnel.meta_pixel_id}
  onMetaPixelChange={onMetaPixelChange}
/>
```

- [ ] **Step 4: Type check**

```bash
npx tsc --noEmit
```

Expected: TypeScript will report that the `<FunnelBuilderV2>` call in `page.tsx` is missing `onMetaPixelChange` — that's intentional, we fix it in Task 6.

- [ ] **Step 5: Commit**

```bash
git add src/components/funnels/v2/FunnelBuilderV2.tsx
git commit -m "feat(funnels/pixel): FunnelBuilderV2 accepts meta_pixel_id + TrackingPanel"
```

---

## Task 6: Wire state in editor page

**Files:**
- Modify: `src/app/(dashboard)/acquisition/funnels/[id]/page.tsx`

- [ ] **Step 1: Add `meta_pixel_id` to `FunnelData` interface**

Find the `interface FunnelData` (around line 25) and add the field:

```typescript
interface FunnelData {
  id: string
  name: string
  slug: string
  status: 'draft' | 'published'
  preset_id: string
  preset_override: FunnelPresetOverrideJSON | null
  effects_config: FunnelEffectsConfigJSON
  meta_pixel_id: string | null   // ← add this
  pages: FunnelPage[]
}
```

- [ ] **Step 2: Add `handleMetaPixelChange` callback**

After `handleFunnelDesignChange` (around line 228), add:

```typescript
const handleMetaPixelChange = useCallback(
  (pixelId: string | null) => {
    setFunnel((prev) => (prev ? { ...prev, meta_pixel_id: pixelId } : prev))
    fetch(`/api/funnels/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meta_pixel_id: pixelId }),
    }).catch(() => {})
  },
  [id],
)
```

- [ ] **Step 3: Pass `onMetaPixelChange` to `FunnelBuilderV2`**

Find the `<FunnelBuilderV2>` JSX (around line 823) and add the prop:

```tsx
<FunnelBuilderV2
  funnel={funnel}
  pages={pages}
  activePageId={activePageId}
  onPagesChange={setPages}
  onFunnelDesignChange={handleFunnelDesignChange}
  onMetaPixelChange={handleMetaPixelChange}   // ← add this
  mode={mode}
/>
```

- [ ] **Step 4: Type check — should be clean now**

```bash
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 5: Manual test — editor saves pixel ID**

1. Start the dev server: `npm run dev`
2. Open a funnel in the editor
3. Scroll to the bottom of the left sidebar — "TRACKING & PIXELS" section should appear
4. Enter a fake Pixel ID like `123456789012345` and click outside (blur)
5. Reload the page — the value should persist (verify the PUT was sent in the browser Network tab)

- [ ] **Step 6: Commit**

```bash
git add src/app/\(dashboard\)/acquisition/funnels/\[id\]/page.tsx
git commit -m "feat(funnels/pixel): wire meta_pixel_id state and PATCH in editor"
```

---

## Task 7: Inject pixel script on public page

**Files:**
- Modify: `src/app/f/[workspaceSlug]/[funnelSlug]/[pageSlug]/page.tsx`

- [ ] **Step 1: Add `meta_pixel_id` to `loadFunnelPageData`**

Find the funnel query (around line 110) and add `meta_pixel_id` to the select:

```typescript
const { data: funnel } = await supabase
  .from('funnels')
  .select('id, preset_id, preset_override, effects_config, meta_pixel_id')
  .eq('workspace_id', workspaceId)
  .eq('slug', funnelSlug)
  .eq('status', 'published')
  .single()
```

- [ ] **Step 2: Add `meta_pixel_id` to `FunnelDesignFromApi` interface and `PageData`**

Find the `interface FunnelDesignFromApi` (around line 74) and add the field:

```typescript
interface FunnelDesignFromApi {
  preset_id: string
  preset_override: FunnelPresetOverrideJSON | null
  effects_config: FunnelEffectsConfigJSON
  meta_pixel_id: string | null   // ← add this
}
```

In the `return` of `loadFunnelPageData`, pass through the value:

```typescript
return {
  page: page as FunnelPage,
  funnel: {
    preset_id: funnel.preset_id,
    preset_override: funnel.preset_override,
    effects_config: funnel.effects_config,
    meta_pixel_id: funnel.meta_pixel_id ?? null,   // ← add this
  },
  branding: {
    accentColor: workspace?.accent_color ?? '#E53E3E',
    logoUrl: workspace?.logo_url ?? null,
    workspaceName: workspace?.name ?? '',
  },
}
```

- [ ] **Step 3: Import `Script` from `next/script`**

At the top of the file, add after the existing imports:

```typescript
import Script from 'next/script'
```

- [ ] **Step 4: Inject the pixel script in the page component**

In `PublicFunnelPage`, destructure `meta_pixel_id` from `funnel`:

```typescript
const { page, funnel, branding } = data
const accentColor = branding.accentColor
const design = loadFunnelDesign(funnel)
const metaPixelId = funnel.meta_pixel_id   // ← add this
```

Then in the JSX return, add the Script block right after the opening `<>`:

```tsx
return (
  <>
    {metaPixelId && (
      <Script
        id="meta-pixel"
        strategy="afterInteractive"
      >{`
        !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};
        if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
        n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t,s)}(window,document,'script',
        'https://connect.facebook.net/en_US/fbevents.js');
        fbq('init', '${metaPixelId}');
        fbq('track', 'PageView');
      `}</Script>
    )}
    <style>{`
      :root { --color-primary: ${accentColor}; }
      ...
    `}</style>
    ...
  </>
)
```

- [ ] **Step 5: Type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Manual test — pixel loads on public page**

1. In the editor, set a Pixel ID on a published funnel
2. Open the public URL in an incognito tab
3. Open browser DevTools > Network, filter by `fbevents`
4. Reload — you should see a request to `connect.facebook.net/en_US/fbevents.js`
5. In the Console, run `window.fbq` — should return a function (not `undefined`)

- [ ] **Step 7: Commit**

```bash
git add "src/app/f/[workspaceSlug]/[funnelSlug]/[pageSlug]/page.tsx"
git commit -m "feat(funnels/pixel): inject Meta Pixel script on public pages"
```

---

## Task 8: Fire `Lead` event in `FormBlock`

**Files:**
- Modify: `src/components/funnels/blocks/FormBlock.tsx`

- [ ] **Step 1: Add `window.fbq` call after successful form submit**

In `handleSubmit`, find the `if (res.ok)` block. After the `if (!res.ok)` guard (around line 60), and before the redirect/setSubmitted logic, add:

```typescript
if (!res.ok) {
  const data = await res.json()
  setError(data.error ?? "Erreur lors de l'envoi.")
  return
}

// Fire Meta Pixel Lead event if pixel is active on this page
window.fbq?.('track', 'Lead')   // ← add this line

// Redirect or show success message
if (config.redirectUrl) {
  window.location.href = resolveFunnelUrl(config.redirectUrl)
  return
}

setSubmitted(true)
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Manual test — Lead event fires**

1. Open a published funnel with a FormBlock and a Pixel ID configured
2. Open browser DevTools > Network, filter by `facebook.com/tr`
3. Submit the form
4. You should see a POST to `https://www.facebook.com/tr?id=<pixel_id>&ev=Lead`
   (Meta sends the event via an img beacon)

- [ ] **Step 4: Commit**

```bash
git add src/components/funnels/blocks/FormBlock.tsx
git commit -m "feat(funnels/pixel): fire Lead event on FormBlock submit"
```

---

## Task 9: Fire `Schedule` event in `BookingBlock`

**Files:**
- Modify: `src/components/funnels/blocks/BookingBlock.tsx`

- [ ] **Step 1: Add `window.fbq` call before `setPhase('confirmed')`**

In `BookingBlock.tsx`, find the booking success flow (around line 264–268). The pattern is:

```typescript
const isUsable = ...
if (isUsable) {
  window.location.href = resolved
  return
}
setPhase('confirmed')
```

Add the fbq call before both the redirect and the `setPhase`:

```typescript
// Fire Meta Pixel Schedule event on booking confirmed
window.fbq?.('track', 'Schedule')   // ← add this line

if (isUsable) {
  window.location.href = resolved
  return
}
setPhase('confirmed')
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```

Expected: clean (window.fbq is already declared from Task 2).

- [ ] **Step 3: Manual test — Schedule event fires**

1. Open a published funnel with a BookingBlock and a Pixel ID configured
2. Open browser DevTools > Network, filter by `facebook.com/tr`
3. Complete a booking
4. You should see a POST to `https://www.facebook.com/tr?id=<pixel_id>&ev=Schedule`

- [ ] **Step 4: Commit**

```bash
git add src/components/funnels/blocks/BookingBlock.tsx
git commit -m "feat(funnels/pixel): fire Schedule event on BookingBlock confirmed"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered by |
|-----------------|-----------|
| `meta_pixel_id` column on `funnels` | Task 1 |
| `Funnel` type updated | Task 1 |
| `window.fbq` TypeScript declaration | Task 2 |
| PUT API accepts `meta_pixel_id` | Task 3 |
| GET returns `meta_pixel_id` (via `select('*')`) | Task 3 (no change needed) |
| TrackingPanel UI — input + guide + events list | Task 4 |
| TrackingPanel in builder sidebar | Task 5 |
| Editor state + PATCH callback | Task 6 |
| Public page: load `meta_pixel_id` from DB | Task 7 |
| Public page: inject fbq + PageView | Task 7 |
| `Lead` event on FormBlock | Task 8 |
| `Schedule` event on BookingBlock | Task 9 |
| No injection when pixel not configured | Task 7 (`{metaPixelId && ...}` guard) |
| No fbq crash when pixel not loaded (ad blocker) | Tasks 8+9 (`window.fbq?.()` optional chaining) |

**No spec gaps found.**

**Placeholder scan:** No TBDs, no "implement later", all code steps are complete.

**Type consistency:** `meta_pixel_id: string | null` used consistently across all tasks. `window.fbq?.()` optional chaining used in Tasks 8 and 9 as declared in Task 2. `onMetaPixelChange: (pixelId: string | null) => void` signature consistent between Tasks 5 and 6.

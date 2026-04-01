# Funnel Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a funnel page builder where coaches create multi-page sales funnels (VSL, forms, booking, thank-you) published on their custom domain.

**Architecture:** Funnels contain ordered pages, each page is a JSONB array of typed blocks (12 types). Builder is a 3-column layout (palette/preview/config) with dnd-kit. Public pages are SSR with tracking via anonymous cookie.

**Tech Stack:** Next.js 16 App Router, Supabase (PostgreSQL + RLS), dnd-kit (drag & drop), inline styles (existing pattern), Resend domains (reused for custom domains).

**Spec:** `docs/superpowers/specs/2026-04-01-funnel-builder-design.md`

---

## Phase 1: Foundations (SQL + Types + Templates lib)

### Task 1: SQL Migration

**Files:**
- Create: `supabase/migrations/008_funnels.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- ============================================================================
-- Migration 008: Funnels module
-- ============================================================================

CREATE TABLE funnels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  domain_id UUID REFERENCES email_domains(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id, slug)
);

ALTER TABLE funnels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "funnels_workspace" ON funnels
  FOR ALL USING (
    workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid())
  );

CREATE TABLE funnel_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel_id UUID NOT NULL REFERENCES funnels(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  page_order INT NOT NULL DEFAULT 1,
  blocks JSONB NOT NULL DEFAULT '[]',
  seo_title TEXT,
  seo_description TEXT,
  favicon_url TEXT,
  redirect_url TEXT,
  is_published BOOLEAN DEFAULT false,
  views_count INT DEFAULT 0,
  submissions_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(funnel_id, slug)
);

ALTER TABLE funnel_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "funnel_pages_workspace" ON funnel_pages
  FOR ALL USING (
    workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid())
  );

CREATE TABLE funnel_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel_page_id UUID NOT NULL REFERENCES funnel_pages(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('view', 'form_submit', 'button_click', 'video_play')),
  visitor_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE funnel_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "funnel_events_workspace" ON funnel_events
  FOR ALL USING (
    workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid())
  );

CREATE INDEX idx_funnel_events_page ON funnel_events(funnel_page_id);
CREATE INDEX idx_funnel_events_visitor ON funnel_events(visitor_id);

-- Allow 'funnel' as lead source
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_source_check;
ALTER TABLE leads ADD CONSTRAINT leads_source_check
  CHECK (source IN ('facebook_ads', 'instagram_ads', 'formulaire', 'manuel', 'funnel'));
```

- [ ] **Step 2: Execute migration in Supabase SQL Editor**

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/008_funnels.sql
git commit -m "feat(funnels): add SQL migration — funnels, funnel_pages, funnel_events tables"
```

### Task 2: TypeScript Types

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add funnel types to `src/types/index.ts`**

Add before the `// ─── Database / Contacts` section:

```typescript
// ─── Funnels ────────────────────────────────────────────────────────────────

export type FunnelStatus = 'draft' | 'published'

export interface Funnel {
  id: string
  workspace_id: string
  name: string
  slug: string
  description: string | null
  domain_id: string | null
  status: FunnelStatus
  created_at: string
  updated_at: string
}

export interface FunnelPage {
  id: string
  funnel_id: string
  workspace_id: string
  name: string
  slug: string
  page_order: number
  blocks: FunnelBlock[]
  seo_title: string | null
  seo_description: string | null
  favicon_url: string | null
  redirect_url: string | null
  is_published: boolean
  views_count: number
  submissions_count: number
  created_at: string
  updated_at: string
}

export type FunnelBlockType =
  | 'hero' | 'video' | 'testimonials' | 'form' | 'booking'
  | 'pricing' | 'faq' | 'countdown' | 'cta' | 'text' | 'image' | 'spacer'

export interface HeroBlockConfig {
  title: string
  subtitle?: string
  buttonText?: string
  buttonUrl?: string
  backgroundImage?: string
  overlay?: boolean
  alignment?: 'left' | 'center' | 'right'
}

export interface VideoBlockConfig {
  url: string
  autoplay?: boolean
}

export interface TestimonialItem {
  name: string
  text: string
  photo?: string
  role?: string
}

export interface TestimonialsBlockConfig {
  items: TestimonialItem[]
}

export interface FunnelFormField {
  key: string
  label: string
  type: 'text' | 'email' | 'tel' | 'textarea' | 'select'
  required: boolean
  options?: string[]
}

export interface FormBlockConfig {
  fields: FunnelFormField[]
  submitButtonText: string
  redirectUrl?: string
}

export interface BookingBlockConfig {
  calendarId: string
}

export interface PricingBlockConfig {
  title: string
  price: string
  priceNote?: string
  features: string[]
  buttonText: string
  buttonUrl: string
  highlighted?: boolean
}

export interface FaqItem {
  question: string
  answer: string
}

export interface FaqBlockConfig {
  items: FaqItem[]
}

export interface CountdownBlockConfig {
  targetDate: string
  expiredText?: string
}

export interface CtaBlockConfig {
  text: string
  url: string
  color?: string
  size?: 'sm' | 'md' | 'lg'
  alignment?: 'left' | 'center' | 'right'
}

export interface FunnelTextBlockConfig {
  content: string
}

export interface FunnelImageBlockConfig {
  src: string
  alt?: string
  width?: number
  alignment?: 'left' | 'center' | 'right'
  linkUrl?: string
}

export interface SpacerBlockConfig {
  height: number
}

export type FunnelBlockConfig =
  | HeroBlockConfig | VideoBlockConfig | TestimonialsBlockConfig
  | FormBlockConfig | BookingBlockConfig | PricingBlockConfig
  | FaqBlockConfig | CountdownBlockConfig | CtaBlockConfig
  | FunnelTextBlockConfig | FunnelImageBlockConfig | SpacerBlockConfig

export interface FunnelBlock {
  id: string
  type: FunnelBlockType
  config: FunnelBlockConfig
}

export type FunnelEventType = 'view' | 'form_submit' | 'button_click' | 'video_play'

export interface FunnelEvent {
  id: string
  funnel_page_id: string
  workspace_id: string
  event_type: FunnelEventType
  visitor_id: string | null
  metadata: Record<string, unknown>
  created_at: string
}
```

- [ ] **Step 2: Add 'funnel' to LeadSource type**

Change:
```typescript
export type LeadSource =
  | 'facebook_ads'
  | 'instagram_ads'
  | 'formulaire'
  | 'manuel'
```
To:
```typescript
export type LeadSource =
  | 'facebook_ads'
  | 'instagram_ads'
  | 'formulaire'
  | 'manuel'
  | 'funnel'
```

- [ ] **Step 3: Run build to verify types**

Run: `npx next build`
Expected: Compiles successfully

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(funnels): add TypeScript types for funnels, pages, blocks, events"
```

### Task 3: Templates Library

**Files:**
- Create: `src/lib/funnels/templates.ts`

- [ ] **Step 1: Create templates file with 4 predefined funnel templates**

```typescript
import type { FunnelBlock } from '@/types'

export interface FunnelTemplate {
  id: string
  name: string
  description: string
  pages: {
    name: string
    slug: string
    blocks: FunnelBlock[]
  }[]
}

export const FUNNEL_TEMPLATES: FunnelTemplate[] = [
  {
    id: 'vsl',
    name: 'VSL classique',
    description: 'Page de vente vidéo avec témoignages et appel à l\'action',
    pages: [
      {
        name: 'Page de vente',
        slug: 'vente',
        blocks: [
          { id: 'hero-1', type: 'hero', config: { title: 'Transforme ta vie en 90 jours', subtitle: 'Le programme qui a changé la vie de +500 personnes', buttonText: 'Voir la vidéo', buttonUrl: '#video', alignment: 'center' } },
          { id: 'video-1', type: 'video', config: { url: '', autoplay: false } },
          { id: 'spacer-1', type: 'spacer', config: { height: 40 } },
          { id: 'testimonials-1', type: 'testimonials', config: { items: [{ name: 'Marie D.', text: 'Ce programme a complètement changé ma vie !', role: 'Coachée' }, { name: 'Thomas L.', text: 'Les résultats sont incroyables, je recommande à 100%.', role: 'Coaché' }, { name: 'Julie M.', text: 'Un accompagnement sur-mesure et bienveillant.', role: 'Coachée' }] } },
          { id: 'cta-1', type: 'cta', config: { text: 'Réserver mon appel découverte', url: '', color: '#E53E3E', size: 'lg', alignment: 'center' } },
        ],
      },
    ],
  },
  {
    id: 'capture',
    name: 'Page de capture',
    description: 'Formulaire simple pour capturer des leads',
    pages: [
      {
        name: 'Capture',
        slug: 'inscription',
        blocks: [
          { id: 'hero-1', type: 'hero', config: { title: 'Reçois ton guide gratuit', subtitle: 'Les 5 erreurs qui t\'empêchent d\'atteindre tes objectifs', alignment: 'center' } },
          { id: 'form-1', type: 'form', config: { fields: [{ key: 'first_name', label: 'Prénom', type: 'text', required: true }, { key: 'email', label: 'Email', type: 'email', required: true }, { key: 'phone', label: 'Téléphone', type: 'tel', required: true }], submitButtonText: 'Recevoir le guide', redirectUrl: '' } },
        ],
      },
    ],
  },
  {
    id: 'full',
    name: 'Funnel complet',
    description: 'VSL + Formulaire + Booking + Page de remerciement',
    pages: [
      {
        name: 'Page de vente',
        slug: 'vente',
        blocks: [
          { id: 'hero-1', type: 'hero', config: { title: 'Le programme qui change tout', subtitle: 'Atteins tes objectifs en 90 jours', buttonText: 'Découvrir', buttonUrl: '#video', alignment: 'center' } },
          { id: 'video-1', type: 'video', config: { url: '', autoplay: false } },
          { id: 'testimonials-1', type: 'testimonials', config: { items: [{ name: 'Marie D.', text: 'Résultats incroyables !', role: 'Coachée' }] } },
          { id: 'pricing-1', type: 'pricing', config: { title: 'Mon offre', price: '997€', priceNote: 'Paiement en 3x possible', features: ['Accompagnement personnalisé', 'Accès à vie au contenu', 'Groupe privé', 'Appels hebdomadaires'], buttonText: 'Postuler maintenant', buttonUrl: './candidature', highlighted: true } },
          { id: 'faq-1', type: 'faq', config: { items: [{ question: 'Pour qui est ce programme ?', answer: 'Pour toute personne motivée qui veut transformer sa vie.' }, { question: 'Combien de temps dure le programme ?', answer: '90 jours d\'accompagnement intensif.' }] } },
          { id: 'cta-1', type: 'cta', config: { text: 'Postuler maintenant', url: './candidature', size: 'lg', alignment: 'center' } },
        ],
      },
      {
        name: 'Candidature',
        slug: 'candidature',
        blocks: [
          { id: 'hero-2', type: 'hero', config: { title: 'Formulaire de candidature', subtitle: 'Réponds à ces quelques questions', alignment: 'center' } },
          { id: 'form-2', type: 'form', config: { fields: [{ key: 'first_name', label: 'Prénom', type: 'text', required: true }, { key: 'last_name', label: 'Nom', type: 'text', required: true }, { key: 'email', label: 'Email', type: 'email', required: true }, { key: 'phone', label: 'Téléphone', type: 'tel', required: true }, { key: 'motivation', label: 'Pourquoi veux-tu rejoindre le programme ?', type: 'textarea', required: true }], submitButtonText: 'Envoyer ma candidature', redirectUrl: './booking' } },
        ],
      },
      {
        name: 'Booking',
        slug: 'booking',
        blocks: [
          { id: 'hero-3', type: 'hero', config: { title: 'Réserve ton appel découverte', subtitle: 'Choisis un créneau qui te convient', alignment: 'center' } },
          { id: 'booking-3', type: 'booking', config: { calendarId: '' } },
        ],
      },
      {
        name: 'Merci',
        slug: 'merci',
        blocks: [
          { id: 'hero-4', type: 'hero', config: { title: 'Merci !', subtitle: 'Ta candidature a bien été envoyée', alignment: 'center' } },
          { id: 'text-4', type: 'text', config: { content: 'Voici ce qui va se passer :\n\n1. On analyse ta candidature\n2. Tu reçois un email de confirmation\n3. On se retrouve lors de l\'appel découverte' } },
          { id: 'cta-4', type: 'cta', config: { text: 'Retour au site', url: '/', size: 'md', alignment: 'center' } },
        ],
      },
    ],
  },
  {
    id: 'thankyou',
    name: 'Page de remerciement',
    description: 'Simple page de confirmation après une action',
    pages: [
      {
        name: 'Merci',
        slug: 'merci',
        blocks: [
          { id: 'hero-1', type: 'hero', config: { title: 'Merci !', subtitle: 'Tout est bien enregistré', alignment: 'center' } },
          { id: 'text-1', type: 'text', config: { content: 'Tu vas recevoir un email de confirmation.\n\nÀ très vite !' } },
          { id: 'cta-1', type: 'cta', config: { text: 'Suivre sur Instagram', url: 'https://instagram.com/', size: 'md', alignment: 'center' } },
        ],
      },
    ],
  },
]
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/funnels/templates.ts
git commit -m "feat(funnels): add 4 predefined funnel templates"
```

---

## Phase 2: API Routes

### Task 4: Funnels CRUD API

**Files:**
- Create: `src/app/api/funnels/route.ts`
- Create: `src/app/api/funnels/[id]/route.ts`
- Create: `src/app/api/funnels/[id]/publish/route.ts`

- [ ] **Step 1: Create `src/app/api/funnels/route.ts`** — GET (list all funnels for workspace) + POST (create funnel with optional template_id that populates pages from `FUNNEL_TEMPLATES`)

- [ ] **Step 2: Create `src/app/api/funnels/[id]/route.ts`** — GET (funnel + its pages), PUT (update name/slug/description/domain_id), DELETE

- [ ] **Step 3: Create `src/app/api/funnels/[id]/publish/route.ts`** — POST toggles funnel status between draft/published and sets is_published on all pages

- [ ] **Step 4: Run build, verify no errors**

- [ ] **Step 5: Commit**

```bash
git add src/app/api/funnels/
git commit -m "feat(funnels): add funnels CRUD + publish API routes"
```

### Task 5: Funnel Pages CRUD API

**Files:**
- Create: `src/app/api/funnels/[id]/pages/route.ts`
- Create: `src/app/api/funnels/[id]/pages/[pageId]/route.ts`

- [ ] **Step 1: Create pages route.ts** — GET (list pages ordered by page_order), POST (create new page with blocks)

- [ ] **Step 2: Create pages [pageId] route.ts** — GET (single page), PUT (update name/slug/blocks/seo/redirect_url), DELETE (+ reorder remaining pages)

- [ ] **Step 3: Commit**

```bash
git add src/app/api/funnels/
git commit -m "feat(funnels): add funnel pages CRUD API routes"
```

### Task 6: Funnel Stats API

**Files:**
- Create: `src/app/api/funnels/[id]/stats/route.ts`

- [ ] **Step 1: Create stats route** — GET returns per-page stats: views_count, submissions_count, conversion rate, plus funnel_events aggregates (video_play count, avg video_percent, button_clicks)

- [ ] **Step 2: Commit**

```bash
git add src/app/api/funnels/[id]/stats/
git commit -m "feat(funnels): add funnel stats API route"
```

---

## Phase 3: Funnel Block Renderers (12 blocks)

### Task 7: Simple blocks (text, image, spacer, cta)

**Files:**
- Create: `src/components/funnels/blocks/TextBlock.tsx`
- Create: `src/components/funnels/blocks/ImageBlock.tsx`
- Create: `src/components/funnels/blocks/SpacerBlock.tsx`
- Create: `src/components/funnels/blocks/CtaBlock.tsx`

- [ ] **Step 1: Create all 4 block components.** Each takes `config` prop and renders the block visually. Use inline styles matching the dark theme. TextBlock converts `\n` to `<br>`. CtaBlock renders a styled button with configurable size/color/alignment.

- [ ] **Step 2: Commit**

```bash
git add src/components/funnels/blocks/
git commit -m "feat(funnels): add text, image, spacer, cta block renderers"
```

### Task 8: Hero + Video blocks

**Files:**
- Create: `src/components/funnels/blocks/HeroBlock.tsx`
- Create: `src/components/funnels/blocks/VideoBlock.tsx`

- [ ] **Step 1: HeroBlock** — renders title, subtitle, optional CTA button, optional background image with overlay. Alignment configurable.

- [ ] **Step 2: VideoBlock** — renders YouTube/Vimeo embed iframe. Parse URL to detect platform and extract video ID. Support autoplay option.

- [ ] **Step 3: Commit**

```bash
git add src/components/funnels/blocks/
git commit -m "feat(funnels): add hero and video block renderers"
```

### Task 9: Testimonials + Pricing + FAQ blocks

**Files:**
- Create: `src/components/funnels/blocks/TestimonialsBlock.tsx`
- Create: `src/components/funnels/blocks/PricingBlock.tsx`
- Create: `src/components/funnels/blocks/FaqBlock.tsx`

- [ ] **Step 1: TestimonialsBlock** — grid of testimonial cards (photo, name, role, text). 3 columns on desktop, 1 on mobile.

- [ ] **Step 2: PricingBlock** — pricing card with title, price, price note, feature list (checkmarks), CTA button. Optional highlighted border.

- [ ] **Step 3: FaqBlock** — accordion of Q&A. Each item toggleable (click question to expand/collapse answer).

- [ ] **Step 4: Commit**

```bash
git add src/components/funnels/blocks/
git commit -m "feat(funnels): add testimonials, pricing, faq block renderers"
```

### Task 10: Form + Booking + Countdown blocks

**Files:**
- Create: `src/components/funnels/blocks/FormBlock.tsx`
- Create: `src/components/funnels/blocks/BookingBlock.tsx`
- Create: `src/components/funnels/blocks/CountdownBlock.tsx`

- [ ] **Step 1: FormBlock** — renders dynamic form from `fields` config. On submit: POST to `/api/public/f/events` with type `form_submit` + POST to `/api/leads` to create lead (source: 'funnel'). Then redirect to `redirectUrl`.

- [ ] **Step 2: BookingBlock** — embeds the existing booking page inline via iframe: `/book/{workspaceSlug}/{calendarSlug}`. Needs `calendarId` from config to resolve the slug.

- [ ] **Step 3: CountdownBlock** — client-side countdown timer to `targetDate`. Shows days/hours/minutes/seconds. When expired shows `expiredText`.

- [ ] **Step 4: Commit**

```bash
git add src/components/funnels/blocks/
git commit -m "feat(funnels): add form, booking, countdown block renderers"
```

---

## Phase 4: Block Config Panels (12 configs)

### Task 11: Simple config panels (text, image, spacer, cta)

**Files:**
- Create: `src/components/funnels/config/TextConfig.tsx`
- Create: `src/components/funnels/config/ImageConfig.tsx`
- Create: `src/components/funnels/config/SpacerConfig.tsx`
- Create: `src/components/funnels/config/CtaConfig.tsx`

- [ ] **Step 1: Create all 4 config panels.** Each takes `config` + `onChange` props. TextConfig = textarea. ImageConfig = URL + alt + width + alignment. SpacerConfig = height number input. CtaConfig = text + URL + color picker + size select + alignment.

- [ ] **Step 2: Commit**

```bash
git add src/components/funnels/config/
git commit -m "feat(funnels): add text, image, spacer, cta config panels"
```

### Task 12: Hero + Video config panels

**Files:**
- Create: `src/components/funnels/config/HeroConfig.tsx`
- Create: `src/components/funnels/config/VideoConfig.tsx`

- [ ] **Step 1: HeroConfig** — title, subtitle, buttonText, buttonUrl, backgroundImage URL, overlay checkbox, alignment select.

- [ ] **Step 2: VideoConfig** — URL input + autoplay checkbox.

- [ ] **Step 3: Commit**

```bash
git add src/components/funnels/config/
git commit -m "feat(funnels): add hero and video config panels"
```

### Task 13: Testimonials + Pricing + FAQ config panels

**Files:**
- Create: `src/components/funnels/config/TestimonialsConfig.tsx`
- Create: `src/components/funnels/config/PricingConfig.tsx`
- Create: `src/components/funnels/config/FaqConfig.tsx`

- [ ] **Step 1: TestimonialsConfig** — list of testimonials. Each: name, text, photo URL, role. Add/remove buttons.

- [ ] **Step 2: PricingConfig** — title, price, priceNote, features (add/remove list), buttonText, buttonUrl, highlighted checkbox.

- [ ] **Step 3: FaqConfig** — list of Q&A items. Each: question + answer textarea. Add/remove.

- [ ] **Step 4: Commit**

```bash
git add src/components/funnels/config/
git commit -m "feat(funnels): add testimonials, pricing, faq config panels"
```

### Task 14: Form + Booking + Countdown config panels

**Files:**
- Create: `src/components/funnels/config/FormConfig.tsx`
- Create: `src/components/funnels/config/BookingConfig.tsx`
- Create: `src/components/funnels/config/CountdownConfig.tsx`

- [ ] **Step 1: FormConfig** — dynamic field editor (reuse pattern from `FormFieldsEditor`). Each field: key, label, type dropdown, required checkbox. Add/remove. Plus submitButtonText + redirectUrl.

- [ ] **Step 2: BookingConfig** — dropdown of booking_calendars (fetch from `/api/booking-calendars`). Select which calendar to embed.

- [ ] **Step 3: CountdownConfig** — datetime input for targetDate + text input for expiredText.

- [ ] **Step 4: Commit**

```bash
git add src/components/funnels/config/
git commit -m "feat(funnels): add form, booking, countdown config panels"
```

---

## Phase 5: Builder UI

### Task 15: FunnelBlockConfig (config router)

**Files:**
- Create: `src/components/funnels/FunnelBlockConfig.tsx`

- [ ] **Step 1: Create config router component.** Takes `block` + `onChange` props. Switches on `block.type` and renders the correct config panel from `config/`. Same pattern as `BlockRenderer` in the email builder.

- [ ] **Step 2: Commit**

```bash
git add src/components/funnels/FunnelBlockConfig.tsx
git commit -m "feat(funnels): add FunnelBlockConfig router component"
```

### Task 16: FunnelBlockPalette + FunnelPageTabs

**Files:**
- Create: `src/components/funnels/FunnelBlockPalette.tsx`
- Create: `src/components/funnels/FunnelPageTabs.tsx`

- [ ] **Step 1: FunnelBlockPalette** — left sidebar listing 12 block types. Each is a draggable item (dnd-kit `useDraggable`). Shows icon + label. Drag creates a new block instance.

- [ ] **Step 2: FunnelPageTabs** — horizontal tabs showing pages of the funnel. Click switches active page. "+" button to add a new page. Each tab shows page name, can be deleted (with confirm).

- [ ] **Step 3: Commit**

```bash
git add src/components/funnels/FunnelBlockPalette.tsx src/components/funnels/FunnelPageTabs.tsx
git commit -m "feat(funnels): add block palette and page tabs components"
```

### Task 17: FunnelPagePreview

**Files:**
- Create: `src/components/funnels/FunnelPagePreview.tsx`

- [ ] **Step 1: Create preview component.** Renders blocks in order using block renderers from `blocks/`. Each block is wrapped in a sortable container (dnd-kit `useSortable`). Droppable zone accepts blocks from the palette. Click on a block sets it as selected (blue border). Hover shows delete button (X). Supports desktop/mobile width toggle.

- [ ] **Step 2: Commit**

```bash
git add src/components/funnels/FunnelPagePreview.tsx
git commit -m "feat(funnels): add page preview with sortable blocks"
```

### Task 18: FunnelBuilder (main layout)

**Files:**
- Create: `src/components/funnels/FunnelBuilder.tsx`

- [ ] **Step 1: Create the 3-column layout.** Left: FunnelBlockPalette. Center: FunnelPagePreview. Right (conditional): FunnelBlockConfig when a block is selected. Wraps everything in a DndContext. Handles: adding block from palette to preview, reordering blocks, selecting/deselecting blocks, deleting blocks.

- [ ] **Step 2: Commit**

```bash
git add src/components/funnels/FunnelBuilder.tsx
git commit -m "feat(funnels): add FunnelBuilder 3-column layout"
```

---

## Phase 6: Dashboard Pages

### Task 19: Funnels list page + new funnel page

**Files:**
- Create: `src/app/(dashboard)/acquisition/funnels/page.tsx`
- Create: `src/app/(dashboard)/acquisition/funnels/new/page.tsx`
- Create: `src/components/funnels/FunnelCard.tsx`
- Modify: `src/components/layout/Sidebar.tsx` — add "Funnels" entry

- [ ] **Step 1: FunnelCard** — card component showing funnel name, status badge (draft/published), page count, link to builder.

- [ ] **Step 2: List page** — fetches funnels from API, renders FunnelCards in a grid. Button "Nouveau funnel" links to /new.

- [ ] **Step 3: New funnel page** — shows 4 template cards (from FUNNEL_TEMPLATES) + option "Page vierge". On click: POST to /api/funnels with template_id, redirect to builder.

- [ ] **Step 4: Add "Funnels" to sidebar** — in Sidebar.tsx ACQUISITION section, add `{ label: 'Funnels', href: '/acquisition/funnels', icon: Layers }`. Import `Layers` from lucide-react.

- [ ] **Step 5: Run build, verify no errors**

- [ ] **Step 6: Commit**

```bash
git add src/app/(dashboard)/acquisition/funnels/ src/components/funnels/FunnelCard.tsx src/components/layout/Sidebar.tsx
git commit -m "feat(funnels): add funnel list page, new funnel page, sidebar entry"
```

### Task 20: Builder page

**Files:**
- Create: `src/app/(dashboard)/acquisition/funnels/[id]/page.tsx`

- [ ] **Step 1: Create builder page.** Fetches funnel + pages from API. Top bar: back button, funnel name (editable), FunnelPageTabs, desktop/mobile toggle, save button, publish button. Main content: FunnelBuilder component. Save sends PUT to each modified page. Publish calls /api/funnels/[id]/publish.

- [ ] **Step 2: Run build, verify no errors**

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/acquisition/funnels/[id]/
git commit -m "feat(funnels): add funnel builder page"
```

---

## Phase 7: Public Pages + Tracking

### Task 21: Public page rendering

**Files:**
- Create: `src/app/f/[workspaceSlug]/[funnelSlug]/page.tsx`
- Create: `src/app/f/[workspaceSlug]/[funnelSlug]/[pageSlug]/page.tsx`
- Create: `src/app/api/public/f/[workspaceSlug]/[funnelSlug]/[pageSlug]/route.ts`
- Create: `src/lib/funnels/compiler.ts`

- [ ] **Step 1: Create public API route** — fetches workspace by slug (workspace_slugs table), then funnel by workspace_id + funnel slug, then page by funnel_id + page slug. Returns blocks + workspace branding (accent_color, logo_url, name). No auth required — uses service client.

- [ ] **Step 2: Create compiler.ts** — `compileFunnelPage(blocks, branding)` converts FunnelBlock[] to full HTML page string with inline CSS. Same pattern as email compiler but for web pages. Includes viewport meta, charset, branding colors as CSS variables.

- [ ] **Step 3: Create [pageSlug] page** — SSR page. Fetches data from public API. Renders blocks using the block renderer components. Injects SEO meta tags. Injects tracking script.

- [ ] **Step 4: Create funnel index page** — redirects to first page (page_order = 1).

- [ ] **Step 5: Commit**

```bash
git add src/app/f/ src/app/api/public/f/ src/lib/funnels/compiler.ts
git commit -m "feat(funnels): add public page rendering with SSR + compiler"
```

### Task 22: Tracking system

**Files:**
- Create: `src/app/api/public/f/events/route.ts`
- Create: `src/lib/funnels/tracking.ts`

- [ ] **Step 1: Create events API route** — POST accepts `{ funnel_page_id, event_type, visitor_id, metadata }`. Inserts into funnel_events. Uses service client (public, no auth). Also increments views_count/submissions_count on funnel_pages.

- [ ] **Step 2: Create tracking.ts** — `generateTrackingScript(funnelPageId)` returns a JS string that: generates/reads `_closrm_vid` cookie, sends `view` event on page load, attaches click handlers on CTA buttons (`button_click` events), listens to YouTube/Vimeo iframe postMessage for `video_play` events at 25/50/75/100%.

- [ ] **Step 3: Inject tracking script into public pages** — add `<script>` tag with the tracking script in the public page component.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/public/f/events/ src/lib/funnels/tracking.ts
git commit -m "feat(funnels): add visitor tracking system (view, click, video, form events)"
```

### Task 23: Final verification + build

- [ ] **Step 1: Run `npx next build`** — verify all routes compile

- [ ] **Step 2: Verify all routes exist in build output:**
  - `/acquisition/funnels`
  - `/acquisition/funnels/new`
  - `/acquisition/funnels/[id]`
  - `/api/funnels`
  - `/api/funnels/[id]`
  - `/api/funnels/[id]/pages`
  - `/api/funnels/[id]/pages/[pageId]`
  - `/api/funnels/[id]/publish`
  - `/api/funnels/[id]/stats`
  - `/f/[workspaceSlug]/[funnelSlug]`
  - `/f/[workspaceSlug]/[funnelSlug]/[pageSlug]`
  - `/api/public/f/events`

- [ ] **Step 3: Final commit**

```bash
git add .
git commit -m "feat(funnels): funnel builder module complete — builder, public pages, tracking"
```

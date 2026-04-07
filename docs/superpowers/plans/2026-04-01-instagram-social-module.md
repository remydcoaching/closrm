# Instagram Social Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Instagram Stories/Reels/Content Planner + Messages modules to the ACQUISITION section of ClosRM, reusing the existing Meta OAuth integration.

**Architecture:** New migration (009) creates 13 tables for Instagram data. API routes under `/api/instagram/` handle sync with Instagram Graph API v25.0, CRUD for sequences/drafts/pillars/hashtags/templates, and DM messaging. Two new pages: `/acquisition/reseaux-sociaux` (platform tabs → Instagram sub-tabs) and `/acquisition/messages` (DM conversations). All components use inline styles with CSS variables, matching existing patterns.

**Tech Stack:** Next.js 14 App Router, Supabase (PostgreSQL + Storage + RLS), Instagram Graph API v25.0, Recharts, Zod, lucide-react

**Spec:** `docs/superpowers/specs/2026-04-01-instagram-social-module-design.md`

---

## File Map

### Database
- **Create:** `supabase/migrations/009_instagram_module.sql` — 13 tables + RLS + indexes

### Types & Validation
- **Modify:** `src/types/index.ts` — add all Instagram types
- **Create:** `src/lib/validations/instagram.ts` — Zod schemas for all CRUD operations
- **Create:** `src/lib/instagram/constants.ts` — IG_SEQ_TYPES, categories, periods

### API Routes (all under `src/app/api/instagram/`)
- **Create:** `account/route.ts` — GET/POST ig_account linked to Meta integration
- **Create:** `sync/route.ts` — POST full sync (reels + stories + snapshot + conversations)
- **Create:** `stories/route.ts` — GET synced stories with filters
- **Create:** `sequences/route.ts` — GET/POST sequences
- **Create:** `sequences/[id]/route.ts` — PUT/DELETE single sequence
- **Create:** `sequences/[id]/items/route.ts` — GET/PUT items in a sequence
- **Create:** `reels/route.ts` — GET synced reels with filters
- **Create:** `pillars/route.ts` — GET/POST/PUT/DELETE content pillars
- **Create:** `drafts/route.ts` — GET/POST drafts
- **Create:** `drafts/[id]/route.ts` — PUT/DELETE single draft
- **Create:** `drafts/[id]/publish/route.ts` — POST publish to Instagram
- **Create:** `hashtag-groups/route.ts` — GET/POST/PUT/DELETE
- **Create:** `caption-templates/route.ts` — GET/POST/PUT/DELETE
- **Create:** `snapshots/route.ts` — GET snapshots
- **Create:** `goals/route.ts` — GET/POST/PUT goals
- **Create:** `conversations/route.ts` — GET conversations
- **Create:** `messages/route.ts` — GET messages for a conversation
- **Create:** `messages/send/route.ts` — POST send DM

### Instagram API Helpers
- **Create:** `src/lib/instagram/api.ts` — Graph API wrapper (fetch reels, stories, profile, publish, send DM)
- **Create:** `src/lib/instagram/sync.ts` — sync orchestration (reels, stories, snapshots, conversations)

### Navigation
- **Modify:** `src/components/layout/Sidebar.tsx` — add Réseaux sociaux + Messages items

### Pages
- **Create:** `src/app/(dashboard)/acquisition/reseaux-sociaux/page.tsx` — main page with platform tabs
- **Create:** `src/app/(dashboard)/acquisition/messages/page.tsx` — DM conversations page

### Components (all under `src/components/social/`)
- **Create:** `SocialPlatformTabs.tsx` — platform tab selector (Instagram, TikTok placeholder...)
- **Create:** `instagram/IgSubTabs.tsx` — sub-tab selector (Général, Stories, Reels, Calendrier)
- **Create:** `instagram/constants.ts` — re-export from lib for convenience
- **Create:** `instagram/IgNotConnected.tsx` — empty state when no IG account
- **Create:** `instagram/IgGeneralTab.tsx` — KPIs, growth chart, top reels, goals
- **Create:** `instagram/IgStoriesTab.tsx` — week nav, sequences, day view, stories outside sequences
- **Create:** `instagram/IgSequenceDetail.tsx` — detail view + retention funnel
- **Create:** `instagram/IgSequenceModal.tsx` — create/edit sequence modal
- **Create:** `instagram/IgStoriesSelector.tsx` — select stories for a sequence
- **Create:** `instagram/IgReelsTab.tsx` — reels table, pillars, detail modal
- **Create:** `instagram/IgCalendarTab.tsx` — sub-tabs for content planner
- **Create:** `instagram/IgCalendarView.tsx` — monthly calendar grid
- **Create:** `instagram/IgDraftModal.tsx` — 2-column create/edit post modal
- **Create:** `instagram/IgDraftsList.tsx` — drafts or scheduled list
- **Create:** `instagram/IgHashtagGroups.tsx` — CRUD hashtag groups
- **Create:** `instagram/IgCaptionTemplates.tsx` — CRUD caption templates
- **Create:** `instagram/IgBestTime.tsx` — engagement heatmap

### Messages Components (under `src/components/messages/`)
- **Create:** `ConversationList.tsx` — conversation list with search
- **Create:** `ConversationThread.tsx` — message thread with bubbles
- **Create:** `MessageInput.tsx` — message input + send button

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/009_instagram_module.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- ============================================================================
-- Migration 009: Instagram social module
-- ============================================================================

-- 1. ig_accounts
CREATE TABLE ig_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  ig_user_id TEXT NOT NULL,
  ig_username TEXT,
  access_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ,
  page_id TEXT,
  page_access_token TEXT,
  is_connected BOOLEAN DEFAULT true,
  starting_followers INTEGER DEFAULT 0,
  starting_date DATE,
  starting_monthly_views BIGINT DEFAULT 0,
  starting_engagement NUMERIC DEFAULT 0,
  starting_best_reel BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ig_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ig_accounts_workspace" ON ig_accounts
  FOR ALL USING (
    workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid())
  );
CREATE UNIQUE INDEX ig_accounts_workspace_unique ON ig_accounts(workspace_id);

-- 2. ig_content_pillars (must come before ig_reels FK)
CREATE TABLE ig_content_pillars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ig_content_pillars ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ig_content_pillars_workspace" ON ig_content_pillars
  FOR ALL USING (
    workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid())
  );

-- 3. ig_stories
CREATE TABLE ig_stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  ig_story_id TEXT NOT NULL UNIQUE,
  ig_media_url TEXT,
  thumbnail_url TEXT,
  caption TEXT,
  story_type TEXT CHECK (story_type IN ('video', 'image')),
  impressions INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  replies INTEGER DEFAULT 0,
  exits INTEGER DEFAULT 0,
  taps_forward INTEGER DEFAULT 0,
  taps_back INTEGER DEFAULT 0,
  published_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
);

ALTER TABLE ig_stories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ig_stories_workspace" ON ig_stories
  FOR ALL USING (
    workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid())
  );
CREATE INDEX ig_stories_published ON ig_stories(workspace_id, published_at DESC);

-- 4. story_sequences
CREATE TABLE story_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sequence_type TEXT NOT NULL CHECK (sequence_type IN (
    'confiance', 'peur', 'preuve_sociale', 'urgence',
    'autorite', 'storytelling', 'offre', 'education'
  )),
  objective TEXT,
  notes TEXT,
  status TEXT DEFAULT 'draft',
  total_impressions INTEGER DEFAULT 0,
  overall_dropoff_rate NUMERIC DEFAULT 0,
  total_replies INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  published_at TIMESTAMPTZ
);

ALTER TABLE story_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "story_sequences_workspace" ON story_sequences
  FOR ALL USING (
    workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid())
  );

-- 5. story_sequence_items
CREATE TABLE story_sequence_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID NOT NULL REFERENCES story_sequences(id) ON DELETE CASCADE,
  story_id UUID NOT NULL REFERENCES ig_stories(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  impressions INTEGER DEFAULT 0,
  replies INTEGER DEFAULT 0,
  exits INTEGER DEFAULT 0
);

ALTER TABLE story_sequence_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "story_sequence_items_workspace" ON story_sequence_items
  FOR ALL USING (
    sequence_id IN (SELECT id FROM story_sequences WHERE workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    ))
  );
CREATE INDEX story_sequence_items_seq ON story_sequence_items(sequence_id, position);

-- 6. ig_reels
CREATE TABLE ig_reels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  ig_media_id TEXT NOT NULL UNIQUE,
  caption TEXT,
  thumbnail_url TEXT,
  video_url TEXT,
  views BIGINT DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  saves INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  plays INTEGER DEFAULT 0,
  engagement_rate NUMERIC DEFAULT 0,
  format TEXT CHECK (format IN ('talking_head', 'text_overlay', 'raw_documentary')),
  pillar_id UUID REFERENCES ig_content_pillars(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ
);

ALTER TABLE ig_reels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ig_reels_workspace" ON ig_reels
  FOR ALL USING (
    workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid())
  );
CREATE INDEX ig_reels_published ON ig_reels(workspace_id, published_at DESC);

-- 7. ig_drafts
CREATE TABLE ig_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  ig_account_id UUID REFERENCES ig_accounts(id) ON DELETE SET NULL,
  caption TEXT,
  hashtags TEXT[] DEFAULT '{}',
  media_urls TEXT[] DEFAULT '{}',
  media_type TEXT CHECK (media_type IN ('IMAGE', 'VIDEO', 'CAROUSEL')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'scheduled', 'publishing', 'published', 'failed'
  )),
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  ig_media_id TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ig_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ig_drafts_workspace" ON ig_drafts
  FOR ALL USING (
    workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid())
  );
CREATE INDEX ig_drafts_status ON ig_drafts(workspace_id, status);
CREATE INDEX ig_drafts_scheduled ON ig_drafts(workspace_id, scheduled_at)
  WHERE status = 'scheduled';

-- 8. ig_hashtag_groups
CREATE TABLE ig_hashtag_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  hashtags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ig_hashtag_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ig_hashtag_groups_workspace" ON ig_hashtag_groups
  FOR ALL USING (
    workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid())
  );

-- 9. ig_caption_templates
CREATE TABLE ig_caption_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  category TEXT DEFAULT 'general' CHECK (category IN (
    'general', 'education', 'storytelling', 'offre',
    'preuve_sociale', 'motivation', 'behind_the_scenes'
  )),
  hashtags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ig_caption_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ig_caption_templates_workspace" ON ig_caption_templates
  FOR ALL USING (
    workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid())
  );

-- 10. ig_snapshots
CREATE TABLE ig_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  followers INTEGER DEFAULT 0,
  total_views BIGINT DEFAULT 0,
  total_reach BIGINT DEFAULT 0,
  new_followers INTEGER DEFAULT 0,
  UNIQUE(workspace_id, snapshot_date)
);

ALTER TABLE ig_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ig_snapshots_workspace" ON ig_snapshots
  FOR ALL USING (
    workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid())
  );

-- 11. ig_goals
CREATE TABLE ig_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  quarter TEXT NOT NULL,
  metric TEXT NOT NULL,
  target_value NUMERIC NOT NULL DEFAULT 0,
  UNIQUE(workspace_id, quarter, metric)
);

ALTER TABLE ig_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ig_goals_workspace" ON ig_goals
  FOR ALL USING (
    workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid())
  );

-- 12. ig_conversations
CREATE TABLE ig_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  ig_conversation_id TEXT NOT NULL UNIQUE,
  participant_ig_id TEXT,
  participant_username TEXT,
  participant_name TEXT,
  participant_avatar_url TEXT,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  last_message_text TEXT,
  last_message_at TIMESTAMPTZ,
  unread_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ig_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ig_conversations_workspace" ON ig_conversations
  FOR ALL USING (
    workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid())
  );
CREATE INDEX ig_conversations_last_msg ON ig_conversations(workspace_id, last_message_at DESC);

-- 13. ig_messages
CREATE TABLE ig_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES ig_conversations(id) ON DELETE CASCADE,
  ig_message_id TEXT UNIQUE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('user', 'participant')),
  text TEXT,
  media_url TEXT,
  media_type TEXT CHECK (media_type IN ('image', 'video', 'audio', 'sticker')),
  sent_at TIMESTAMPTZ DEFAULT now(),
  is_read BOOLEAN DEFAULT false
);

ALTER TABLE ig_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ig_messages_workspace" ON ig_messages
  FOR ALL USING (
    workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid())
  );
CREATE INDEX ig_messages_conversation ON ig_messages(conversation_id, sent_at ASC);

-- Storage bucket for content drafts media
INSERT INTO storage.buckets (id, name, public) VALUES ('content-drafts', 'content-drafts', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "content_drafts_upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'content-drafts' AND auth.uid() IS NOT NULL);
CREATE POLICY "content_drafts_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'content-drafts');
CREATE POLICY "content_drafts_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'content-drafts' AND auth.uid() IS NOT NULL);
```

- [ ] **Step 2: Apply migration to Supabase**

Run: `npx supabase db push` or apply via Supabase dashboard SQL editor.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/009_instagram_module.sql
git commit -m "feat: add migration 009 — Instagram social module (13 tables + storage)"
```

---

## Task 2: TypeScript Types + Constants

**Files:**
- Modify: `src/types/index.ts`
- Create: `src/lib/instagram/constants.ts`

- [ ] **Step 1: Add Instagram types to `src/types/index.ts`**

Append after the Email module types section (around line 697):

```typescript
/* ───────────────────── Instagram Module ───────────────────── */

export interface IgAccount {
  id: string
  workspace_id: string
  ig_user_id: string
  ig_username: string | null
  access_token: string
  token_expires_at: string | null
  page_id: string | null
  page_access_token: string | null
  is_connected: boolean
  starting_followers: number
  starting_date: string | null
  starting_monthly_views: number
  starting_engagement: number
  starting_best_reel: number
  created_at: string
}

export interface IgStory {
  id: string
  workspace_id: string
  ig_story_id: string
  ig_media_url: string | null
  thumbnail_url: string | null
  caption: string | null
  story_type: 'video' | 'image'
  impressions: number
  reach: number
  replies: number
  exits: number
  taps_forward: number
  taps_back: number
  published_at: string
  expires_at: string
}

export type StorySequenceType =
  | 'confiance' | 'peur' | 'preuve_sociale' | 'urgence'
  | 'autorite' | 'storytelling' | 'offre' | 'education'

export interface StorySequence {
  id: string
  workspace_id: string
  name: string
  sequence_type: StorySequenceType
  objective: string | null
  notes: string | null
  status: string
  total_impressions: number
  overall_dropoff_rate: number
  total_replies: number
  created_at: string
  published_at: string | null
}

export interface StorySequenceItem {
  id: string
  sequence_id: string
  story_id: string
  position: number
  impressions: number
  replies: number
  exits: number
  story?: IgStory
}

export interface IgReel {
  id: string
  workspace_id: string
  ig_media_id: string
  caption: string | null
  thumbnail_url: string | null
  video_url: string | null
  views: number
  likes: number
  comments: number
  shares: number
  saves: number
  reach: number
  plays: number
  engagement_rate: number
  format: 'talking_head' | 'text_overlay' | 'raw_documentary' | null
  pillar_id: string | null
  published_at: string
}

export interface IgContentPillar {
  id: string
  workspace_id: string
  name: string
  color: string
  created_at: string
}

export type IgDraftStatus = 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed'
export type IgMediaType = 'IMAGE' | 'VIDEO' | 'CAROUSEL'

export interface IgDraft {
  id: string
  workspace_id: string
  ig_account_id: string | null
  caption: string | null
  hashtags: string[]
  media_urls: string[]
  media_type: IgMediaType | null
  status: IgDraftStatus
  scheduled_at: string | null
  published_at: string | null
  ig_media_id: string | null
  error_message: string | null
  created_at: string
  updated_at: string
}

export interface IgHashtagGroup {
  id: string
  workspace_id: string
  name: string
  hashtags: string[]
  created_at: string
}

export type IgCaptionCategory =
  | 'general' | 'education' | 'storytelling' | 'offre'
  | 'preuve_sociale' | 'motivation' | 'behind_the_scenes'

export interface IgCaptionTemplate {
  id: string
  workspace_id: string
  title: string
  body: string
  category: IgCaptionCategory
  hashtags: string[]
  created_at: string
}

export interface IgSnapshot {
  id: string
  workspace_id: string
  snapshot_date: string
  followers: number
  total_views: number
  total_reach: number
  new_followers: number
}

export interface IgGoal {
  id: string
  workspace_id: string
  quarter: string
  metric: string
  target_value: number
}

export interface IgConversation {
  id: string
  workspace_id: string
  ig_conversation_id: string
  participant_ig_id: string | null
  participant_username: string | null
  participant_name: string | null
  participant_avatar_url: string | null
  lead_id: string | null
  last_message_text: string | null
  last_message_at: string | null
  unread_count: number
  created_at: string
}

export type IgMessageSenderType = 'user' | 'participant'

export interface IgMessage {
  id: string
  workspace_id: string
  conversation_id: string
  ig_message_id: string | null
  sender_type: IgMessageSenderType
  text: string | null
  media_url: string | null
  media_type: 'image' | 'video' | 'audio' | 'sticker' | null
  sent_at: string
  is_read: boolean
}
```

- [ ] **Step 2: Create constants file `src/lib/instagram/constants.ts`**

```typescript
export const IG_SEQ_TYPES = {
  confiance:      { label: 'Confiance',      color: '#3b82f6' },
  peur:           { label: 'Peur',           color: '#ef4444' },
  preuve_sociale: { label: 'Preuve sociale', color: '#22c55e' },
  urgence:        { label: 'Urgence',        color: '#f97316' },
  autorite:       { label: 'Autorité',       color: '#8b5cf6' },
  storytelling:   { label: 'Storytelling',   color: '#ec4899' },
  offre:          { label: 'Offre',          color: '#eab308' },
  education:      { label: 'Éducation',      color: '#06b6d4' },
} as const

export type SeqTypeKey = keyof typeof IG_SEQ_TYPES

export const IG_CAPTION_CATEGORIES = [
  { value: 'general', label: 'Général' },
  { value: 'education', label: 'Éducation' },
  { value: 'storytelling', label: 'Storytelling' },
  { value: 'offre', label: 'Offre' },
  { value: 'preuve_sociale', label: 'Preuve sociale' },
  { value: 'motivation', label: 'Motivation' },
  { value: 'behind_the_scenes', label: 'Behind the scenes' },
] as const

export const IG_PERIODS = [
  { value: '7d', label: '7 jours' },
  { value: '30d', label: '30 jours' },
  { value: '90d', label: '90 jours' },
  { value: '6m', label: '6 mois' },
  { value: '1y', label: '1 an' },
] as const

export const IG_REEL_FORMATS = [
  { value: 'talking_head', label: 'Talking Head' },
  { value: 'text_overlay', label: 'Text Overlay' },
  { value: 'raw_documentary', label: 'Raw Documentary' },
] as const

export const IG_GOAL_METRICS = [
  { value: 'followers', label: 'Followers' },
  { value: 'monthly_views', label: 'Vues mensuelles' },
  { value: 'engagement_rate', label: "Taux d'engagement" },
  { value: 'weekly_output', label: 'Posts / semaine' },
  { value: 'dms_month', label: 'DMs / mois' },
  { value: 'viral_reels', label: 'Reels viraux' },
] as const
```

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts src/lib/instagram/constants.ts
git commit -m "feat: add Instagram types and constants"
```

---

## Task 3: Zod Validation Schemas

**Files:**
- Create: `src/lib/validations/instagram.ts`

- [ ] **Step 1: Create validation schemas**

```typescript
import { z } from 'zod'

// ── Sequences ──
export const createSequenceSchema = z.object({
  name: z.string().min(1, 'Le nom est requis').max(200),
  sequence_type: z.enum([
    'confiance', 'peur', 'preuve_sociale', 'urgence',
    'autorite', 'storytelling', 'offre', 'education',
  ]),
  objective: z.string().max(500).optional().default(''),
  notes: z.string().max(2000).optional().default(''),
  published_at: z.string().optional(),
})

export const updateSequenceSchema = createSequenceSchema.partial()

export const updateSequenceItemsSchema = z.object({
  items: z.array(z.object({
    story_id: z.string().uuid(),
    position: z.number().int().min(1),
  })),
})

// ── Content Pillars ──
export const createPillarSchema = z.object({
  name: z.string().min(1, 'Le nom est requis').max(100),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Couleur hex invalide'),
})

export const updatePillarSchema = createPillarSchema.partial()

// ── Drafts ──
export const createDraftSchema = z.object({
  caption: z.string().max(2200).optional().default(''),
  hashtags: z.array(z.string()).max(30).optional().default([]),
  media_urls: z.array(z.string()).optional().default([]),
  media_type: z.enum(['IMAGE', 'VIDEO', 'CAROUSEL']).optional(),
  status: z.enum(['draft', 'scheduled']).default('draft'),
  scheduled_at: z.string().optional(),
})

export const updateDraftSchema = createDraftSchema.partial()

// ── Hashtag Groups ──
export const createHashtagGroupSchema = z.object({
  name: z.string().min(1, 'Le nom est requis').max(100),
  hashtags: z.array(z.string()).min(1, 'Au moins un hashtag requis'),
})

export const updateHashtagGroupSchema = createHashtagGroupSchema.partial()

// ── Caption Templates ──
export const createCaptionTemplateSchema = z.object({
  title: z.string().min(1, 'Le titre est requis').max(200),
  body: z.string().max(2200).optional().default(''),
  category: z.enum([
    'general', 'education', 'storytelling', 'offre',
    'preuve_sociale', 'motivation', 'behind_the_scenes',
  ]).default('general'),
  hashtags: z.array(z.string()).optional().default([]),
})

export const updateCaptionTemplateSchema = createCaptionTemplateSchema.partial()

// ── Goals ──
export const upsertGoalSchema = z.object({
  quarter: z.string().regex(/^\d{4}-Q[1-4]$/, 'Format: 2026-Q1'),
  metric: z.string().min(1),
  target_value: z.number().min(0),
})

// ── Filters ──
export const igStoriesFiltersSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
})

export const igReelsFiltersSchema = z.object({
  pillar_id: z.string().uuid().optional(),
  format: z.string().optional(),
  sort: z.enum(['published_at', 'views', 'engagement_rate']).default('published_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(50),
})

export const igDraftsFiltersSchema = z.object({
  status: z.enum(['draft', 'scheduled', 'published', 'failed']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(25),
})

export const igConversationsFiltersSchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(50).default(30),
})

export const sendMessageSchema = z.object({
  conversation_id: z.string().uuid(),
  text: z.string().min(1, 'Le message est requis').max(1000),
})

// ── Inferred types ──
export type CreateSequenceData = z.infer<typeof createSequenceSchema>
export type UpdateSequenceData = z.infer<typeof updateSequenceSchema>
export type CreatePillarData = z.infer<typeof createPillarSchema>
export type CreateDraftData = z.infer<typeof createDraftSchema>
export type UpdateDraftData = z.infer<typeof updateDraftSchema>
export type CreateHashtagGroupData = z.infer<typeof createHashtagGroupSchema>
export type CreateCaptionTemplateData = z.infer<typeof createCaptionTemplateSchema>
export type UpsertGoalData = z.infer<typeof upsertGoalSchema>
export type IgReelsFilters = z.infer<typeof igReelsFiltersSchema>
export type IgDraftsFilters = z.infer<typeof igDraftsFiltersSchema>
export type SendMessageData = z.infer<typeof sendMessageSchema>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/validations/instagram.ts
git commit -m "feat: add Instagram Zod validation schemas"
```

---

## Task 4: Instagram Graph API Helper

**Files:**
- Create: `src/lib/instagram/api.ts`

- [ ] **Step 1: Create the Graph API wrapper**

```typescript
const IG_API_VERSION = 'v25.0'
const IG_BASE = `https://graph.instagram.com/${IG_API_VERSION}`
const FB_BASE = `https://graph.facebook.com/${IG_API_VERSION}`

interface IgApiOptions {
  accessToken: string
  igUserId: string
}

// ── Profile ──

export async function fetchIgProfile(token: string) {
  const url = `${IG_BASE}/me?fields=username,name,followers_count,follows_count,media_count,profile_picture_url&access_token=${token}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`IG profile fetch failed: ${res.status}`)
  return res.json() as Promise<{
    id: string
    username: string
    name: string
    followers_count: number
    follows_count: number
    media_count: number
    profile_picture_url: string
  }>
}

// ── Reels ──

interface IgMediaItem {
  id: string
  caption?: string
  media_type: string
  media_url?: string
  thumbnail_url?: string
  timestamp: string
  like_count?: number
  comments_count?: number
}

export async function fetchIgMedia(token: string, limit = 50): Promise<IgMediaItem[]> {
  const url = `${IG_BASE}/me/media?fields=id,caption,media_type,media_url,thumbnail_url,timestamp,like_count,comments_count&limit=${limit}&access_token=${token}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`IG media fetch failed: ${res.status}`)
  const json = await res.json()
  return json.data ?? []
}

interface IgInsights {
  views?: number
  reach?: number
  saved?: number
  shares?: number
}

export async function fetchReelInsights(token: string, mediaId: string): Promise<IgInsights> {
  const url = `${IG_BASE}/${mediaId}/insights?metric=views,reach,saved,shares&access_token=${token}`
  const res = await fetch(url)
  if (!res.ok) return {}
  const json = await res.json()
  const result: IgInsights = {}
  for (const item of json.data ?? []) {
    if (item.name === 'views') result.views = item.values?.[0]?.value ?? 0
    if (item.name === 'reach') result.reach = item.values?.[0]?.value ?? 0
    if (item.name === 'saved') result.saved = item.values?.[0]?.value ?? 0
    if (item.name === 'shares') result.shares = item.values?.[0]?.value ?? 0
  }
  return result
}

// ── Stories ──

interface IgStoryItem {
  id: string
  media_url?: string
  thumbnail_url?: string
  caption?: string
  media_type: string
  timestamp: string
}

export async function fetchIgStories(token: string): Promise<IgStoryItem[]> {
  const url = `${IG_BASE}/me/stories?fields=id,media_url,thumbnail_url,caption,media_type,timestamp&access_token=${token}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`IG stories fetch failed: ${res.status}`)
  const json = await res.json()
  return json.data ?? []
}

interface IgStoryInsights {
  impressions?: number
  reach?: number
  replies?: number
  exits?: number
  taps_forward?: number
  taps_back?: number
}

export async function fetchStoryInsights(token: string, storyId: string): Promise<IgStoryInsights> {
  const url = `${IG_BASE}/${storyId}/insights?metric=impressions,reach,replies,shares,total_interactions,navigation&access_token=${token}`
  const res = await fetch(url)
  if (!res.ok) return {}
  const json = await res.json()
  const result: IgStoryInsights = {}
  for (const item of json.data ?? []) {
    if (item.name === 'impressions') result.impressions = item.values?.[0]?.value ?? 0
    if (item.name === 'reach') result.reach = item.values?.[0]?.value ?? 0
    if (item.name === 'replies') result.replies = item.values?.[0]?.value ?? 0
    if (item.name === 'navigation') result.exits = item.values?.[0]?.value ?? 0
    if (item.name === 'total_interactions') result.taps_forward = item.values?.[0]?.value ?? 0
    if (item.name === 'shares') result.taps_back = item.values?.[0]?.value ?? 0
  }
  return result
}

// ── Publishing ──

export async function createMediaContainer(
  opts: IgApiOptions & { imageUrl?: string; videoUrl?: string; caption: string }
): Promise<string> {
  const { accessToken, igUserId, imageUrl, videoUrl, caption } = opts
  const params = new URLSearchParams({ caption, access_token: accessToken })
  if (videoUrl) {
    params.set('video_url', videoUrl)
    params.set('media_type', 'REELS')
  } else if (imageUrl) {
    params.set('image_url', imageUrl)
  }

  const res = await fetch(`${IG_BASE}/${igUserId}/media`, {
    method: 'POST',
    body: params,
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(`Create container failed: ${JSON.stringify(err)}`)
  }
  const json = await res.json()
  return json.id as string
}

export async function pollContainerStatus(
  token: string,
  containerId: string,
  maxAttempts = 30,
  intervalMs = 2000
): Promise<'FINISHED' | 'ERROR'> {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(
      `${IG_BASE}/${containerId}?fields=status_code&access_token=${token}`
    )
    if (res.ok) {
      const json = await res.json()
      if (json.status_code === 'FINISHED') return 'FINISHED'
      if (json.status_code === 'ERROR') return 'ERROR'
    }
    await new Promise(r => setTimeout(r, intervalMs))
  }
  throw new Error('Container processing timeout (60s)')
}

export async function publishContainer(
  opts: IgApiOptions & { containerId: string }
): Promise<string> {
  const { accessToken, igUserId, containerId } = opts
  const params = new URLSearchParams({
    creation_id: containerId,
    access_token: accessToken,
  })
  const res = await fetch(`${IG_BASE}/${igUserId}/media_publish`, {
    method: 'POST',
    body: params,
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(`Publish failed: ${JSON.stringify(err)}`)
  }
  const json = await res.json()
  return json.id as string
}

// ── Conversations / Messages ──

interface IgConversationRaw {
  id: string
  participants: { data: Array<{ id: string; username: string; name?: string }> }
  messages: { data: Array<{ id: string; message: string; from: { id: string }; created_time: string }> }
}

export async function fetchIgConversations(token: string, pageId: string): Promise<IgConversationRaw[]> {
  const url = `${FB_BASE}/${pageId}/conversations?platform=instagram&fields=id,participants,messages.limit(1){id,message,from,created_time}&access_token=${token}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`IG conversations fetch failed: ${res.status}`)
  const json = await res.json()
  return json.data ?? []
}

interface IgMessageRaw {
  id: string
  message?: string
  from: { id: string }
  created_time: string
  attachments?: { data: Array<{ mime_type: string; image_data?: { url: string }; video_data?: { url: string } }> }
}

export async function fetchConversationMessages(
  token: string,
  conversationId: string,
  limit = 50
): Promise<IgMessageRaw[]> {
  const url = `${FB_BASE}/${conversationId}/messages?fields=id,message,from,created_time,attachments&limit=${limit}&access_token=${token}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`IG messages fetch failed: ${res.status}`)
  const json = await res.json()
  return json.data ?? []
}

export async function sendIgMessage(
  token: string,
  pageId: string,
  recipientId: string,
  text: string
): Promise<string> {
  const res = await fetch(`${FB_BASE}/${pageId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text },
      access_token: token,
    }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(`Send DM failed: ${JSON.stringify(err)}`)
  }
  const json = await res.json()
  return json.message_id as string
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/instagram/api.ts
git commit -m "feat: add Instagram Graph API wrapper (reels, stories, publish, DMs)"
```

---

## Task 5: Sync Orchestration

**Files:**
- Create: `src/lib/instagram/sync.ts`

- [ ] **Step 1: Create sync orchestration**

```typescript
import { SupabaseClient } from '@supabase/supabase-js'
import {
  fetchIgMedia, fetchReelInsights, fetchIgStories,
  fetchStoryInsights, fetchIgProfile, fetchIgConversations,
} from './api'

interface SyncContext {
  supabase: SupabaseClient
  workspaceId: string
  accessToken: string
  igUserId: string
  pageId?: string
  pageAccessToken?: string
}

export async function syncReels(ctx: SyncContext) {
  const media = await fetchIgMedia(ctx.accessToken)
  const reels = media.filter(m => m.media_type === 'VIDEO' || m.media_type === 'REELS')

  for (const reel of reels) {
    const insights = await fetchReelInsights(ctx.accessToken, reel.id)
    const likes = reel.like_count ?? 0
    const comments = reel.comments_count ?? 0
    const saves = insights.saved ?? 0
    const shares = insights.shares ?? 0
    const reach = insights.reach ?? 0
    const views = insights.views ?? 0
    const engagementRate = reach > 0
      ? ((likes + comments + saves + shares) / reach) * 100
      : 0

    await ctx.supabase.from('ig_reels').upsert({
      workspace_id: ctx.workspaceId,
      ig_media_id: reel.id,
      caption: reel.caption ?? null,
      thumbnail_url: reel.thumbnail_url ?? null,
      video_url: reel.media_url ?? null,
      views,
      likes,
      comments,
      shares,
      saves,
      reach,
      plays: views,
      engagement_rate: Math.round(engagementRate * 100) / 100,
      published_at: reel.timestamp,
    }, { onConflict: 'ig_media_id' })
  }

  return reels.length
}

export async function syncStories(ctx: SyncContext) {
  const stories = await fetchIgStories(ctx.accessToken)
  let synced = 0

  for (const story of stories) {
    const insights = await fetchStoryInsights(ctx.accessToken, story.id)
    const publishedAt = story.timestamp
    const expiresAt = new Date(new Date(publishedAt).getTime() + 24 * 60 * 60 * 1000).toISOString()

    await ctx.supabase.from('ig_stories').upsert({
      workspace_id: ctx.workspaceId,
      ig_story_id: story.id,
      ig_media_url: story.media_url ?? null,
      thumbnail_url: story.thumbnail_url ?? null,
      caption: story.caption ?? null,
      story_type: story.media_type === 'VIDEO' ? 'video' : 'image',
      impressions: insights.impressions ?? 0,
      reach: insights.reach ?? 0,
      replies: insights.replies ?? 0,
      exits: insights.exits ?? 0,
      taps_forward: insights.taps_forward ?? 0,
      taps_back: insights.taps_back ?? 0,
      published_at: publishedAt,
      expires_at: expiresAt,
    }, { onConflict: 'ig_story_id' })
    synced++
  }

  return synced
}

export async function syncSnapshot(ctx: SyncContext) {
  const profile = await fetchIgProfile(ctx.accessToken)

  const { data: reels } = await ctx.supabase
    .from('ig_reels')
    .select('views, reach')
    .eq('workspace_id', ctx.workspaceId)

  const totalViews = (reels ?? []).reduce((s, r) => s + (r.views ?? 0), 0)
  const totalReach = (reels ?? []).reduce((s, r) => s + (r.reach ?? 0), 0)

  const today = new Date().toISOString().slice(0, 10)

  // Get yesterday's snapshot for new_followers calc
  const { data: prevSnaps } = await ctx.supabase
    .from('ig_snapshots')
    .select('followers')
    .eq('workspace_id', ctx.workspaceId)
    .order('snapshot_date', { ascending: false })
    .limit(1)

  const prevFollowers = prevSnaps?.[0]?.followers ?? profile.followers_count
  const newFollowers = profile.followers_count - prevFollowers

  await ctx.supabase.from('ig_snapshots').upsert({
    workspace_id: ctx.workspaceId,
    snapshot_date: today,
    followers: profile.followers_count,
    total_views: totalViews,
    total_reach: totalReach,
    new_followers: Math.max(0, newFollowers),
  }, { onConflict: 'workspace_id,snapshot_date' })

  // Keep max 10 snapshots
  const { data: allSnaps } = await ctx.supabase
    .from('ig_snapshots')
    .select('id')
    .eq('workspace_id', ctx.workspaceId)
    .order('snapshot_date', { ascending: false })

  if (allSnaps && allSnaps.length > 10) {
    const toDelete = allSnaps.slice(10).map(s => s.id)
    await ctx.supabase.from('ig_snapshots').delete().in('id', toDelete)
  }

  return { followers: profile.followers_count, newFollowers }
}

export async function syncConversations(ctx: SyncContext) {
  if (!ctx.pageId || !ctx.pageAccessToken) return 0
  const token = ctx.pageAccessToken
  const convos = await fetchIgConversations(token, ctx.pageId)
  let synced = 0

  for (const convo of convos) {
    const participant = convo.participants?.data?.find(p => p.id !== ctx.igUserId)
    if (!participant) continue

    const lastMsg = convo.messages?.data?.[0]

    await ctx.supabase.from('ig_conversations').upsert({
      workspace_id: ctx.workspaceId,
      ig_conversation_id: convo.id,
      participant_ig_id: participant.id,
      participant_username: participant.username ?? null,
      participant_name: participant.name ?? null,
      last_message_text: lastMsg?.message ?? null,
      last_message_at: lastMsg?.created_time ?? null,
    }, { onConflict: 'ig_conversation_id' })
    synced++
  }

  return synced
}

export async function syncAll(ctx: SyncContext) {
  const [reelsCount, storiesCount, snapshot, convosCount] = await Promise.all([
    syncReels(ctx),
    syncStories(ctx),
    syncSnapshot(ctx),
    syncConversations(ctx),
  ])

  return { reelsCount, storiesCount, snapshot, convosCount }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/instagram/sync.ts
git commit -m "feat: add Instagram sync orchestration (reels, stories, snapshots, conversations)"
```

---

## Task 6: API Routes — Account + Sync

**Files:**
- Create: `src/app/api/instagram/account/route.ts`
- Create: `src/app/api/instagram/sync/route.ts`

- [ ] **Step 1: Create account route**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'

export async function GET() {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('ig_accounts')
      .select('*')
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    // Get Meta integration credentials
    const { data: integration } = await supabase
      .from('integrations')
      .select('credentials_encrypted, meta_page_id')
      .eq('workspace_id', workspaceId)
      .eq('type', 'meta')
      .eq('is_active', true)
      .single()

    if (!integration?.credentials_encrypted) {
      return NextResponse.json(
        { error: 'Intégration Meta non connectée. Allez dans Paramètres > Intégrations.' },
        { status: 400 }
      )
    }

    // Decrypt credentials (same pattern as existing code)
    const { decrypt } = await import('@/lib/crypto')
    const creds = JSON.parse(decrypt(integration.credentials_encrypted))
    const accessToken = creds.user_access_token || creds.page_access_token

    // Fetch IG profile
    const { fetchIgProfile } = await import('@/lib/instagram/api')
    const profile = await fetchIgProfile(accessToken)

    // Upsert ig_account
    const body = await request.json().catch(() => ({}))
    const { data, error } = await supabase
      .from('ig_accounts')
      .upsert({
        workspace_id: workspaceId,
        ig_user_id: profile.id,
        ig_username: profile.username,
        access_token: accessToken,
        token_expires_at: creds.token_expires_at ?? null,
        page_id: integration.meta_page_id ?? creds.page_id ?? null,
        page_access_token: creds.page_access_token ?? null,
        is_connected: true,
        starting_followers: body.starting_followers ?? profile.followers_count,
        starting_date: body.starting_date ?? new Date().toISOString().slice(0, 10),
        starting_monthly_views: body.starting_monthly_views ?? 0,
        starting_engagement: body.starting_engagement ?? 0,
        starting_best_reel: body.starting_best_reel ?? 0,
      }, { onConflict: 'workspace_id' })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    console.error('[API /instagram/account] Error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Create sync route**

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { syncAll, syncStories } from '@/lib/instagram/sync'

export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    // Get ig_account
    const { data: account } = await supabase
      .from('ig_accounts')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('is_connected', true)
      .single()

    if (!account) {
      return NextResponse.json({ error: 'Aucun compte Instagram connecté' }, { status: 400 })
    }

    const url = new URL(request.url)
    const mode = url.searchParams.get('mode') ?? 'full'

    const ctx = {
      supabase,
      workspaceId,
      accessToken: account.access_token,
      igUserId: account.ig_user_id,
      pageId: account.page_id ?? undefined,
      pageAccessToken: account.page_access_token ?? undefined,
    }

    if (mode === 'stories') {
      const count = await syncStories(ctx)
      return NextResponse.json({ data: { storiesCount: count } })
    }

    const result = await syncAll(ctx)
    return NextResponse.json({ data: result })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    console.error('[API /instagram/sync] Error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/instagram/account/route.ts src/app/api/instagram/sync/route.ts
git commit -m "feat: add Instagram account + sync API routes"
```

---

## Task 7: API Routes — Stories + Sequences

**Files:**
- Create: `src/app/api/instagram/stories/route.ts`
- Create: `src/app/api/instagram/sequences/route.ts`
- Create: `src/app/api/instagram/sequences/[id]/route.ts`
- Create: `src/app/api/instagram/sequences/[id]/items/route.ts`

- [ ] **Step 1: Create stories route**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { igStoriesFiltersSchema } from '@/lib/validations/instagram'

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const params = Object.fromEntries(request.nextUrl.searchParams.entries())
    const filters = igStoriesFiltersSchema.parse(params)

    let query = supabase
      .from('ig_stories')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('published_at', { ascending: false })

    if (filters.from) query = query.gte('published_at', filters.from)
    if (filters.to) query = query.lte('published_at', filters.to + 'T23:59:59Z')

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data: data ?? [] })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Create sequences CRUD route**

```typescript
// src/app/api/instagram/sequences/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { createSequenceSchema } from '@/lib/validations/instagram'

export async function GET() {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('story_sequences')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data: data ?? [] })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const body = await request.json()
    const parsed = createSequenceSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('story_sequences')
      .insert({ workspace_id: workspaceId, ...parsed.data })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Create sequence [id] route (PUT/DELETE)**

```typescript
// src/app/api/instagram/sequences/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { updateSequenceSchema } from '@/lib/validations/instagram'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const { id } = await params

    const body = await request.json()
    const parsed = updateSequenceSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('story_sequences')
      .update(parsed.data)
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const { id } = await params

    // Delete items first (cascade should handle it, but be explicit)
    await supabase.from('story_sequence_items').delete().eq('sequence_id', id)

    const { error } = await supabase
      .from('story_sequences')
      .delete()
      .eq('id', id)
      .eq('workspace_id', workspaceId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Create sequence items route**

```typescript
// src/app/api/instagram/sequences/[id]/items/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { updateSequenceItemsSchema } from '@/lib/validations/instagram'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await getWorkspaceId()
    const supabase = await createClient()
    const { id } = await params

    const { data, error } = await supabase
      .from('story_sequence_items')
      .select('*, story:ig_stories(*)')
      .eq('sequence_id', id)
      .order('position', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data: data ?? [] })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const { id } = await params

    const body = await request.json()
    const parsed = updateSequenceItemsSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    // Delete existing items
    await supabase.from('story_sequence_items').delete().eq('sequence_id', id)

    // Insert new items
    if (parsed.data.items.length > 0) {
      const rows = parsed.data.items.map(item => ({
        sequence_id: id,
        story_id: item.story_id,
        position: item.position,
      }))
      const { error: insertError } = await supabase
        .from('story_sequence_items')
        .insert(rows)

      if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // Recalculate sequence aggregates
    const { data: items } = await supabase
      .from('story_sequence_items')
      .select('*, story:ig_stories(impressions, replies, exits)')
      .eq('sequence_id', id)
      .order('position', { ascending: true })

    const totalImpressions = (items ?? []).reduce((s, i) => s + (i.story?.impressions ?? 0), 0)
    const totalReplies = (items ?? []).reduce((s, i) => s + (i.story?.replies ?? 0), 0)
    const first = items?.[0]?.story?.impressions ?? 0
    const last = items?.[items!.length - 1]?.story?.impressions ?? 0
    const dropoff = first > 0 ? Math.round((1 - last / first) * 100) : 0

    await supabase
      .from('story_sequences')
      .update({
        total_impressions: totalImpressions,
        total_replies: totalReplies,
        overall_dropoff_rate: dropoff,
      })
      .eq('id', id)
      .eq('workspace_id', workspaceId)

    return NextResponse.json({ success: true })
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
git add src/app/api/instagram/stories/ src/app/api/instagram/sequences/
git commit -m "feat: add Instagram stories + sequences API routes"
```

---

## Task 8: API Routes — Reels + Pillars

**Files:**
- Create: `src/app/api/instagram/reels/route.ts`
- Create: `src/app/api/instagram/pillars/route.ts`

- [ ] **Step 1: Create reels route**

```typescript
// src/app/api/instagram/reels/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { igReelsFiltersSchema } from '@/lib/validations/instagram'

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const params = Object.fromEntries(request.nextUrl.searchParams.entries())
    const filters = igReelsFiltersSchema.parse(params)

    let query = supabase
      .from('ig_reels')
      .select('*, pillar:ig_content_pillars(id, name, color)', { count: 'exact' })
      .eq('workspace_id', workspaceId)
      .order(filters.sort, { ascending: filters.order === 'asc' })

    if (filters.pillar_id) query = query.eq('pillar_id', filters.pillar_id)
    if (filters.format) query = query.eq('format', filters.format)

    const from = (filters.page - 1) * filters.per_page
    const to = from + filters.per_page - 1
    query = query.range(from, to)

    const { data, error, count } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const total = count ?? 0
    return NextResponse.json({
      data: data ?? [],
      meta: { total, page: filters.page, per_page: filters.per_page, total_pages: Math.ceil(total / filters.per_page) },
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
    const { reel_id, pillar_id, format } = body

    if (!reel_id) return NextResponse.json({ error: 'reel_id requis' }, { status: 400 })

    const updates: Record<string, unknown> = {}
    if (pillar_id !== undefined) updates.pillar_id = pillar_id || null
    if (format !== undefined) updates.format = format || null

    const { data, error } = await supabase
      .from('ig_reels')
      .update(updates)
      .eq('id', reel_id)
      .eq('workspace_id', workspaceId)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Create pillars route**

```typescript
// src/app/api/instagram/pillars/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { createPillarSchema, updatePillarSchema } from '@/lib/validations/instagram'

export async function GET() {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('ig_content_pillars')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('name')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data: data ?? [] })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const body = await request.json()
    const parsed = createPillarSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    const { data, error } = await supabase
      .from('ig_content_pillars')
      .insert({ workspace_id: workspaceId, ...parsed.data })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const body = await request.json()
    const { id, ...rest } = body
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const parsed = updatePillarSchema.safeParse(rest)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    const { data, error } = await supabase
      .from('ig_content_pillars')
      .update(parsed.data)
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const { error } = await supabase
      .from('ig_content_pillars')
      .delete()
      .eq('id', id)
      .eq('workspace_id', workspaceId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/instagram/reels/ src/app/api/instagram/pillars/
git commit -m "feat: add Instagram reels + content pillars API routes"
```

---

## Task 9: API Routes — Drafts + Publish

**Files:**
- Create: `src/app/api/instagram/drafts/route.ts`
- Create: `src/app/api/instagram/drafts/[id]/route.ts`
- Create: `src/app/api/instagram/drafts/[id]/publish/route.ts`

- [ ] **Step 1: Create drafts list/create route**

```typescript
// src/app/api/instagram/drafts/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { createDraftSchema, igDraftsFiltersSchema } from '@/lib/validations/instagram'

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const params = Object.fromEntries(request.nextUrl.searchParams.entries())
    const filters = igDraftsFiltersSchema.parse(params)

    let query = supabase
      .from('ig_drafts')
      .select('*', { count: 'exact' })
      .eq('workspace_id', workspaceId)
      .order('updated_at', { ascending: false })

    if (filters.status) query = query.eq('status', filters.status)

    const from = (filters.page - 1) * filters.per_page
    const to = from + filters.per_page - 1
    query = query.range(from, to)

    const { data, error, count } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const total = count ?? 0
    return NextResponse.json({
      data: data ?? [],
      meta: { total, page: filters.page, per_page: filters.per_page, total_pages: Math.ceil(total / filters.per_page) },
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const body = await request.json()
    const parsed = createDraftSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    if (parsed.data.status === 'scheduled' && !parsed.data.scheduled_at) {
      return NextResponse.json({ error: 'Date de programmation requise' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('ig_drafts')
      .insert({
        workspace_id: workspaceId,
        ...parsed.data,
        scheduled_at: parsed.data.scheduled_at ?? null,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Create draft [id] route (PUT/DELETE)**

```typescript
// src/app/api/instagram/drafts/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { updateDraftSchema } from '@/lib/validations/instagram'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const { id } = await params

    const body = await request.json()
    const parsed = updateDraftSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    const { data, error } = await supabase
      .from('ig_drafts')
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const { id } = await params

    const { error } = await supabase
      .from('ig_drafts')
      .delete()
      .eq('id', id)
      .eq('workspace_id', workspaceId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Create publish route**

```typescript
// src/app/api/instagram/drafts/[id]/publish/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import {
  createMediaContainer, pollContainerStatus, publishContainer,
} from '@/lib/instagram/api'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const { id } = await params

    // 1. Get draft
    const { data: draft, error: draftErr } = await supabase
      .from('ig_drafts')
      .select('*')
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .single()

    if (draftErr || !draft) {
      return NextResponse.json({ error: 'Brouillon introuvable' }, { status: 404 })
    }

    if (!draft.media_urls?.length) {
      return NextResponse.json({ error: 'Au moins un média requis' }, { status: 400 })
    }

    // 2. Get IG account
    const { data: account } = await supabase
      .from('ig_accounts')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('is_connected', true)
      .single()

    if (!account) {
      return NextResponse.json({ error: 'Aucun compte Instagram connecté' }, { status: 400 })
    }

    // 3. Mark as publishing
    await supabase.from('ig_drafts').update({ status: 'publishing' }).eq('id', id)

    // 4. Build caption with hashtags
    let fullCaption = draft.caption ?? ''
    if (draft.hashtags?.length) {
      fullCaption += '\n\n' + draft.hashtags.map((h: string) => (h.startsWith('#') ? h : `#${h}`)).join(' ')
    }

    try {
      const isVideo = draft.media_type === 'VIDEO'
      const opts = {
        accessToken: account.access_token,
        igUserId: account.ig_user_id,
        caption: fullCaption,
        ...(isVideo
          ? { videoUrl: draft.media_urls[0] }
          : { imageUrl: draft.media_urls[0] }),
      }

      // 5. Create container
      const containerId = await createMediaContainer(opts)

      // 6. Poll for video processing
      if (isVideo) {
        const status = await pollContainerStatus(account.access_token, containerId)
        if (status === 'ERROR') throw new Error('Video processing failed')
      }

      // 7. Publish
      const igMediaId = await publishContainer({
        accessToken: account.access_token,
        igUserId: account.ig_user_id,
        containerId,
      })

      // 8. Update draft
      await supabase.from('ig_drafts').update({
        status: 'published',
        published_at: new Date().toISOString(),
        ig_media_id: igMediaId,
        updated_at: new Date().toISOString(),
      }).eq('id', id)

      return NextResponse.json({ data: { ig_media_id: igMediaId } })
    } catch (pubErr) {
      const message = pubErr instanceof Error ? pubErr.message : 'Publication échouée'
      await supabase.from('ig_drafts').update({
        status: 'failed',
        error_message: message,
        updated_at: new Date().toISOString(),
      }).eq('id', id)
      return NextResponse.json({ error: message }, { status: 500 })
    }
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    console.error('[API /instagram/drafts/publish] Error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/instagram/drafts/
git commit -m "feat: add Instagram drafts CRUD + publish API routes"
```

---

## Task 10: API Routes — Hashtags, Templates, Snapshots, Goals

**Files:**
- Create: `src/app/api/instagram/hashtag-groups/route.ts`
- Create: `src/app/api/instagram/caption-templates/route.ts`
- Create: `src/app/api/instagram/snapshots/route.ts`
- Create: `src/app/api/instagram/goals/route.ts`

- [ ] **Step 1: Create hashtag-groups route**

```typescript
// src/app/api/instagram/hashtag-groups/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { createHashtagGroupSchema, updateHashtagGroupSchema } from '@/lib/validations/instagram'

export async function GET() {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('ig_hashtag_groups').select('*').eq('workspace_id', workspaceId).order('name')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data: data ?? [] })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated')
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const body = await request.json()
    const parsed = createHashtagGroupSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    const { data, error } = await supabase
      .from('ig_hashtag_groups').insert({ workspace_id: workspaceId, ...parsed.data }).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated')
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const body = await request.json()
    const { id, ...rest } = body
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })
    const parsed = updateHashtagGroupSchema.safeParse(rest)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    const { data, error } = await supabase
      .from('ig_hashtag_groups').update(parsed.data).eq('id', id).eq('workspace_id', workspaceId).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated')
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })
    const { error } = await supabase
      .from('ig_hashtag_groups').delete().eq('id', id).eq('workspace_id', workspaceId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated')
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Create caption-templates route**

```typescript
// src/app/api/instagram/caption-templates/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { createCaptionTemplateSchema, updateCaptionTemplateSchema } from '@/lib/validations/instagram'

export async function GET() {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('ig_caption_templates').select('*').eq('workspace_id', workspaceId).order('title')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data: data ?? [] })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated')
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const body = await request.json()
    const parsed = createCaptionTemplateSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    const { data, error } = await supabase
      .from('ig_caption_templates').insert({ workspace_id: workspaceId, ...parsed.data }).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated')
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const body = await request.json()
    const { id, ...rest } = body
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })
    const parsed = updateCaptionTemplateSchema.safeParse(rest)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    const { data, error } = await supabase
      .from('ig_caption_templates').update(parsed.data).eq('id', id).eq('workspace_id', workspaceId).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated')
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })
    const { error } = await supabase
      .from('ig_caption_templates').delete().eq('id', id).eq('workspace_id', workspaceId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated')
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Create snapshots route**

```typescript
// src/app/api/instagram/snapshots/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'

export async function GET() {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('ig_snapshots').select('*').eq('workspace_id', workspaceId)
      .order('snapshot_date', { ascending: true })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data: data ?? [] })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated')
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Create goals route**

```typescript
// src/app/api/instagram/goals/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { upsertGoalSchema } from '@/lib/validations/instagram'

export async function GET() {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('ig_goals').select('*').eq('workspace_id', workspaceId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data: data ?? [] })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated')
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const body = await request.json()
    const parsed = upsertGoalSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    const { data, error } = await supabase
      .from('ig_goals').upsert({
        workspace_id: workspaceId,
        ...parsed.data,
      }, { onConflict: 'workspace_id,quarter,metric' })
      .select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated')
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/instagram/hashtag-groups/ src/app/api/instagram/caption-templates/ src/app/api/instagram/snapshots/ src/app/api/instagram/goals/
git commit -m "feat: add Instagram hashtags, templates, snapshots, goals API routes"
```

---

## Task 11: API Routes — Conversations + Messages

**Files:**
- Create: `src/app/api/instagram/conversations/route.ts`
- Create: `src/app/api/instagram/messages/route.ts`
- Create: `src/app/api/instagram/messages/send/route.ts`

- [ ] **Step 1: Create conversations route**

```typescript
// src/app/api/instagram/conversations/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { igConversationsFiltersSchema } from '@/lib/validations/instagram'

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const params = Object.fromEntries(request.nextUrl.searchParams.entries())
    const filters = igConversationsFiltersSchema.parse(params)

    let query = supabase
      .from('ig_conversations')
      .select('*', { count: 'exact' })
      .eq('workspace_id', workspaceId)
      .order('last_message_at', { ascending: false })

    if (filters.search) {
      query = query.or(
        `participant_username.ilike.%${filters.search}%,participant_name.ilike.%${filters.search}%`
      )
    }

    const from = (filters.page - 1) * filters.per_page
    const to = from + filters.per_page - 1
    query = query.range(from, to)

    const { data, error, count } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const total = count ?? 0
    return NextResponse.json({
      data: data ?? [],
      meta: { total, page: filters.page, per_page: filters.per_page },
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated')
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Create messages route**

```typescript
// src/app/api/instagram/messages/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'

export async function GET(request: NextRequest) {
  try {
    await getWorkspaceId()
    const supabase = await createClient()
    const conversationId = request.nextUrl.searchParams.get('conversation_id')
    if (!conversationId) return NextResponse.json({ error: 'conversation_id requis' }, { status: 400 })

    const { data, error } = await supabase
      .from('ig_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('sent_at', { ascending: true })
      .limit(100)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data: data ?? [] })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated')
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Create send message route**

```typescript
// src/app/api/instagram/messages/send/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { sendMessageSchema } from '@/lib/validations/instagram'
import { sendIgMessage } from '@/lib/instagram/api'

export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const body = await request.json()
    const parsed = sendMessageSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    // Get account
    const { data: account } = await supabase
      .from('ig_accounts')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('is_connected', true)
      .single()

    if (!account?.page_id || !account?.page_access_token) {
      return NextResponse.json({ error: 'Compte Instagram non configuré pour les messages' }, { status: 400 })
    }

    // Get conversation
    const { data: convo } = await supabase
      .from('ig_conversations')
      .select('participant_ig_id')
      .eq('id', parsed.data.conversation_id)
      .eq('workspace_id', workspaceId)
      .single()

    if (!convo?.participant_ig_id) {
      return NextResponse.json({ error: 'Conversation introuvable' }, { status: 404 })
    }

    // Send via IG API
    const messageId = await sendIgMessage(
      account.page_access_token,
      account.page_id,
      convo.participant_ig_id,
      parsed.data.text
    )

    // Save to DB
    const { data: msg, error } = await supabase
      .from('ig_messages')
      .insert({
        workspace_id: workspaceId,
        conversation_id: parsed.data.conversation_id,
        ig_message_id: messageId,
        sender_type: 'user',
        text: parsed.data.text,
        sent_at: new Date().toISOString(),
        is_read: true,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Update conversation
    await supabase
      .from('ig_conversations')
      .update({
        last_message_text: parsed.data.text,
        last_message_at: new Date().toISOString(),
      })
      .eq('id', parsed.data.conversation_id)

    return NextResponse.json({ data: msg }, { status: 201 })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated')
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    console.error('[API /instagram/messages/send] Error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/instagram/conversations/ src/app/api/instagram/messages/
git commit -m "feat: add Instagram conversations + messages API routes"
```

---

## Task 12: Sidebar Navigation Update

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Add imports and nav items**

In the imports, add `Share2` and `MessageCircle` from lucide-react.

In the NAV array, in the ACQUISITION section, add two new items between `Emails` and `Publicites`:

```typescript
{ label: 'Réseaux sociaux', href: '/acquisition/reseaux-sociaux', icon: Share2 },
{ label: 'Messages', href: '/acquisition/messages', icon: MessageCircle },
```

The ACQUISITION items section should become:
```typescript
{
  title: 'ACQUISITION',
  items: [
    { label: 'Funnels', href: '/acquisition/funnels', icon: Layers },
    { label: 'Automations', href: '/acquisition/automations', icon: Zap },
    { label: 'Emails', href: '/acquisition/emails', icon: Mail },
    { label: 'Réseaux sociaux', href: '/acquisition/reseaux-sociaux', icon: Share2 },
    { label: 'Messages', href: '/acquisition/messages', icon: MessageCircle },
    { label: 'Publicités', href: '/acquisition/publicites', icon: Megaphone },
  ],
},
```

- [ ] **Step 2: Commit**

```bash
git add src/components/layout/Sidebar.tsx
git commit -m "feat: add Réseaux sociaux + Messages to sidebar navigation"
```

---

## Task 13: Shared Components — Platform Tabs + Sub Tabs + Not Connected State

**Files:**
- Create: `src/components/social/SocialPlatformTabs.tsx`
- Create: `src/components/social/instagram/IgSubTabs.tsx`
- Create: `src/components/social/instagram/IgNotConnected.tsx`
- Create: `src/components/social/instagram/constants.ts`

- [ ] **Step 1: Create SocialPlatformTabs**

```typescript
// src/components/social/SocialPlatformTabs.tsx
'use client'

import { Instagram } from 'lucide-react'

const PLATFORMS = [
  { key: 'instagram', label: 'Instagram', icon: Instagram, active: true },
  // Future: TikTok, YouTube, LinkedIn
] as const

interface Props {
  selected: string
  onChange: (key: string) => void
}

export default function SocialPlatformTabs({ selected, onChange }: Props) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
      {PLATFORMS.map(p => {
        const isActive = selected === p.key
        const Icon = p.icon
        return (
          <button
            key={p.key}
            onClick={() => p.active && onChange(p.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 16px', fontSize: 13, fontWeight: 600,
              color: isActive ? '#fff' : 'var(--text-tertiary)',
              background: isActive ? 'var(--bg-elevated)' : 'transparent',
              border: isActive ? '1px solid var(--border-primary)' : '1px solid transparent',
              borderRadius: 8, cursor: p.active ? 'pointer' : 'default',
              opacity: p.active ? 1 : 0.4,
            }}
          >
            <Icon size={16} />
            {p.label}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Create IgSubTabs**

```typescript
// src/components/social/instagram/IgSubTabs.tsx
'use client'

const TABS = [
  { key: 'general', label: 'Général' },
  { key: 'stories', label: 'Stories' },
  { key: 'reels', label: 'Reels' },
  { key: 'calendar', label: 'Calendrier' },
] as const

interface Props {
  selected: string
  onChange: (key: string) => void
}

export default function IgSubTabs({ selected, onChange }: Props) {
  return (
    <div style={{
      display: 'flex', gap: 4, marginBottom: 28,
      borderBottom: '1px solid var(--border-primary)', paddingBottom: 0,
    }}>
      {TABS.map(tab => {
        const active = selected === tab.key
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            style={{
              padding: '8px 16px', fontSize: 13, fontWeight: 500,
              color: active ? 'var(--color-primary)' : 'var(--text-tertiary)',
              background: 'none', border: 'none',
              borderBottom: active ? '2px solid var(--color-primary)' : '2px solid transparent',
              cursor: 'pointer', marginBottom: -1,
            }}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 3: Create IgNotConnected**

```typescript
// src/components/social/instagram/IgNotConnected.tsx
'use client'

import { Instagram } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function IgNotConnected() {
  const router = useRouter()

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: 80, textAlign: 'center',
      background: 'var(--bg-secondary)', borderRadius: 12,
      border: '1px solid var(--border-primary)',
    }}>
      <Instagram size={48} style={{ color: 'var(--text-tertiary)', marginBottom: 16 }} />
      <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
        Connectez votre compte Instagram
      </h3>
      <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 24, maxWidth: 400 }}>
        Pour accéder aux stories, reels, calendrier de publication et messages,
        connectez d'abord votre compte Instagram via l'intégration Meta.
      </p>
      <button
        onClick={() => router.push('/parametres/integrations')}
        style={{
          padding: '10px 24px', fontSize: 13, fontWeight: 600,
          color: '#fff', background: 'var(--color-primary)',
          border: 'none', borderRadius: 8, cursor: 'pointer',
        }}
      >
        Aller aux intégrations
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Create constants re-export**

```typescript
// src/components/social/instagram/constants.ts
export { IG_SEQ_TYPES, IG_PERIODS, IG_CAPTION_CATEGORIES, IG_REEL_FORMATS, IG_GOAL_METRICS } from '@/lib/instagram/constants'
export type { SeqTypeKey } from '@/lib/instagram/constants'
```

- [ ] **Step 5: Commit**

```bash
git add src/components/social/
git commit -m "feat: add social platform tabs, IG sub-tabs, not-connected state"
```

---

## Task 14: Réseaux Sociaux Page + Instagram Général Tab

**Files:**
- Create: `src/app/(dashboard)/acquisition/reseaux-sociaux/page.tsx`
- Create: `src/components/social/instagram/IgGeneralTab.tsx`

- [ ] **Step 1: Create the main page**

```typescript
// src/app/(dashboard)/acquisition/reseaux-sociaux/page.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import SocialPlatformTabs from '@/components/social/SocialPlatformTabs'
import IgSubTabs from '@/components/social/instagram/IgSubTabs'
import IgNotConnected from '@/components/social/instagram/IgNotConnected'
import IgGeneralTab from '@/components/social/instagram/IgGeneralTab'
import IgStoriesTab from '@/components/social/instagram/IgStoriesTab'
import IgReelsTab from '@/components/social/instagram/IgReelsTab'
import IgCalendarTab from '@/components/social/instagram/IgCalendarTab'

export default function ReseauxSociauxPage() {
  const [platform, setPlatform] = useState('instagram')
  const [igTab, setIgTab] = useState('general')
  const [igAccount, setIgAccount] = useState<unknown>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

  const fetchAccount = useCallback(async () => {
    try {
      const res = await fetch('/api/instagram/account')
      const json = await res.json()
      setIgAccount(json.data ?? null)
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => { fetchAccount() }, [fetchAccount])

  const handleSync = async () => {
    setSyncing(true)
    try {
      await fetch('/api/instagram/sync', { method: 'POST' })
    } catch { /* ignore */ }
    setSyncing(false)
  }

  const handleLinkAccount = async () => {
    try {
      await fetch('/api/instagram/account', { method: 'POST' })
      await fetchAccount()
    } catch { /* ignore */ }
  }

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1200 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>
          Réseaux sociaux
        </h1>
        {igAccount && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleSync}
              disabled={syncing}
              style={{
                padding: '8px 16px', fontSize: 12, fontWeight: 600,
                color: '#fff', background: 'var(--color-primary)',
                border: 'none', borderRadius: 8, cursor: 'pointer',
                opacity: syncing ? 0.6 : 1,
              }}
            >
              {syncing ? 'Synchronisation...' : 'Synchroniser'}
            </button>
          </div>
        )}
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 24 }}>
        Gérez vos réseaux sociaux, stories, reels et calendrier de publication
      </p>

      <SocialPlatformTabs selected={platform} onChange={setPlatform} />

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)', fontSize: 13 }}>
          Chargement...
        </div>
      ) : !igAccount ? (
        <IgNotConnected />
      ) : (
        <>
          <IgSubTabs selected={igTab} onChange={setIgTab} />
          {igTab === 'general' && <IgGeneralTab onLinkAccount={handleLinkAccount} />}
          {igTab === 'stories' && <IgStoriesTab />}
          {igTab === 'reels' && <IgReelsTab />}
          {igTab === 'calendar' && <IgCalendarTab />}
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create IgGeneralTab**

This is a large component. It fetches snapshots, reels, goals and renders KPI cards, growth chart (recharts LineChart), top reels table, and goals progress bars. Full implementation:

```typescript
// src/components/social/instagram/IgGeneralTab.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { IG_PERIODS, IG_GOAL_METRICS } from './constants'
import type { IgSnapshot, IgReel, IgGoal } from '@/types'

interface Props {
  onLinkAccount: () => void
}

export default function IgGeneralTab({ onLinkAccount }: Props) {
  const [period, setPeriod] = useState('30d')
  const [snapshots, setSnapshots] = useState<IgSnapshot[]>([])
  const [reels, setReels] = useState<IgReel[]>([])
  const [goals, setGoals] = useState<IgGoal[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [snapRes, reelsRes, goalsRes] = await Promise.all([
      fetch('/api/instagram/snapshots'),
      fetch('/api/instagram/reels?per_page=100'),
      fetch('/api/instagram/goals'),
    ])
    const [snapJson, reelsJson, goalsJson] = await Promise.all([
      snapRes.json(), reelsRes.json(), goalsRes.json(),
    ])
    setSnapshots(snapJson.data ?? [])
    setReels(reelsJson.data ?? [])
    setGoals(goalsJson.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Filter reels by period
  const periodDays = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : period === '6m' ? 180 : 365
  const cutoff = new Date(Date.now() - periodDays * 86400000).toISOString()
  const filteredReels = reels.filter(r => r.published_at >= cutoff)

  // KPIs
  const latestSnap = snapshots[snapshots.length - 1]
  const totalViews = filteredReels.reduce((s, r) => s + r.views, 0)
  const totalReach = filteredReels.reduce((s, r) => s + r.reach, 0)
  const avgEngagement = filteredReels.length > 0
    ? filteredReels.reduce((s, r) => s + r.engagement_rate, 0) / filteredReels.length
    : 0

  // Growth chart data
  const chartData = snapshots.map(s => ({
    date: s.snapshot_date,
    Followers: s.followers,
    Vues: Number(s.total_views),
    Reach: Number(s.total_reach),
  }))

  // Top reels
  const topReels = [...filteredReels].sort((a, b) => b.views - a.views).slice(0, 10)

  // Current quarter
  const now = new Date()
  const quarter = `${now.getFullYear()}-Q${Math.ceil((now.getMonth() + 1) / 3)}`
  const quarterGoals = goals.filter(g => g.quarter === quarter)

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)', fontSize: 13 }}>Chargement...</div>
  }

  return (
    <div>
      {/* Period selector */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24 }}>
        {IG_PERIODS.map(p => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            style={{
              padding: '6px 12px', fontSize: 12, fontWeight: 500,
              color: period === p.value ? '#fff' : 'var(--text-tertiary)',
              background: period === p.value ? 'var(--bg-elevated)' : 'transparent',
              border: period === p.value ? '1px solid var(--border-primary)' : '1px solid transparent',
              borderRadius: 6, cursor: 'pointer',
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 32 }}>
        <KpiCard label="Followers" value={latestSnap?.followers?.toLocaleString() ?? '—'} />
        <KpiCard label="Nouveaux" value={latestSnap?.new_followers?.toLocaleString() ?? '—'} />
        <KpiCard label="Vues" value={totalViews.toLocaleString()} />
        <KpiCard label="Reach" value={totalReach.toLocaleString()} />
        <KpiCard label="Engagement" value={`${avgEngagement.toFixed(1)}%`} />
      </div>

      {/* Growth chart */}
      {chartData.length > 1 && (
        <div style={{
          background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
          borderRadius: 12, padding: 20, marginBottom: 32,
        }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>
            Tendance de croissance
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData}>
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#666' }} />
              <YAxis tick={{ fontSize: 11, fill: '#666' }} />
              <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, fontSize: 12 }} />
              <Line type="monotone" dataKey="Followers" stroke="#3b82f6" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Vues" stroke="#22c55e" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Reach" stroke="#f97316" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Goals */}
      {quarterGoals.length > 0 && (
        <div style={{
          background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
          borderRadius: 12, padding: 20, marginBottom: 32,
        }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>
            Objectifs {quarter}
          </h3>
          <div style={{ display: 'grid', gap: 12 }}>
            {quarterGoals.map(g => {
              const metricLabel = IG_GOAL_METRICS.find(m => m.value === g.metric)?.label ?? g.metric
              const current = g.metric === 'followers' ? (latestSnap?.followers ?? 0) : 0
              const pct = g.target_value > 0 ? Math.min(100, (current / g.target_value) * 100) : 0
              return (
                <div key={g.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{metricLabel}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                      {current} / {g.target_value}
                    </span>
                  </div>
                  <div style={{ height: 6, background: 'var(--bg-primary)', borderRadius: 3 }}>
                    <div style={{
                      height: '100%', width: `${pct}%`, borderRadius: 3,
                      background: pct >= 100 ? '#22c55e' : 'var(--color-primary)',
                    }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Top Reels */}
      {topReels.length > 0 && (
        <div style={{
          background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
          borderRadius: 12, padding: 20,
        }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>
            Top Reels
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Caption', 'Vues', 'Likes', 'Saves', 'Shares', 'Engagement'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', borderBottom: '1px solid var(--border-primary)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topReels.map(r => (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--border-primary)' }}>
                    <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-primary)', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.caption?.slice(0, 60) ?? '—'}
                    </td>
                    <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-secondary)' }}>{r.views.toLocaleString()}</td>
                    <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-secondary)' }}>{r.likes.toLocaleString()}</td>
                    <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-secondary)' }}>{r.saves.toLocaleString()}</td>
                    <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-secondary)' }}>{r.shares.toLocaleString()}</td>
                    <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-secondary)' }}>{r.engagement_rate.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
      borderRadius: 12, padding: '16px 20px',
    }}>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
    </div>
  )
}
```

- [ ] **Step 3: Verify build compiles**

Run: `npx next build --no-lint 2>&1 | tail -20`
Expected: No TypeScript errors on the new files.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/acquisition/reseaux-sociaux/page.tsx src/components/social/instagram/IgGeneralTab.tsx
git commit -m "feat: add Réseaux sociaux page + Instagram Général tab with KPIs and charts"
```

---

## Task 15: Stories Tab + Sequence Components

**Files:**
- Create: `src/components/social/instagram/IgStoriesTab.tsx`
- Create: `src/components/social/instagram/IgSequenceModal.tsx`
- Create: `src/components/social/instagram/IgStoriesSelector.tsx`
- Create: `src/components/social/instagram/IgSequenceDetail.tsx`

These are 4 interconnected components. Due to the plan size, the implementation code for each is specified in the spec (sections 7.1-7.5). The agent implementing this task should follow the spec exactly. Key behaviors:

- [ ] **Step 1: Create IgStoriesTab** — week navigation with `weekOffset` state, 7 day buttons, sequences filtered by selected day, story cards with drop-off arrows, KPI cards, stories outside sequences, and a summary table. Fetches from `/api/instagram/stories` and `/api/instagram/sequences`.

- [ ] **Step 2: Create IgSequenceModal** — modal with inputs for name (required), sequence_type (dropdown from IG_SEQ_TYPES), objective (optional), notes (optional). On save, POST to `/api/instagram/sequences`.

- [ ] **Step 3: Create IgStoriesSelector** — modal listing all synced stories with checkboxes, thumbnails, captions, dates, impressions. On save, PUT to `/api/instagram/sequences/[id]/items` with the selected story_ids and positions.

- [ ] **Step 4: Create IgSequenceDetail** — detail view with back button, name + type badge, objective, notes, metrics (stories count, impressions, drop-off %, replies), retention funnel (horizontal bars proportional to impressions), story grid thumbnails, and "Ajouter des stories" button. Fetches from `/api/instagram/sequences/[id]/items`.

- [ ] **Step 5: Verify build**

Run: `npx next build --no-lint 2>&1 | tail -20`

- [ ] **Step 6: Commit**

```bash
git add src/components/social/instagram/IgStoriesTab.tsx src/components/social/instagram/IgSequenceModal.tsx src/components/social/instagram/IgStoriesSelector.tsx src/components/social/instagram/IgSequenceDetail.tsx
git commit -m "feat: add Instagram Stories tab with sequences, drop-off funnel, and modals"
```

---

## Task 16: Reels Tab

**Files:**
- Create: `src/components/social/instagram/IgReelsTab.tsx`

- [ ] **Step 1: Create IgReelsTab** — fetches from `/api/instagram/reels` and `/api/instagram/pillars`. Displays 4 KPI cards (Total Views, Avg Engagement %, Total Reels, Avg Reach), a complete table of reels with thumbnail, caption, pillar badge, views, saves, shares, comments. Includes a content pillars section with CRUD (name + color hex picker) via calls to `/api/instagram/pillars`. Uses a PieChart from recharts for pillar distribution. Clicking a reel opens a detail modal with video player and full stats.

- [ ] **Step 2: Verify build**

Run: `npx next build --no-lint 2>&1 | tail -20`

- [ ] **Step 3: Commit**

```bash
git add src/components/social/instagram/IgReelsTab.tsx
git commit -m "feat: add Instagram Reels tab with table, pillars, and distribution chart"
```

---

## Task 17: Calendar Tab + Content Planner

**Files:**
- Create: `src/components/social/instagram/IgCalendarTab.tsx`
- Create: `src/components/social/instagram/IgCalendarView.tsx`
- Create: `src/components/social/instagram/IgDraftModal.tsx`
- Create: `src/components/social/instagram/IgDraftsList.tsx`
- Create: `src/components/social/instagram/IgHashtagGroups.tsx`
- Create: `src/components/social/instagram/IgCaptionTemplates.tsx`
- Create: `src/components/social/instagram/IgBestTime.tsx`

- [ ] **Step 1: Create IgCalendarTab** — sub-tabs component (Calendrier, Brouillons, Programmés, Hashtags, Templates, Best Time) that renders the appropriate child component.

```typescript
// src/components/social/instagram/IgCalendarTab.tsx
'use client'

import { useState } from 'react'
import IgCalendarView from './IgCalendarView'
import IgDraftsList from './IgDraftsList'
import IgHashtagGroups from './IgHashtagGroups'
import IgCaptionTemplates from './IgCaptionTemplates'
import IgBestTime from './IgBestTime'

const SUB_TABS = [
  { key: 'calendar', label: 'Calendrier' },
  { key: 'drafts', label: 'Brouillons' },
  { key: 'scheduled', label: 'Programmés' },
  { key: 'hashtags', label: 'Hashtags' },
  { key: 'templates', label: 'Templates' },
  { key: 'besttime', label: 'Best Time' },
] as const

export default function IgCalendarTab() {
  const [tab, setTab] = useState('calendar')

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 24 }}>
        {SUB_TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '6px 14px', fontSize: 12, fontWeight: 500,
              color: tab === t.key ? '#fff' : 'var(--text-tertiary)',
              background: tab === t.key ? 'var(--bg-elevated)' : 'transparent',
              border: tab === t.key ? '1px solid var(--border-primary)' : '1px solid transparent',
              borderRadius: 6, cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'calendar' && <IgCalendarView />}
      {tab === 'drafts' && <IgDraftsList status="draft" />}
      {tab === 'scheduled' && <IgDraftsList status="scheduled" />}
      {tab === 'hashtags' && <IgHashtagGroups />}
      {tab === 'templates' && <IgCaptionTemplates />}
      {tab === 'besttime' && <IgBestTime />}
    </div>
  )
}
```

- [ ] **Step 2: Create IgCalendarView** — monthly calendar grid (7 cols Lun→Dim), navigation ← month →, events colored by status (green=published, blue=scheduled, gray=draft, red=failed), max 3 per day, click day opens IgDraftModal, click event opens IgDraftModal with existing draft. Fetches from `/api/instagram/drafts` and `/api/instagram/reels` (for published overlay).

- [ ] **Step 3: Create IgDraftModal** — 2-column modal (950px). Left (320px): media preview 9:16, drag-and-drop upload zone, URL input. Right: caption textarea with /2200 counter, template dropdown (fetches `/api/instagram/caption-templates`), hashtags input with /30 counter, hashtag group dropdown (fetches `/api/instagram/hashtag-groups`), media type toggle (IMAGE/VIDEO/CAROUSEL), date picker + time picker. 3 buttons: Brouillon (gray, saves as draft), Programmer (blue, saves as scheduled), Publier (green, calls `/api/instagram/drafts/[id]/publish`). Upload goes to Supabase Storage bucket `content-drafts`.

- [ ] **Step 4: Create IgDraftsList** — receives `status` prop ('draft' | 'scheduled'), fetches `/api/instagram/drafts?status=X`, displays cards with thumbnail, caption (120 chars), hashtags (5 first), date, media type, and Edit/Delete buttons.

- [ ] **Step 5: Create IgHashtagGroups** — fetches `/api/instagram/hashtag-groups`, grid of cards with name + hashtag badges. CRUD modal: name input + hashtags textarea (comma-separated). Uses POST/PUT/DELETE on `/api/instagram/hashtag-groups`.

- [ ] **Step 6: Create IgCaptionTemplates** — fetches `/api/instagram/caption-templates`, grid of cards with title, body preview, category badge, hashtags. CRUD modal: title, category dropdown (IG_CAPTION_CATEGORIES), body textarea, hashtags. Uses POST/PUT/DELETE on `/api/instagram/caption-templates`.

- [ ] **Step 7: Create IgBestTime** — requires min 5 reels. Fetches `/api/instagram/reels?per_page=100`. Builds heatmap: rows=hours (6h→23h), cols=days (Lun→Dim). For each reel, extracts day-of-week + hour from published_at, groups by day-hour combo, calculates avg engagement_rate. Color intensity = avg/maxAvg using red gradient. Shows top 5 slots as cards below the heatmap.

- [ ] **Step 8: Verify build**

Run: `npx next build --no-lint 2>&1 | tail -20`

- [ ] **Step 9: Commit**

```bash
git add src/components/social/instagram/IgCalendarTab.tsx src/components/social/instagram/IgCalendarView.tsx src/components/social/instagram/IgDraftModal.tsx src/components/social/instagram/IgDraftsList.tsx src/components/social/instagram/IgHashtagGroups.tsx src/components/social/instagram/IgCaptionTemplates.tsx src/components/social/instagram/IgBestTime.tsx
git commit -m "feat: add Content Planner — calendar, drafts, publish, hashtags, templates, best time"
```

---

## Task 18: Messages Page

**Files:**
- Create: `src/app/(dashboard)/acquisition/messages/page.tsx`
- Create: `src/components/messages/ConversationList.tsx`
- Create: `src/components/messages/ConversationThread.tsx`
- Create: `src/components/messages/MessageInput.tsx`

- [ ] **Step 1: Create the Messages page**

```typescript
// src/app/(dashboard)/acquisition/messages/page.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import ConversationList from '@/components/messages/ConversationList'
import ConversationThread from '@/components/messages/ConversationThread'
import MessageInput from '@/components/messages/MessageInput'
import IgNotConnected from '@/components/social/instagram/IgNotConnected'
import type { IgConversation, IgMessage } from '@/types'

export default function MessagesPage() {
  const [conversations, setConversations] = useState<IgConversation[]>([])
  const [selected, setSelected] = useState<IgConversation | null>(null)
  const [messages, setMessages] = useState<IgMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [hasAccount, setHasAccount] = useState(true)
  const [search, setSearch] = useState('')

  const fetchConversations = useCallback(async () => {
    setLoading(true)
    try {
      const accRes = await fetch('/api/instagram/account')
      const accJson = await accRes.json()
      if (!accJson.data) { setHasAccount(false); setLoading(false); return }

      const params = new URLSearchParams()
      if (search) params.set('search', search)
      const res = await fetch(`/api/instagram/conversations?${params}`)
      const json = await res.json()
      setConversations(json.data ?? [])
    } catch { /* ignore */ }
    setLoading(false)
  }, [search])

  useEffect(() => { fetchConversations() }, [fetchConversations])

  const fetchMessages = useCallback(async (convo: IgConversation) => {
    setSelected(convo)
    const res = await fetch(`/api/instagram/messages?conversation_id=${convo.id}`)
    const json = await res.json()
    setMessages(json.data ?? [])
  }, [])

  const handleSend = async (text: string) => {
    if (!selected) return
    const res = await fetch('/api/instagram/messages/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversation_id: selected.id, text }),
    })
    if (res.ok) {
      const json = await res.json()
      setMessages(prev => [...prev, json.data])
      // Update conversation preview
      setConversations(prev => prev.map(c =>
        c.id === selected.id
          ? { ...c, last_message_text: text, last_message_at: new Date().toISOString() }
          : c
      ))
    }
  }

  if (!hasAccount) {
    return (
      <div style={{ padding: '32px 40px', maxWidth: 1200 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>Messages</h1>
        <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 24 }}>Conversations Instagram</p>
        <IgNotConnected />
      </div>
    )
  }

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1200 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>Messages</h1>
      <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 24 }}>Conversations Instagram</p>

      <div style={{
        display: 'flex', height: 'calc(100vh - 200px)',
        background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
        borderRadius: 12, overflow: 'hidden',
      }}>
        {/* Left: conversation list */}
        <div style={{ width: 350, borderRight: '1px solid var(--border-primary)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: 12 }}>
            <input
              placeholder="Rechercher..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%', padding: '8px 12px', fontSize: 13,
                background: 'var(--bg-primary)', color: 'var(--text-primary)',
                border: '1px solid var(--border-primary)', borderRadius: 8,
                outline: 'none',
              }}
            />
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <ConversationList
              conversations={conversations}
              selected={selected}
              onSelect={fetchMessages}
              loading={loading}
            />
          </div>
        </div>

        {/* Right: thread */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {selected ? (
            <>
              {/* Header */}
              <div style={{
                padding: '12px 16px', borderBottom: '1px solid var(--border-primary)',
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: 'var(--bg-elevated)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 600, color: 'var(--text-primary)',
                  overflow: 'hidden',
                }}>
                  {selected.participant_avatar_url
                    ? <img src={selected.participant_avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : (selected.participant_name?.[0] ?? selected.participant_username?.[0] ?? '?')
                  }
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {selected.participant_name ?? selected.participant_username}
                  </div>
                  {selected.participant_username && (
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                      @{selected.participant_username}
                    </div>
                  )}
                </div>
                {selected.lead_id && (
                  <a
                    href={`/leads/${selected.lead_id}`}
                    style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--color-primary)', textDecoration: 'none' }}
                  >
                    Voir la fiche lead →
                  </a>
                )}
              </div>

              {/* Messages */}
              <ConversationThread messages={messages} />

              {/* Input */}
              <MessageInput onSend={handleSend} />
            </>
          ) : (
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-tertiary)', fontSize: 13,
            }}>
              Sélectionnez une conversation
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create ConversationList**

```typescript
// src/components/messages/ConversationList.tsx
'use client'

import type { IgConversation } from '@/types'

interface Props {
  conversations: IgConversation[]
  selected: IgConversation | null
  onSelect: (c: IgConversation) => void
  loading: boolean
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "à l'instant"
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}j`
}

export default function ConversationList({ conversations, selected, onSelect, loading }: Props) {
  if (loading) {
    return <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>Chargement...</div>
  }

  if (conversations.length === 0) {
    return <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>Aucune conversation</div>
  }

  return (
    <div>
      {conversations.map(c => {
        const isSelected = selected?.id === c.id
        return (
          <button
            key={c.id}
            onClick={() => onSelect(c)}
            style={{
              display: 'flex', gap: 10, padding: '12px 16px', width: '100%',
              background: isSelected ? 'var(--bg-active)' : 'transparent',
              border: 'none', cursor: 'pointer', textAlign: 'left',
              borderBottom: '1px solid var(--border-primary)',
            }}
          >
            {/* Avatar */}
            <div style={{
              width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
              background: 'var(--bg-elevated)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 600, color: 'var(--text-primary)',
              overflow: 'hidden',
            }}>
              {c.participant_avatar_url
                ? <img src={c.participant_avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : (c.participant_name?.[0] ?? c.participant_username?.[0] ?? '?')
              }
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <span style={{
                  fontSize: 13, fontWeight: c.unread_count > 0 ? 700 : 500,
                  color: 'var(--text-primary)', overflow: 'hidden',
                  textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {c.participant_name ?? c.participant_username ?? 'Inconnu'}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0 }}>
                  {timeAgo(c.last_message_at)}
                </span>
              </div>
              <div style={{
                fontSize: 12, color: c.unread_count > 0 ? 'var(--text-secondary)' : 'var(--text-tertiary)',
                fontWeight: c.unread_count > 0 ? 600 : 400,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {c.last_message_text ?? ''}
              </div>
            </div>

            {/* Unread badge */}
            {c.unread_count > 0 && (
              <div style={{
                width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                background: 'var(--color-primary)', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 700, color: '#fff', alignSelf: 'center',
              }}>
                {c.unread_count}
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 3: Create ConversationThread**

```typescript
// src/components/messages/ConversationThread.tsx
'use client'

import { useEffect, useRef } from 'react'
import type { IgMessage } from '@/types'

interface Props {
  messages: IgMessage[]
}

export default function ConversationThread({ messages }: Props) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (messages.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
        Aucun message
      </div>
    )
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {messages.map(msg => {
        const isUser = msg.sender_type === 'user'
        return (
          <div
            key={msg.id}
            style={{
              display: 'flex', flexDirection: 'column',
              alignItems: isUser ? 'flex-end' : 'flex-start',
            }}
          >
            {msg.media_url && (
              <div style={{ marginBottom: 4, maxWidth: 220 }}>
                {msg.media_type === 'video' ? (
                  <video src={msg.media_url} controls style={{ width: '100%', borderRadius: 12 }} />
                ) : (
                  <img src={msg.media_url} alt="" style={{ width: '100%', borderRadius: 12 }} />
                )}
              </div>
            )}
            {msg.text && (
              <div style={{
                padding: '8px 14px', borderRadius: 16, maxWidth: 320,
                fontSize: 13, lineHeight: 1.4,
                background: isUser ? 'var(--color-primary)' : 'var(--bg-elevated)',
                color: isUser ? '#fff' : 'var(--text-primary)',
              }}>
                {msg.text}
              </div>
            )}
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2, paddingLeft: 4, paddingRight: 4 }}>
              {new Date(msg.sent_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        )
      })}
      <div ref={endRef} />
    </div>
  )
}
```

- [ ] **Step 4: Create MessageInput**

```typescript
// src/components/messages/MessageInput.tsx
'use client'

import { useState, useRef } from 'react'
import { Send } from 'lucide-react'

interface Props {
  onSend: (text: string) => void
}

export default function MessageInput({ onSend }: Props) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const handleSend = async () => {
    const trimmed = text.trim()
    if (!trimmed || sending) return
    setSending(true)
    await onSend(trimmed)
    setText('')
    setSending(false)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div style={{
      padding: '12px 16px', borderTop: '1px solid var(--border-primary)',
      display: 'flex', gap: 8, alignItems: 'flex-end',
    }}>
      <textarea
        ref={inputRef}
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Écrire un message..."
        rows={1}
        style={{
          flex: 1, padding: '10px 14px', fontSize: 13,
          background: 'var(--bg-primary)', color: 'var(--text-primary)',
          border: '1px solid var(--border-primary)', borderRadius: 12,
          outline: 'none', resize: 'none', lineHeight: 1.4,
          maxHeight: 120, overflow: 'auto',
        }}
      />
      <button
        onClick={handleSend}
        disabled={!text.trim() || sending}
        style={{
          width: 40, height: 40, borderRadius: '50%',
          background: text.trim() ? 'var(--color-primary)' : 'var(--bg-elevated)',
          border: 'none', cursor: text.trim() ? 'pointer' : 'default',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: sending ? 0.6 : 1,
        }}
      >
        <Send size={16} style={{ color: text.trim() ? '#fff' : 'var(--text-tertiary)' }} />
      </button>
    </div>
  )
}
```

- [ ] **Step 5: Verify build**

Run: `npx next build --no-lint 2>&1 | tail -20`

- [ ] **Step 6: Commit**

```bash
git add src/app/\(dashboard\)/acquisition/messages/page.tsx src/components/messages/
git commit -m "feat: add Messages page with conversation list, thread, and DM sending"
```

---

## Task 19: Build Verification + Final Commit

- [ ] **Step 1: Run full build**

Run: `npx next build 2>&1 | tail -30`
Expected: Build succeeds with no errors.

- [ ] **Step 2: Fix any TypeScript errors**

If there are build errors, fix them.

- [ ] **Step 3: Final commit if fixes were needed**

```bash
git add -A
git commit -m "fix: resolve build errors in Instagram social module"
```

---

## Task 20: Update Project Tracking Files

**Files:**
- Modify: `taches/taches-pierre.md` or create new task file in `taches/`
- Modify: `etat.md`
- Modify: `ameliorations.md`

- [ ] **Step 1: Create task file**

Create `taches/tache-N-instagram-social-module.md` with description, objectives, files created/modified, status = terminé.

- [ ] **Step 2: Update etat.md**

Add the Instagram Social Module as a completed module with date and summary.

- [ ] **Step 3: Update ameliorations.md**

Add any improvements identified during implementation (e.g., scheduled post cron job, webhook for incoming DMs, auto-match conversations to leads).

- [ ] **Step 4: Commit**

```bash
git add taches/ etat.md ameliorations.md
git commit -m "chore: update project tracking files for Instagram social module"
```

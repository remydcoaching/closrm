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

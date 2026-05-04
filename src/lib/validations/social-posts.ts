import { z } from 'zod'

const platforms = ['instagram', 'youtube', 'tiktok'] as const
const mediaTypes = ['IMAGE', 'VIDEO', 'CAROUSEL', 'SHORT', 'LONG_VIDEO'] as const
const statuses = ['draft', 'scheduled', 'publishing', 'published', 'partial', 'failed'] as const
const contentKinds = ['post', 'story', 'reel'] as const
const productionStatuses = ['idea', 'to_film', 'filmed', 'edited', 'ready'] as const

export const publicationInputSchema = z.object({
  platform: z.enum(platforms),
  config: z.record(z.string(), z.unknown()).optional().default({}),
  scheduled_at: z.string().datetime().optional().nullable(),
})

export const createSocialPostSchema = z.object({
  title: z.string().max(300).optional().nullable(),
  caption: z.string().max(10000).optional().nullable(),
  hashtags: z.array(z.string().max(100)).max(60).optional().default([]),
  media_urls: z.array(z.string().url()).max(10).optional().default([]),
  media_type: z.enum(mediaTypes).optional().nullable(),
  thumbnail_url: z.string().url().optional().nullable(),
  status: z.enum(statuses).optional().default('draft'),
  scheduled_at: z.string().datetime().optional().nullable(),
  pillar_id: z.string().uuid().optional().nullable(),
  publications: z.array(publicationInputSchema).default([]),
  content_kind: z.enum(contentKinds).optional().nullable(),
  production_status: z.enum(productionStatuses).optional().nullable(),
  plan_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  hook: z.string().max(500).optional().nullable(),
  script: z.string().max(20000).optional().nullable(),
  references_urls: z.array(z.string().url()).max(20).optional().default([]),
  notes: z.string().max(5000).optional().nullable(),
})

export const updateSocialPostSchema = z.object({
  title: z.string().max(300).optional().nullable(),
  caption: z.string().max(10000).optional().nullable(),
  hashtags: z.array(z.string().max(100)).max(60).optional(),
  media_urls: z.array(z.string().url()).max(10).optional(),
  media_type: z.enum(mediaTypes).optional().nullable(),
  thumbnail_url: z.string().url().optional().nullable(),
  status: z.enum(statuses).optional(),
  scheduled_at: z.string().datetime().optional().nullable(),
  pillar_id: z.string().uuid().optional().nullable(),
  publications: z.array(publicationInputSchema.extend({ id: z.string().uuid().optional() })).optional(),
  content_kind: z.enum(contentKinds).optional().nullable(),
  production_status: z.enum(productionStatuses).optional().nullable(),
  plan_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format YYYY-MM-DD attendu').optional().nullable(),
  hook: z.string().max(500).optional().nullable(),
  script: z.string().max(20000).optional().nullable(),
  references_urls: z.array(z.string().url()).max(20).optional(),
  notes: z.string().max(5000).optional().nullable(),
})

export const socialPostFiltersSchema = z.object({
  status: z.enum(statuses).optional(),
  platform: z.enum(platforms).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  plan_date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  plan_date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  content_kind: z.enum(contentKinds).optional(),
  production_status: z.enum(productionStatuses).optional(),
  pillar_id: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(500).default(25),
})

export type CreateSocialPostInput = z.infer<typeof createSocialPostSchema>
export type UpdateSocialPostInput = z.infer<typeof updateSocialPostSchema>
export type SocialPostFilters = z.infer<typeof socialPostFiltersSchema>

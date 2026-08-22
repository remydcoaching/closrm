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

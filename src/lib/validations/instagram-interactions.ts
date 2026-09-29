import { z } from 'zod'

export const listInteractionsSchema = z.object({
  interaction_type: z.enum(['like', 'comment', 'dm', 'mention']).optional(),
  source_provider: z.enum(['apify', 'hiker']).optional(),
  lead_id: z.string().uuid().optional(),
  source_post_id: z.string().optional(),
  date_from: z.string().datetime().optional(),
  date_to: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(50),
})

export type ListInteractionsParams = z.infer<typeof listInteractionsSchema>

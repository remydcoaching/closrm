import { z } from 'zod'

export const contactFiltersSchema = z.object({
  search: z.string().optional(),
  status: z.string().optional(),
  source: z.string().optional(),
  tags: z.string().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  reached: z.enum(['true', 'false']).optional(),
  group_by: z.enum(['status', 'source']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(25),
})

export type ContactFiltersSchema = z.infer<typeof contactFiltersSchema>

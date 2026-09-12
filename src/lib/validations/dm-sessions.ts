import { z } from 'zod'

export const createDmSessionSchema = z.object({
  target_count: z.number().int().min(1).max(200),
  stale_threshold_days: z.number().int().min(1).max(365).default(30),
})

export const updateDmSessionItemSchema = z.object({
  outcome: z.enum(['relaunched', 'archived', 'skipped', 'replied']),
  note: z.string().max(2000).optional(),
  delay_days: z.number().int().min(1).max(365).optional(),
})

export type CreateDmSessionData = z.infer<typeof createDmSessionSchema>
export type UpdateDmSessionItemData = z.infer<typeof updateDmSessionItemSchema>

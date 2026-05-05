import { z } from 'zod'

export const createPricingTierSchema = z.object({
  monteur_id: z.string().uuid(),
  name: z.string().min(1).max(100),
  price_cents: z.number().int().min(0).max(1_000_000), // up to 10000€
})

export const updatePricingTierSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  price_cents: z.number().int().min(0).max(1_000_000).optional(),
  archived_at: z.string().datetime().nullable().optional(),
})

export type CreatePricingTierInput = z.infer<typeof createPricingTierSchema>
export type UpdatePricingTierInput = z.infer<typeof updatePricingTierSchema>

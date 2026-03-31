import { z } from 'zod'

export const connectIntegrationSchema = z.object({
  type: z.enum(['google_calendar', 'meta', 'whatsapp', 'stripe', 'telegram']),
  credentials: z.record(z.string(), z.unknown()),
})

export const updateIntegrationSchema = z.object({
  is_active: z.boolean().optional(),
  credentials: z.record(z.string(), z.unknown()).optional(),
})

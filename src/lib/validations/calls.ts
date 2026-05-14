import { z } from 'zod'

const handoffBriefSchema = z.object({
  objective: z.string().max(500).optional(),
  budget: z.string().max(200).optional(),
  objections: z.string().max(1000).optional(),
  availability: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
}).optional()

export const createCallSchema = z.object({
  lead_id: z.string().uuid('ID lead invalide.'),
  type: z.enum(['setting', 'closing']),
  scheduled_at: z.string().min(1, 'La date est requise.'),
  notes: z.string().max(5000).optional().default(''),
  closer_id: z.string().uuid().optional(),
  handoff_brief: handoffBriefSchema,
})

export const updateCallSchema = z.object({
  outcome: z.enum(['pending', 'done', 'cancelled', 'no_show']).optional(),
  notes: z.string().max(5000).optional(),
  reached: z.boolean().optional(),
  duration_seconds: z.number().int().min(0).optional(),
  scheduled_at: z.string().optional(),
  closer_id: z.string().uuid().optional().nullable(),
  assigned_to: z.string().uuid().optional().nullable(),
})

export const callFiltersSchema = z.object({
  type: z.enum(['setting', 'closing']).optional(),
  outcome: z.string().optional(),
  scheduled_after: z.string().optional(),
  scheduled_before: z.string().optional(),
  lead_id: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(250).default(25),
  sort: z.enum(['scheduled_at', 'created_at']).default('scheduled_at'),
  order: z.enum(['asc', 'desc']).default('asc'),
})

export type CreateCallData = z.infer<typeof createCallSchema>
export type UpdateCallData = z.infer<typeof updateCallSchema>
export type CallFilters = z.infer<typeof callFiltersSchema>

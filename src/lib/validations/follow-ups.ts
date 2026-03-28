import { z } from 'zod'

export const createFollowUpSchema = z.object({
  lead_id: z.string().uuid('ID lead invalide.'),
  reason: z.string().min(1, 'La raison est requise.').max(500),
  scheduled_at: z.string().min(1, 'La date est requise.'),
  channel: z.enum(['whatsapp', 'email', 'manuel']).default('manuel'),
  notes: z.string().max(5000).optional().default(''),
})

export const updateFollowUpSchema = z.object({
  reason: z.string().min(1).max(500).optional(),
  scheduled_at: z.string().optional(),
  channel: z.enum(['whatsapp', 'email', 'manuel']).optional(),
  status: z.enum(['en_attente', 'fait', 'annule']).optional(),
  notes: z.string().max(5000).optional(),
})

export const followUpFiltersSchema = z.object({
  status: z.string().optional(),
  channel: z.string().optional(),
  lead_id: z.string().optional(),
  search: z.string().optional(),
  scheduled_after: z.string().optional(),
  scheduled_before: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(25),
  sort: z.enum(['scheduled_at', 'created_at']).default('scheduled_at'),
  order: z.enum(['asc', 'desc']).default('asc'),
})

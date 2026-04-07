import { z } from 'zod'

export const createLeadSchema = z.object({
  first_name: z.string().min(1, 'Le prénom est requis.').max(100),
  last_name: z.string().max(100).optional().default(''),
  phone: z.string().max(30).optional().default(''),
  email: z.string().email("Format d'email invalide.").optional().or(z.literal('')),
  source: z.enum(['facebook_ads', 'instagram_ads', 'follow_ads', 'formulaire', 'manuel', 'funnel']).default('manuel'),
  instagram_handle: z.string().regex(/^[a-zA-Z0-9._]{1,30}$/, 'Handle Instagram invalide').optional().or(z.literal('')).default(''),
  tags: z.array(z.string()).optional().default([]),
  notes: z.string().max(5000).optional().default(''),
})

export const updateLeadSchema = z.object({
  first_name: z.string().min(1).max(100).optional(),
  last_name: z.string().max(100).optional(),
  phone: z.string().max(30).optional(),
  email: z.string().email().optional().or(z.literal('')),
  source: z.enum(['facebook_ads', 'instagram_ads', 'follow_ads', 'formulaire', 'manuel', 'funnel']).optional(),
  status: z.enum(['nouveau', 'setting_planifie', 'no_show_setting', 'closing_planifie', 'no_show_closing', 'clos', 'dead']).optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().max(5000).optional(),
  reached: z.boolean().optional(),
  call_attempts: z.number().int().min(0).optional(),
})

export const leadFiltersSchema = z.object({
  status: z.string().optional(),
  source: z.string().optional(),
  search: z.string().optional(),
  tags: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(25),
  sort: z.enum(['created_at', 'updated_at', 'first_name', 'last_name', 'status']).default('created_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
})

export type CreateLeadData = z.infer<typeof createLeadSchema>
export type UpdateLeadData = z.infer<typeof updateLeadSchema>
export type LeadFilters = z.infer<typeof leadFiltersSchema>

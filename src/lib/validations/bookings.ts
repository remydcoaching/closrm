import { z } from 'zod'

/** Règle de récurrence simplifiée : `count` occurrences (incluant l'original)
 *  espacées selon `frequency`. On reste volontairement sur un sous-ensemble
 *  RFC 5545 — pas de RRULE complète, juste daily/weekly/monthly + count. */
export const recurrenceSchema = z.object({
  frequency: z.enum(['daily', 'weekly', 'monthly']),
  count: z.number().int().min(2).max(52),
})

export const createBookingSchema = z.object({
  calendar_id: z.string().uuid('ID calendrier invalide.').optional().nullable(),
  lead_id: z.string().uuid('ID lead invalide.').optional().nullable(),
  location_id: z.string().uuid('ID lieu invalide.').optional().nullable(),
  title: z.string().min(1, 'Le titre est requis.').max(200),
  scheduled_at: z.string().min(1, 'La date est requise.'),
  duration_minutes: z.number().int().min(5).max(480),
  notes: z.string().max(5000).optional().nullable(),
  is_personal: z.boolean().default(false),
  recurrence: recurrenceSchema.optional().nullable(),
})

export const updateBookingSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  scheduled_at: z.string().optional(),
  duration_minutes: z.number().int().min(5).max(480).optional(),
  status: z.enum(['confirmed', 'cancelled', 'no_show', 'completed']).optional(),
  notes: z.string().max(5000).optional().nullable(),
})

export const bookingFiltersSchema = z.object({
  date_start: z.string().optional(),
  date_end: z.string().optional(),
  calendar_id: z.string().uuid().optional(),
  status: z.enum(['confirmed', 'cancelled', 'no_show', 'completed']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(50),
})

export const publicBookingSchema = z.object({
  scheduled_at: z.string().min(1, 'La date est requise.'),
  form_data: z.record(z.string(), z.string()),
  location_id: z.string().uuid().optional().nullable(),
  reschedule_from: z.string().uuid().optional().nullable(),
  reschedule_token: z.string().uuid().optional().nullable(),
})

export type CreateBookingData = z.infer<typeof createBookingSchema>
export type UpdateBookingData = z.infer<typeof updateBookingSchema>
export type PublicBookingData = z.infer<typeof publicBookingSchema>

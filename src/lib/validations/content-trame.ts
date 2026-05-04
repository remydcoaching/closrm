import { z } from 'zod'

const weekdays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

const gridSchema = z.record(
  z.enum(weekdays),
  z.array(z.string().uuid().nullable())
)

export const upsertTrameSchema = z.object({
  stories_grid: gridSchema,
  posts_grid: gridSchema,
  stories_per_day: z.number().int().min(0).max(10),
  posts_per_day: z.number().int().min(0).max(5),
})

export const generateMonthSchema = z.object({
  year: z.number().int().min(2025).max(2050).optional(),
  month: z.number().int().min(1).max(12).optional(),
  kinds: z.array(z.enum(['post', 'story'])).optional().default(['post', 'story']),
  // window: 'month' = tout le mois ; 'week' = 7 jours à partir de start_date ; 'range' = entre start_date et end_date
  window: z.enum(['month', 'week', 'range']).optional().default('month'),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

export type UpsertTrameInput = z.infer<typeof upsertTrameSchema>
export type GenerateMonthInput = z.infer<typeof generateMonthSchema>

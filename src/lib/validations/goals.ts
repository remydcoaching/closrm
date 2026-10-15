import { z } from 'zod'

export const GOAL_HORIZONS = ['day', 'week', 'month', 'quarter', 'year', 'inbox'] as const
export const GOAL_COLORS = ['yellow', 'pink', 'green', 'blue', 'purple', 'orange'] as const

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date attendue au format AAAA-MM-JJ')
  .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().startsWith(s), 'Date invalide')

const horizon = z.enum(GOAL_HORIZONS)

/** inbox <=> no date. Every other horizon needs a period_start. */
function horizonDateConsistent(v: { horizon?: string; period_start?: string | null }) {
  if (v.horizon === undefined) return true
  if (v.horizon === 'inbox') return v.period_start === null || v.period_start === undefined
  return typeof v.period_start === 'string'
}
const horizonDateMessage = {
  message: "Un objectif daté doit avoir une période (period_start) ; un objectif de l'Inbox n'en a pas",
  path: ['period_start'],
}

export const goalsQuerySchema = z
  .object({
    horizon: horizon.optional(),
    from: isoDate.optional(),
    to: isoDate.optional(),
  })
  .refine((q) => !q.from || !q.to || q.from <= q.to, { message: '`from` doit précéder `to`', path: ['from'] })

export const createGoalSchema = z
  .object({
    title: z.string().trim().min(1, 'Titre requis').max(500),
    description: z.string().max(20000).nullable().optional(),
    horizon,
    period_start: isoDate.nullable().optional(),
    parent_id: z.string().uuid().nullable().optional(),
    position: z.number().finite().optional(),
    color: z.enum(GOAL_COLORS).nullable().optional(),
  })
  .refine(horizonDateConsistent, horizonDateMessage)

export const updateGoalSchema = z
  .object({
    title: z.string().trim().min(1, 'Titre requis').max(500).optional(),
    description: z.string().max(20000).nullable().optional(),
    done: z.boolean().optional(),
    horizon: horizon.optional(),
    period_start: isoDate.nullable().optional(),
    position: z.number().finite().optional(),
    parent_id: z.string().uuid().nullable().optional(),
    color: z.enum(GOAL_COLORS).nullable().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'Aucun champ à modifier' })
  // Changing horizon requires sending period_start along with it (except to inbox).
  .refine(
    (v) => v.horizon === undefined || v.horizon === 'inbox' || v.period_start !== undefined,
    { message: 'period_start requis quand on change d’horizon', path: ['period_start'] },
  )
  .refine((v) => !(v.horizon === 'inbox' && typeof v.period_start === 'string'), horizonDateMessage)

export type GoalsQuery = z.infer<typeof goalsQuerySchema>
export type CreateGoalInput = z.infer<typeof createGoalSchema>
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>

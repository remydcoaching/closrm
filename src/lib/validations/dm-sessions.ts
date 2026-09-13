import { z } from 'zod'

export const createDmSessionSchema = z.object({
  target_count: z.number().int().min(1).max(200),
  stale_threshold_days: z.number().int().min(1).max(365).default(30),
  // relance_du_jour est toujours incluse côté serveur, quel que soit ce
  // qui est envoyé ici — ces 3 flags ne pilotent que les catégories
  // optionnelles (cf. src/lib/dm-sessions/priority.ts::SessionCategoryFilter).
  relance_en_retard: z.boolean().default(true),
  premier_contact: z.boolean().default(true),
  jamais_recontacte: z.boolean().default(true),
})

export const updateDmSessionItemSchema = z.object({
  outcome: z.enum(['relaunched', 'archived', 'skipped', 'replied']),
  note: z.string().max(2000).optional(),
  delay_days: z.number().int().min(1).max(365).optional(),
})

// Le setter peut arrêter une session en cours (erreur, test, plus le temps) —
// seul le statut 'abandoned' est exposé ici : 'active' ne doit jamais être
// remis manuellement, et 'completed' est déjà positionné automatiquement
// quand le dernier item est traité.
export const updateDmSessionSchema = z.object({
  status: z.literal('abandoned'),
})

export type CreateDmSessionData = z.infer<typeof createDmSessionSchema>
export type UpdateDmSessionItemData = z.infer<typeof updateDmSessionItemSchema>
export type UpdateDmSessionData = z.infer<typeof updateDmSessionSchema>

import { z } from 'zod'

export const createSettingProcessSchema = z.object({
  name: z.string().min(1, 'Le nom est requis.').max(200),
  description: z.string().max(2000).optional().default(''),
  status: z.enum(['active', 'inactive']).default('active'),
})

export const updateSettingProcessSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  status: z.enum(['active', 'inactive']).optional(),
})

export const createSettingProcessStepSchema = z.object({
  title: z.string().min(1, 'Le titre est requis.').max(200),
  step_type: z.enum(['message', 'relance']).default('message'),
  content: z.string().min(1, 'Le contenu est requis.').max(5000),
  delay_days: z.number().int().min(1).max(365).optional(),
})

export const updateSettingProcessStepSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  step_type: z.enum(['message', 'relance']).optional(),
  content: z.string().min(1).max(5000).optional(),
  delay_days: z.number().int().min(1).max(365).nullable().optional(),
  next_step_id: z.string().uuid().nullable().optional(),
  position: z.number().int().min(0).optional(),
})

export const createSettingProcessStepTransitionSchema = z.object({
  outcome_label: z.string().min(1, "Le libellé de sortie est requis.").max(100),
  target_step_id: z.string().uuid(),
})

export type CreateSettingProcessData = z.infer<typeof createSettingProcessSchema>
export type UpdateSettingProcessData = z.infer<typeof updateSettingProcessSchema>
export type CreateSettingProcessStepData = z.infer<typeof createSettingProcessStepSchema>
export type UpdateSettingProcessStepData = z.infer<typeof updateSettingProcessStepSchema>
export type CreateSettingProcessStepTransitionData = z.infer<typeof createSettingProcessStepTransitionSchema>

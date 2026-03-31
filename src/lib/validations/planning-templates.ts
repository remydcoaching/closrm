import { z } from 'zod'

const templateBlockSchema = z.object({
  day: z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']),
  start: z.string().regex(/^\d{2}:\d{2}$/, 'Format HH:MM attendu.'),
  end: z.string().regex(/^\d{2}:\d{2}$/, 'Format HH:MM attendu.'),
  title: z.string().min(1, 'Le titre est requis.').max(100),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#3b82f6'),
})

export const createPlanningTemplateSchema = z.object({
  name: z.string().min(1, 'Le nom est requis.').max(100),
  description: z.string().max(500).optional().nullable(),
  blocks: z.array(templateBlockSchema).default([]),
})

export const updatePlanningTemplateSchema = createPlanningTemplateSchema.partial()

export const importTemplateSchema = z.object({
  week_start: z.string().min(1, 'La date de début de semaine est requise.'),
})

import { z } from 'zod'

export const updateProfileSchema = z.object({
  full_name: z.string().min(2, 'Le nom doit faire au moins 2 caractères.').max(100),
})

export const updateWorkspaceSchema = z.object({
  name: z.string().min(2, 'Le nom doit faire au moins 2 caractères.').max(100).optional(),
  timezone: z.string().min(1, 'Le fuseau horaire est requis.').optional(),
  accent_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Couleur hex invalide.').optional(),
})

export const deleteAccountSchema = z.object({
  confirmation: z.string().min(1, 'La confirmation est requise.'),
})

export type UpdateProfileData = z.infer<typeof updateProfileSchema>
export type UpdateWorkspaceData = z.infer<typeof updateWorkspaceSchema>

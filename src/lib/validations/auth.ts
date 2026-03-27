import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string()
    .min(1, "L'email est requis.")
    .email("Format d'email invalide."),
  password: z.string()
    .min(1, 'Le mot de passe est requis.'),
})

export const registerSchema = z.object({
  fullName: z.string()
    .min(2, 'Le nom doit contenir au moins 2 caractères.')
    .max(100, 'Le nom ne peut pas dépasser 100 caractères.'),
  email: z.string()
    .min(1, "L'email est requis.")
    .email("Format d'email invalide."),
  password: z.string()
    .min(8, 'Le mot de passe doit contenir au moins 8 caractères.')
    .max(72, 'Le mot de passe ne peut pas dépasser 72 caractères.'),
})

export const resetPasswordSchema = z.object({
  email: z.string()
    .min(1, "L'email est requis.")
    .email("Format d'email invalide."),
})

export const updatePasswordSchema = z.object({
  password: z.string()
    .min(8, 'Le mot de passe doit contenir au moins 8 caractères.')
    .max(72, 'Le mot de passe ne peut pas dépasser 72 caractères.'),
  confirmPassword: z.string()
    .min(1, 'La confirmation est requise.'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Les mots de passe ne correspondent pas.',
  path: ['confirmPassword'],
})

export type LoginFormData = z.infer<typeof loginSchema>
export type RegisterFormData = z.infer<typeof registerSchema>
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>
export type UpdatePasswordFormData = z.infer<typeof updatePasswordSchema>

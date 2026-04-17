import { z } from 'zod'

const PLATFORMS = ['youtube','tiktok','instagram','podcast','blog','pdf','other'] as const

export const createLeadMagnetSchema = z.object({
  title: z.string().min(1).max(200),
  url: z.string().url().regex(/^https?:\/\//, 'URL doit commencer par http(s)://'),
  platform: z.enum(PLATFORMS).default('other'),
})

export const updateLeadMagnetSchema = createLeadMagnetSchema.partial()

export const trackForLeadSchema = z.object({
  lead_id: z.string().uuid(),
})

export type CreateLeadMagnetInput = z.infer<typeof createLeadMagnetSchema>
export type UpdateLeadMagnetInput = z.infer<typeof updateLeadMagnetSchema>

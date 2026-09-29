import { z } from 'zod'

export const startDiscoverySchema = z.object({
  instagramUsername: z
    .string()
    .trim()
    .min(1)
    .max(30)
    .regex(/^[a-zA-Z0-9._]+$/, 'Invalid Instagram username format'),
  options: z
    .object({
      maxMediaPages: z.number().int().positive().max(500).optional(),
      maxClipsPages: z.number().int().positive().max(500).optional(),
      maxFollowerPages: z.number().int().positive().max(1000).optional(),
      maxContentsForInteractions: z.number().int().positive().max(500).optional(),
    })
    .optional(),
})

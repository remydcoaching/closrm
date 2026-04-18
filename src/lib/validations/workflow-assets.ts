import { z } from 'zod'

export const createLinkAssetSchema = z.object({
  type: z.literal('link'),
  name: z.string().min(1, 'Le nom est requis.').max(200),
  url: z.string().url('URL invalide.'),
})

export const createUploadAssetSchema = z.object({
  type: z.enum(['audio', 'file']),
  name: z.string().min(1, 'Le nom est requis.').max(200),
  url: z.string().url('URL invalide.'),
  storage_path: z.string().min(1),
  mime_type: z.string().max(200).optional(),
  file_size: z.number().int().min(0).optional(),
})

export const createAssetSchema = z.discriminatedUnion('type', [
  createLinkAssetSchema,
  z.object({
    type: z.literal('audio'),
    name: z.string().min(1).max(200),
    url: z.string().url(),
    storage_path: z.string().min(1),
    mime_type: z.string().max(200).optional(),
    file_size: z.number().int().min(0).optional(),
  }),
  z.object({
    type: z.literal('file'),
    name: z.string().min(1).max(200),
    url: z.string().url(),
    storage_path: z.string().min(1),
    mime_type: z.string().max(200).optional(),
    file_size: z.number().int().min(0).optional(),
  }),
])

export type CreateAssetData = z.infer<typeof createAssetSchema>

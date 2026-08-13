import { z } from 'zod'

const INSTAGRAM_HANDLE_REGEX = /^[a-zA-Z0-9._]{1,30}$/
const DATA_URL_REGEX = /^data:image\/(jpeg|png|webp);base64,/

export const extractImagesSchema = z.object({
  images: z
    .array(z.string().regex(DATA_URL_REGEX, 'Format image invalide (attendu: data URL base64)'))
    .min(1, 'Au moins une image requise')
    .max(10, 'Maximum 10 images par import'),
})

export const confirmImportSchema = z.object({
  handles: z
    .array(z.string().regex(INSTAGRAM_HANDLE_REGEX, 'Handle Instagram invalide'))
    .min(1, 'Au moins un handle requis'),
  create_follow_up: z.boolean(),
  follow_up_delay_days: z.number().int().min(1).max(90).optional().default(7),
  follow_up_reason: z.string().max(500).optional().default('Nouveau follower — premier contact'),
})

export type ExtractImagesInput = z.infer<typeof extractImagesSchema>
export type ConfirmImportInput = z.infer<typeof confirmImportSchema>

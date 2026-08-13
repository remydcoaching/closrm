import { z } from 'zod'

const INSTAGRAM_HANDLE_REGEX = /^[a-zA-Z0-9._]{1,30}$/

export const extractTextSchema = z.object({
  texts: z
    .array(z.string().max(20000))
    .min(1, 'Au moins un texte requis')
    .max(10, 'Maximum 10 captures par import'),
})

export const confirmImportSchema = z.object({
  handles: z
    .array(z.string().regex(INSTAGRAM_HANDLE_REGEX, 'Handle Instagram invalide'))
    .min(1, 'Au moins un handle requis'),
  create_follow_up: z.boolean(),
  follow_up_delay_days: z.number().int().min(1).max(90).optional().default(7),
  follow_up_reason: z.string().max(500).optional().default('Nouveau follower — premier contact'),
})

export type ExtractTextInput = z.infer<typeof extractTextSchema>
export type ConfirmImportInput = z.infer<typeof confirmImportSchema>

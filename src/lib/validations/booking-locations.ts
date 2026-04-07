import { z } from 'zod'

export const createBookingLocationSchema = z.object({
  name: z.string().min(1, 'Le nom est requis.').max(100),
  address: z.string().max(300).optional().nullable(),
  location_type: z.enum(['in_person', 'online']).default('in_person'),
  is_active: z.boolean().default(true),
})

export const updateBookingLocationSchema = createBookingLocationSchema.partial()

export type CreateBookingLocationData = z.infer<typeof createBookingLocationSchema>
export type UpdateBookingLocationData = z.infer<typeof updateBookingLocationSchema>

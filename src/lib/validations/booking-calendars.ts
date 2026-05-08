import { z } from 'zod'

const timeSlotSchema = z.object({
  start: z.string().regex(/^\d{2}:\d{2}$/, 'Format HH:MM attendu.'),
  end: z.string().regex(/^\d{2}:\d{2}$/, 'Format HH:MM attendu.'),
})

const formFieldSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(['text', 'tel', 'email', 'textarea', 'select']),
  required: z.boolean(),
  options: z.array(z.string()).optional(),
})

const dayAvailabilitySchema = z.array(timeSlotSchema)

const weekAvailabilitySchema = z.object({
  monday: dayAvailabilitySchema.default([]),
  tuesday: dayAvailabilitySchema.default([]),
  wednesday: dayAvailabilitySchema.default([]),
  thursday: dayAvailabilitySchema.default([]),
  friday: dayAvailabilitySchema.default([]),
  saturday: dayAvailabilitySchema.default([]),
  sunday: dayAvailabilitySchema.default([]),
})

const calendarReminderSchema = z.object({
  id: z.string().uuid(),
  delay_value: z.number().int().min(0).max(365),
  delay_unit: z.enum(['hours', 'days']),
  at_time: z.string().regex(/^\d{2}:\d{2}$/).nullable().default(null),
  channel: z.enum(['email', 'whatsapp', 'instagram_dm']),
  message: z.string().min(1).max(1000),
})

export const createBookingCalendarSchema = z.object({
  name: z.string().min(1, 'Le nom est requis.').max(100),
  slug: z.string().min(1, 'Le slug est requis.').max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug invalide (lettres minuscules, chiffres, tirets).'),
  description: z.string().max(500).optional().nullable(),
  duration_minutes: z.number().int().min(5).max(480).default(60),
  location: z.string().max(200).optional().nullable(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Couleur HEX invalide.').default('#3b82f6'),
  form_fields: z.array(formFieldSchema).default([
    { key: 'first_name', label: 'Prénom', type: 'text', required: true },
    { key: 'last_name', label: 'Nom', type: 'text', required: true },
    { key: 'phone', label: 'Téléphone', type: 'tel', required: true },
    { key: 'email', label: 'Email', type: 'email', required: true },
  ]),
  availability: weekAvailabilitySchema.default({
    monday: [], tuesday: [], wednesday: [], thursday: [],
    friday: [], saturday: [], sunday: [],
  }),
  buffer_minutes: z.number().int().min(0).max(120).default(0),
  max_advance_days: z.number().int().min(1).max(365).nullable().optional(),
  email_template: z.enum(['premium', 'minimal', 'plain']).default('premium'),
  email_accent_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Couleur hex invalide').default('#E53E3E'),
  location_ids: z.array(z.string().uuid()).default([]),
  purpose: z.enum(['setting', 'closing', 'other']).default('other'),
  reminders: z.array(calendarReminderSchema).max(10).default([]),
  is_active: z.boolean().default(true),
  require_confirmation: z.boolean().default(false),
})

export const updateBookingCalendarSchema = createBookingCalendarSchema.partial()

export type CreateBookingCalendarData = z.infer<typeof createBookingCalendarSchema>
export type UpdateBookingCalendarData = z.infer<typeof updateBookingCalendarSchema>

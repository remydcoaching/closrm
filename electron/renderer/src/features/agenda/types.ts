// Mirror of the web types used by the Agenda group (src/types/index.ts +
// src/types/agenda.ts). Same field names as the API responses of
// /api/bookings, /api/calls, /api/booking-calendars, /api/booking-locations,
// /api/google-calendar-accounts and /api/planning-templates.

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'no_show' | 'completed'
export type BookingSource = 'booking_page' | 'manual' | 'google_sync'

export interface TimeSlot {
  start: string // "09:00"
  end: string // "12:00"
}

export interface WeekAvailability {
  monday: TimeSlot[]
  tuesday: TimeSlot[]
  wednesday: TimeSlot[]
  thursday: TimeSlot[]
  friday: TimeSlot[]
  saturday: TimeSlot[]
  sunday: TimeSlot[]
}

export type DayOfWeek = keyof WeekAvailability

export type FormFieldType = 'text' | 'tel' | 'email' | 'textarea' | 'select'

export interface FormField {
  key: string
  label: string
  type: FormFieldType
  required: boolean
  options?: string[]
}

export type CalendarPurpose = 'setting' | 'closing' | 'other'
export type ReminderChannel = 'email' | 'whatsapp' | 'instagram_dm'
export type EmailTemplateChoice = 'premium' | 'minimal' | 'plain'

export interface CalendarReminder {
  id: string
  delay_value: number
  delay_unit: 'hours' | 'days'
  at_time: string | null
  channel: ReminderChannel
  message: string
}

export interface BookingCalendar {
  id: string
  workspace_id: string
  name: string
  slug: string
  description: string | null
  duration_minutes: number
  location_ids: string[]
  color: string
  form_fields: FormField[]
  availability: WeekAvailability
  buffer_minutes: number
  max_advance_days: number | null
  email_template: EmailTemplateChoice
  email_accent_color: string
  background_theme: 'dark' | 'light'
  purpose: CalendarPurpose
  reminders: CalendarReminder[]
  is_active: boolean
  require_confirmation?: boolean
  created_at: string
  updated_at: string
}

export interface BookingLocation {
  id: string
  workspace_id: string
  name: string
  address: string | null
  location_type: 'in_person' | 'online'
  is_active: boolean
  created_at: string
}

export interface GoogleCalendarAccount {
  id: string
  email: string
  label: string | null
  color: string
  is_active: boolean
  connected_at: string
  created_at: string
}

export interface LeadRef {
  id: string
  first_name: string
  last_name: string
  phone: string | null
  email: string | null
}

export interface Booking {
  id: string
  workspace_id: string
  calendar_id: string | null
  lead_id: string | null
  call_id: string | null
  title: string
  scheduled_at: string
  duration_minutes: number
  status: BookingStatus
  source: BookingSource
  form_data: Record<string, string> | null
  notes: string | null
  google_event_id: string | null
  location_id: string | null
  meet_url: string | null
  is_personal: boolean
  recurrence_group_id: string | null
  color: string | null
  blocks_availability: boolean
  google_account_id: string | null
  created_at: string
}

export interface BookingWithCalendar extends Booking {
  booking_calendar: { name: string; color: string } | null
  lead: LeadRef | null
  location: Pick<BookingLocation, 'id' | 'name' | 'address' | 'location_type'> | null
}

export type CallType = 'setting' | 'closing'
export type CallOutcome = 'pending' | 'done' | 'cancelled' | 'no_show'

export interface AgendaCall {
  id: string
  lead_id: string
  type: CallType
  scheduled_at: string
  outcome: CallOutcome
  notes: string | null
  duration_seconds: number | null
  lead?: LeadRef | null
}

interface AgendaEventBase {
  /** Prefixed by kind ("booking-…" / "call-…") so ids never collide. */
  id: string
  start: string
  durationMinutes: number
  color: string
  title: string
  subtitle: string | null
  lead: LeadRef | null
}

export interface AgendaBookingEvent extends AgendaEventBase {
  kind: 'booking'
  booking: BookingWithCalendar
}

export interface AgendaCallEvent extends AgendaEventBase {
  kind: 'call'
  call: AgendaCall
}

export type AgendaEvent = AgendaBookingEvent | AgendaCallEvent

export type AgendaViewMode = 'day' | 'week' | 'month' | 'list'

export interface TemplateBlock {
  day: DayOfWeek
  start: string
  end: string
  title: string
  color: string
}

export interface PlanningTemplate {
  id: string
  name: string
  description: string | null
  blocks: TemplateBlock[]
}

export interface BookingPatch {
  title?: string
  scheduled_at?: string
  duration_minutes?: number
  status?: BookingStatus
  notes?: string | null
  notify_lead?: boolean
  color?: string | null
  blocks_availability?: boolean
}

export type DeleteScope = 'this' | 'future' | 'all'

export interface ListResponse<T> {
  data: T[]
}

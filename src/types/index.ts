// ─── Workspace & User ───────────────────────────────────────────────────────

export interface Workspace {
  id: string
  name: string
  owner_id: string
  timezone: string
  accent_color: string
  logo_url: string | null
  created_at: string
}

export interface User {
  id: string
  workspace_id: string
  email: string
  role: 'coach' | 'setter' | 'closer'
  full_name: string
  avatar_url: string | null
  created_at: string
}

// ─── Lead ───────────────────────────────────────────────────────────────────

export type LeadStatus =
  | 'nouveau'
  | 'setting_planifie'
  | 'no_show_setting'
  | 'closing_planifie'
  | 'no_show_closing'
  | 'clos'
  | 'dead'

export type LeadSource =
  | 'facebook_ads'
  | 'instagram_ads'
  | 'formulaire'
  | 'manuel'

export interface Lead {
  id: string
  workspace_id: string
  first_name: string
  last_name: string
  phone: string
  email: string | null
  status: LeadStatus
  source: LeadSource
  tags: string[]
  call_attempts: number
  reached: boolean
  notes: string | null
  meta_campaign_id: string | null
  meta_adset_id: string | null
  meta_ad_id: string | null
  created_at: string
  updated_at: string
}

// ─── Call ────────────────────────────────────────────────────────────────────

export type CallType = 'setting' | 'closing'
export type CallOutcome = 'pending' | 'done' | 'cancelled' | 'no_show'

export interface Call {
  id: string
  workspace_id: string
  lead_id: string
  type: CallType
  scheduled_at: string
  outcome: CallOutcome
  notes: string | null
  attempt_number: number
  reached: boolean
  duration_seconds: number | null
  closer_id: string | null
  created_at: string
}

// ─── Follow-up ───────────────────────────────────────────────────────────────

export type FollowUpChannel = 'whatsapp' | 'email' | 'manuel'
export type FollowUpStatus = 'en_attente' | 'fait' | 'annule'

export interface FollowUp {
  id: string
  workspace_id: string
  lead_id: string
  reason: string
  scheduled_at: string
  channel: FollowUpChannel
  status: FollowUpStatus
  notes: string | null
  created_at: string
}

// ─── Workflow (replaces Automation) ──────────────────────────────────────────

export type WorkflowStatus = 'brouillon' | 'actif' | 'inactif'

export type WorkflowTriggerType =
  // LEADS
  | 'new_lead'
  | 'lead_status_changed'
  | 'tag_added'
  | 'tag_removed'
  | 'deal_won'
  // CALLS
  | 'call_scheduled'
  | 'call_in_x_hours'
  | 'call_no_show'
  | 'call_outcome_logged'
  // FOLLOW-UPS
  | 'followup_pending_x_days'
  // INSTAGRAM (future T-021)
  | 'new_follower'
  | 'dm_keyword'
  | 'comment_keyword'
  // BOOKING (future T-022)
  | 'booking_created'
  | 'booking_cancelled'

export type WorkflowActionType =
  | 'send_email'
  | 'send_whatsapp'
  | 'send_dm_instagram'
  | 'create_followup'
  | 'change_lead_status'
  | 'add_tag'
  | 'remove_tag'
  | 'send_notification'
  | 'facebook_conversions_api'

export type WorkflowStepType = 'action' | 'delay' | 'condition'

export type DelayUnit = 'minutes' | 'hours' | 'days'

export type ConditionOperator = 'equals' | 'not_equals' | 'contains' | 'not_contains'

export interface Workflow {
  id: string
  workspace_id: string
  name: string
  description: string | null
  trigger_type: WorkflowTriggerType
  trigger_config: Record<string, unknown>
  status: WorkflowStatus
  execution_count: number
  last_run_at: string | null
  template_id: string | null
  created_at: string
  updated_at: string
}

export interface WorkflowStep {
  id: string
  workflow_id: string
  step_order: number
  step_type: WorkflowStepType
  action_type: WorkflowActionType | null
  action_config: Record<string, unknown>
  delay_value: number | null
  delay_unit: DelayUnit | null
  condition_field: string | null
  condition_operator: ConditionOperator | null
  condition_value: string | null
  on_true_step: number | null
  on_false_step: number | null
  created_at: string
}

export interface WorkflowExecution {
  id: string
  workflow_id: string
  workspace_id: string
  lead_id: string | null
  trigger_data: Record<string, unknown>
  status: 'running' | 'completed' | 'failed' | 'waiting'
  current_step: number
  error_message: string | null
  started_at: string
  completed_at: string | null
  resume_at: string | null
}

export interface WorkflowExecutionLog {
  id: string
  execution_id: string
  step_id: string | null
  step_order: number
  step_type: string
  action_type: string | null
  status: 'success' | 'failed' | 'skipped'
  result: Record<string, unknown>
  error_message: string | null
  executed_at: string
}

// ─── Integration ─────────────────────────────────────────────────────────────

export type IntegrationType = 'google_calendar' | 'meta' | 'whatsapp' | 'stripe' | 'telegram'

export interface Integration {
  id: string
  workspace_id: string
  type: IntegrationType
  connected_at: string | null
  is_active: boolean
}

// ── Booking Calendar ─────────────────────────────────────────────────────────

export type FormFieldType = 'text' | 'tel' | 'email' | 'textarea' | 'select'

export interface FormField {
  key: string
  label: string
  type: FormFieldType
  required: boolean
  options?: string[]
}

export interface TimeSlot {
  start: string  // "09:00"
  end: string    // "12:00"
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

export interface BookingCalendar {
  id: string
  workspace_id: string
  name: string
  slug: string
  description: string | null
  duration_minutes: number
  location: string | null
  color: string
  form_fields: FormField[]
  availability: WeekAvailability
  buffer_minutes: number
  is_active: boolean
  created_at: string
  updated_at: string
}

// ── Booking ──────────────────────────────────────────────────────────────────

export type BookingStatus = 'confirmed' | 'cancelled' | 'no_show' | 'completed'
export type BookingSource = 'booking_page' | 'manual' | 'google_sync'

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
  form_data: Record<string, string>
  notes: string | null
  google_event_id: string | null
  is_personal: boolean
  created_at: string
}

export interface BookingWithCalendar extends Booking {
  booking_calendar: Pick<BookingCalendar, 'name' | 'color' | 'location'> | null
  lead: Pick<Lead, 'id' | 'first_name' | 'last_name' | 'phone' | 'email'> | null
}

// ─── Database / Contacts ─────────────────────────────────────────────────────

export interface ContactRow extends Lead {
  // Agrégats JOIN calls
  nb_calls: number
  last_call_at: string | null
}

export type ContactGroupBy = 'status' | 'source'

export interface ContactFilters {
  search: string
  statuses: LeadStatus[]
  sources: LeadSource[]
  tags: string[]
  date_from: string
  date_to: string
  reached: 'all' | 'true' | 'false'
  group_by: ContactGroupBy | ''
}

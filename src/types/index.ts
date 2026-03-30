// ─── Workspace & User ───────────────────────────────────────────────────────

export interface Workspace {
  id: string
  name: string
  owner_id: string
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

// ─── Automation ──────────────────────────────────────────────────────────────

export type AutomationTrigger =
  | 'new_lead'
  | 'rdv_planifie'
  | 'rdv_in_x_hours'
  | 'lead_status_changed'
  | 'followup_pending_x_days'

export type AutomationAction =
  | 'send_whatsapp'
  | 'send_email'
  | 'create_followup'
  | 'change_lead_status'
  | 'send_notification'

export interface Automation {
  id: string
  workspace_id: string
  trigger_type: AutomationTrigger
  trigger_config: Record<string, unknown>
  action_type: AutomationAction
  action_config: Record<string, unknown>
  is_active: boolean
  created_at: string
}

// ─── Integration ─────────────────────────────────────────────────────────────

export type IntegrationType = 'google_calendar' | 'meta' | 'whatsapp' | 'stripe' | 'telegram'

export interface Integration {
  id: string
  workspace_id: string
  type: IntegrationType
  credentials_encrypted: string | null
  meta_page_id: string | null
  connected_at: string | null
  is_active: boolean
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

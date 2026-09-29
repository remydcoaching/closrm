// Mirrors the web's src/types/index.ts shapes + the exact JSON returned by
// /api/funnels, /api/emails/*, /api/workflows*, /api/workflow-assets and
// /api/instagram/{account,conversations,messages}. Copied, not imported
// (no shared types package yet) — keep in sync manually.
import type { LeadSource, LeadStatus } from '../leads/types'

// ─── Funnels ────────────────────────────────────────────────────────────────

export type FunnelStatus = 'draft' | 'published'

/** GET /api/funnels → { data: FunnelListItem[] } */
export interface FunnelListItem {
  id: string
  name: string
  slug: string
  description: string | null
  status: FunnelStatus
  page_count: number
  first_page_slug: string | null
  created_at: string
  updated_at?: string
}

export interface FunnelPage {
  id: string
  funnel_id: string
  name: string
  slug: string
  page_order: number
  blocks: unknown[]
  is_published: boolean
}

/** GET /api/funnels/:id → { data } */
export interface FunnelDetail extends Omit<FunnelListItem, 'page_count' | 'first_page_slug'> {
  pages: FunnelPage[]
  preset_id?: string | null
  preset_override?: Record<string, unknown> | null
  effects_config?: Record<string, boolean> | null
  meta_pixel_id?: string | null
}

/** GET /api/funnels/:id/stats?days=N → { data } */
export interface FunnelStats {
  period_days: number
  pages: {
    id: string
    name: string
    slug: string
    page_order: number
    views_count: number
    submissions_count: number
    conversion_rate: number
  }[]
  totals: { views: number; form_submits: number; button_clicks: number; video_plays: number }
  funnel_conversion: { first_page_views: number; last_page_views: number; conversion_rate: number }
}

// ─── Emails ─────────────────────────────────────────────────────────────────

export interface EmailBlock {
  id: string
  type: string
  config: Record<string, unknown>
}

export interface EmailTemplate {
  id: string
  name: string
  subject: string
  blocks: EmailBlock[]
  preview_text: string | null
  thumbnail_url: string | null
  preset_id?: string | null
  created_at: string
  updated_at: string
}

export type EmailBroadcastStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed'

export interface EmailBroadcastFilters {
  statuses?: LeadStatus[]
  sources?: LeadSource[]
  tags?: string[]
  date_from?: string
  date_to?: string
  reached?: 'all' | 'true' | 'false'
}

export interface EmailBroadcast {
  id: string
  name: string
  template_id: string | null
  subject: string | null
  filters: EmailBroadcastFilters
  status: EmailBroadcastStatus
  scheduled_at: string | null
  sent_count: number
  total_count: number
  sent_at: string | null
  created_at: string
}

/** GET /api/emails/broadcasts/:id/stats */
export interface BroadcastStats {
  broadcast: {
    id: string
    name: string
    subject: string | null
    sent_at: string | null
    total_count: number
    sent_count: number
  }
  counts: {
    total: number
    sent: number
    delivered: number
    opened: number
    clicked: number
    bounced: number
    complained: number
  }
  rates: { open: number; click: number; bounce: number }
  recipients: {
    send_id: string
    lead_id: string | null
    status: string
    sent_at: string
    opened_at: string | null
    clicked_at: string | null
    bounced_at: string | null
    lead: { first_name: string | null; last_name: string | null; email: string } | null
  }[]
}

/** GET /api/emails/stats?days=N — `rates`/`unsubscribed` absent when no sends. */
export interface EmailGlobalStats {
  total: number
  delivered: number
  opened: number
  clicked: number
  bounced: number
  complained: number
  unsubscribed?: number
  rates?: { open: number; click: number; bounce: number }
  by_source: Record<string, { count: number; bounced: number }>
}

export type EmailDomainStatus = 'pending' | 'verified' | 'failed' | string

export interface DnsRecord {
  type: string
  name: string
  value: string
  priority?: number
  status: string
}

export interface EmailDomain {
  id: string
  domain: string
  status: EmailDomainStatus
  dns_records: DnsRecord[] | null
  default_from_email: string | null
  default_from_name: string | null
  created_at: string
}

// ─── Workflows (automations + email sequences) ──────────────────────────────

export type WorkflowStatus = 'brouillon' | 'actif' | 'inactif'
export type WorkflowStepType = 'action' | 'delay' | 'condition' | 'wait_for_event'
export type DelayUnit = 'minutes' | 'hours' | 'days'

export interface WorkflowStep {
  id: string
  workflow_id: string
  step_order: number
  step_type: WorkflowStepType
  action_type: string | null
  action_config: Record<string, unknown>
  delay_value: number | null
  delay_unit: DelayUnit | null
}

export interface Workflow {
  id: string
  name: string
  description: string | null
  trigger_type: string
  trigger_config: Record<string, unknown>
  status: WorkflowStatus
  execution_count: number
  last_run_at: string | null
  notify_on_failure: boolean
  failure_notification_channel: string | null
  created_at: string
  updated_at: string
}

/** Email sequences = workflows with trigger_config.sequence, steps embedded. */
export interface SequenceWorkflow extends Workflow {
  workflow_steps?: WorkflowStep[]
}

export interface WorkflowListResponse {
  data: Workflow[]
  meta: { total: number; page: number; per_page: number; total_pages: number }
}

/** GET /api/workflows/templates → { data } (from src/lib/workflows/templates.ts) */
export interface WorkflowTemplate {
  id: string
  name: string
  description: string
  category: 'leads' | 'calls' | 'instagram' | 'booking'
  icon: string
  trigger_type: string
  trigger_config: Record<string, unknown>
  steps: {
    step_type: WorkflowStepType
    action_type?: string
    action_config?: Record<string, unknown>
    delay_value?: number
    delay_unit?: DelayUnit
  }[]
  requires_integration?: string[]
}

export type ExecutionStatus = 'running' | 'completed' | 'failed' | 'waiting'

export interface WorkflowExecution {
  id: string
  workflow_id: string
  lead_id: string | null
  status: ExecutionStatus
  current_step: number
  error_message: string | null
  started_at: string
  completed_at: string | null
  resume_at: string | null
  lead: { id: string; first_name: string; last_name: string; phone: string | null; email: string | null } | null
}

export interface WorkflowExecutionLog {
  id: string
  execution_id: string
  step_order: number
  step_type: string
  action_type: string | null
  status: 'success' | 'failed' | 'skipped'
  result: Record<string, unknown>
  error_message: string | null
  executed_at: string
}

export type WorkflowAssetType = 'link' | 'audio' | 'file'

export interface WorkflowAsset {
  id: string
  type: WorkflowAssetType
  name: string
  url: string
  mime_type: string | null
  file_size: number | null
  storage_path: string | null
  created_at: string
}

// ─── Messages ───────────────────────────────────────────────────────────────

export interface IgConversation {
  id: string
  participant_ig_id: string | null
  participant_username: string | null
  participant_name: string | null
  participant_avatar_url: string | null
  lead_id: string | null
  last_message_text: string | null
  last_message_at: string | null
  unread_count: number
}

export interface IgMessage {
  id: string
  conversation_id: string
  sender_type: 'user' | 'participant'
  text: string | null
  media_url: string | null
  media_type: 'image' | 'video' | 'audio' | 'sticker' | null
  sent_at: string
  is_read: boolean
  _optimistic?: boolean
}

export interface EmailConversation {
  id: string
  participant_email: string
  participant_name: string | null
  lead_id: string | null
  subject: string | null
  last_message_text: string | null
  last_message_at: string | null
  last_message_from: 'user' | 'participant' | null
  unread_count: number
}

export interface EmailMessage {
  id: string
  conversation_id: string
  sender_type: 'user' | 'participant'
  from_email: string
  from_name: string | null
  to_email: string
  subject: string | null
  body_text: string | null
  body_html: string | null
  sent_at: string
  is_read: boolean
  ses_status?: string | null
  _optimistic?: boolean
}

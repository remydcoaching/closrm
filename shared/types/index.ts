// Types partagés entre l'app web (src/) et l'app mobile (mobile/).
// Source de vérité initiale : src/types/index.ts. Toute modification ici
// doit être répliquée côté web tant que la migration src/types → shared/types
// n'est pas terminée.

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

// ─── Team / Workspace Members ───────────────────────────────────────────────

export type WorkspaceRole = 'admin' | 'setter' | 'closer' | 'monteur'
export type MemberStatus = 'active' | 'invited' | 'suspended'

export interface WorkspaceMember {
  id: string
  workspace_id: string
  user_id: string
  role: WorkspaceRole
  status: MemberStatus
  permissions: Record<string, boolean>
  invited_by: string | null
  invited_at: string
  activated_at: string | null
  created_at: string
}

export interface WorkspaceMemberWithUser extends WorkspaceMember {
  user: Pick<User, 'id' | 'email' | 'full_name' | 'avatar_url'>
}

// ─── Lead ───────────────────────────────────────────────────────────────────

export type LeadStatus =
  | 'nouveau'
  | 'scripte'
  | 'setting_planifie'
  | 'no_show_setting'
  | 'closing_planifie'
  | 'no_show_closing'
  | 'clos'
  | 'dead'

export type LeadSource =
  | 'facebook_ads'
  | 'instagram_ads'
  | 'follow_ads'
  | 'formulaire'
  | 'manuel'
  | 'funnel'

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
  instagram_handle: string | null
  email_unsubscribed: boolean
  email_unsubscribed_at: string | null
  last_activity_at: string | null
  deal_amount: number | null
  deal_installments: number
  cash_collected: number
  closed_at: string | null
  assigned_to: string | null
  import_batch_id: string | null
  created_at: string
  updated_at: string
}

// ─── Deal ───────────────────────────────────────────────────────────────────

export type DealStatus = 'active' | 'completed' | 'churned' | 'refunded'

export interface Deal {
  id: string
  workspace_id: string
  lead_id: string
  setter_id: string | null
  closer_id: string | null
  amount: number
  cash_collected: number
  installments: number
  duration_months: number | null
  started_at: string
  ends_at: string | null
  status: DealStatus
  notes: string | null
  created_at: string
  updated_at: string
}

// ─── Call ────────────────────────────────────────────────────────────────────

export type CallType = 'setting' | 'closing'
export type CallOutcome = 'pending' | 'done' | 'cancelled' | 'no_show'

export interface HandoffBrief {
  objective?: string
  budget?: string
  objections?: string
  availability?: string
  notes?: string
}

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
  assigned_to: string | null
  handoff_brief: HandoffBrief | null
  created_at: string
}

// ─── Follow-up ───────────────────────────────────────────────────────────────

export type FollowUpChannel = 'whatsapp' | 'email' | 'instagram_dm' | 'manuel'
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

// ─── Instagram (DM Inbox) ────────────────────────────────────────────────────

export interface IgConversation {
  id: string
  workspace_id: string
  ig_conversation_id: string
  participant_ig_id: string | null
  participant_username: string | null
  participant_name: string | null
  participant_avatar_url: string | null
  lead_id: string | null
  last_message_text: string | null
  last_message_at: string | null
  unread_count: number
  created_at: string
}

export type IgMessageSenderType = 'user' | 'participant'

export interface IgMessage {
  id: string
  workspace_id: string
  conversation_id: string
  ig_message_id: string | null
  sender_type: IgMessageSenderType
  text: string | null
  media_url: string | null
  media_type: 'image' | 'video' | 'audio' | 'sticker' | null
  sent_at: string
  is_read: boolean
}

// ─── App Notifications (mobile uniquement, table dédiée — cf migration) ─────

export type AppNotificationType =
  | 'new_lead'
  | 'no_show'
  | 'deal_closed'
  | 'dm_reply'
  | 'call_reminder'
  | 'booking'

export type AppNotificationEntityType =
  | 'lead'
  | 'call'
  | 'deal'
  | 'conversation'

export interface AppNotification {
  id: string
  workspace_id: string
  type: AppNotificationType
  title: string
  subtitle: string | null
  entity_type: AppNotificationEntityType | null
  entity_id: string | null
  read: boolean
  created_at: string
}

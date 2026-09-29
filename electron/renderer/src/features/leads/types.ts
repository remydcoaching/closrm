// Mirrors src/types/index.ts (Lead/Call/FollowUp) from the main ClosRM repo —
// copied, not imported cross-package for M1 (no monorepo wiring yet, see Open
// Questions in ELECTRON_MIGRATION_PLAN.md §18). Keep in sync manually until a
// shared types package exists.
export type LeadStatus =
  | 'nouveau'
  | 'scripte'
  | 'setting_planifie'
  | 'no_show_setting'
  | 'closing_planifie'
  | 'no_show_closing'
  | 'clos'
  | 'pas_qualifie'
  | 'dead'

export type LeadSource = 'facebook_ads' | 'instagram_ads' | 'follow_ads' | 'formulaire' | 'manuel' | 'funnel'

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
  // Instagram profile snapshot — populated by a Hiker discovery targeting
  // this lead's own account (migration 104). Never real-time: always paired
  // with instagram_profile_synced_at, never presented as live.
  instagram_followers_count: number | null
  instagram_following_count: number | null
  instagram_is_verified: boolean | null
  instagram_is_private: boolean | null
  instagram_profile_pic_url: string | null
  instagram_bio: string | null
  instagram_profile_synced_at: string | null
  last_activity_at: string | null
  deal_amount: number | null
  deal_installments: number
  cash_collected: number
  closed_at: string | null
  assigned_to: string | null
  created_at: string
  updated_at: string
}

export interface LeadsListResponse {
  data: Lead[]
  meta: { total: number; page: number; per_page: number; total_pages: number }
}

// ─── Call (GET /api/leads/:id → calls[]) ───────────────────────────────────
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
  created_at: string
}

// ─── Follow-up (GET /api/leads/:id → follow_ups[]) ─────────────────────────
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

export interface LeadWithRelations extends Lead {
  calls: Call[]
  follow_ups: FollowUp[]
}

// ─── Engagement score (GET /api/leads/:id/score) ───────────────────────────
export interface EngagementSignal {
  key: string
  label: string
  detail: string
}

export interface EngagementScore {
  score: number
  likesCount: number
  commentsCount: number
  dmCount: number
  mentionCount: number
  storyViewsCount?: number
  totalInteractions: number
  distinctContentCount: number
  firstInteractionAt: string | null
  lastInteractionAt: string | null
  signals: EngagementSignal[]
}

// ─── Journey (GET /api/leads/:id/journey) ──────────────────────────────────
export interface JourneyEvent {
  id: string
  event_type: string
  metadata: Record<string, unknown>
  funnel_page_id: string | null
  funnel_page_name: string | null
  created_at: string
}

export interface JourneyAttributionTouch {
  source: string | null
  value: string | null
  at: string | null
  raw: Record<string, unknown> | null
}

export interface JourneyBooking {
  id: string
  scheduled_at: string
  status: string
  duration_minutes: number
  form_data: Record<string, unknown>
  calendar_id: string | null
  calendar_name: string | null
}

export interface LeadJourney {
  lead: {
    id: string
    first_name: string
    last_name: string
    source: LeadSource
    visitor_id: string | null
    form_answers: Record<string, unknown>
    meta_campaign_id: string | null
    meta_adset_id: string | null
    meta_ad_id: string | null
    created_at: string
  }
  bookings: JourneyBooking[]
  events: JourneyEvent[]
  attribution: { first_touch: JourneyAttributionTouch; last_touch: JourneyAttributionTouch }
}

// Mirrors the EXISTING ClosRM web contracts for Pipeline (GET
// /api/leads/grouped → leads_grouped_by_status RPC, migration 030),
// Relances (GET /api/follow-ups) and Deals (GET/POST /api/deals). No new
// backend, no invented shape.
import type { Lead, LeadStatus } from '../leads/types'

export interface GroupedColumn {
  total: number
  leads: Lead[]
}

export type GroupedColumns = Partial<Record<LeadStatus, GroupedColumn>>

// ─── Follow-up (relances) ───────────────────────────────────────────────
export type FollowUpChannel = 'whatsapp' | 'email' | 'instagram_dm' | 'manuel'
export type FollowUpStatus = 'en_attente' | 'fait' | 'annule'

export interface FollowUpWithLead {
  id: string
  workspace_id: string
  lead_id: string
  reason: string
  scheduled_at: string
  channel: FollowUpChannel
  status: FollowUpStatus
  notes: string | null
  created_at: string
  lead: { id: string; first_name: string; last_name: string; phone: string; email: string | null; status: LeadStatus; assigned_to: string | null } | null
}

export interface FollowUpsListResponse {
  data: FollowUpWithLead[]
  meta: { total: number; page: number; per_page: number; total_pages: number }
}

// ─── Deal ───────────────────────────────────────────────────────────────
export type DealStatus = 'active' | 'completed' | 'churned' | 'refunded'

export interface DealWithLead {
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
  lead: { id: string; first_name: string; last_name: string; email: string | null; phone: string; instagram_profile_pic_url?: string | null } | null
}

// ─── Call (closing) — mirrors GET /api/calls ───────────────────────────
export type CallType = 'setting' | 'closing'
export type CallOutcome = 'pending' | 'done' | 'cancelled' | 'no_show'

export interface CallWithLead {
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
  created_at: string
  lead: { id: string; first_name: string; last_name: string; phone: string; email: string | null; status: LeadStatus }
}

export interface CallsListResponse {
  data: CallWithLead[]
  meta: { total: number; page: number; per_page: number; total_pages: number }
}

// Data access for Stats / Finance / Dashboard — ONLY existing endpoints,
// same query params as the web (see src/lib/validations/leads.ts,
// calls.ts, bookings.ts, follow-ups.ts and src/app/api/deals, finance,
// workspaces/reporting, meta/insights). The web's Stats and Dashboard v2
// pages are Server Components that query Supabase directly (no API route),
// so here the same figures are rebuilt from the list endpoints.
import { api, ApiError } from '../../lib/api-client'
import type { Lead, LeadsListResponse, LeadSource } from '../leads/types'
import type { CallWithLead, CallsListResponse, DealWithLead, FollowUpsListResponse } from '../crm/types'
import type { TimeWindow } from './metrics'

// ─── Leads ──────────────────────────────────────────────────────────────────

export interface LeadCountFilter {
  window?: TimeWindow | null
  dateField?: 'created_at' | 'updated_at' | 'closed_at'
  status?: string
  source?: string
  assignedTo?: string
}

function leadParams(f: LeadCountFilter): URLSearchParams {
  const p = new URLSearchParams()
  if (f.window) {
    p.set('date_from', f.window.from.toISOString())
    p.set('date_to', f.window.to.toISOString())
  }
  if (f.dateField) p.set('date_field', f.dateField)
  if (f.status) p.set('status', f.status)
  if (f.source) p.set('source', f.source)
  if (f.assignedTo) p.set('assigned_to', f.assignedTo)
  return p
}

/** Exact count (GET /api/leads uses count: 'exact') with per_page=1. */
export async function countLeads(f: LeadCountFilter): Promise<number> {
  const p = leadParams(f)
  p.set('per_page', '1')
  const res = await api.get<LeadsListResponse>(`/api/leads?${p.toString()}`)
  return res.meta.total
}

export interface Paged<T> {
  rows: T[]
  /** True when the page cap was hit — the UI says so instead of pretending. */
  truncated: boolean
}

const LEADS_PER_PAGE = 100
const LEADS_MAX_PAGES = 60

/** Every lead of the window (created_at), paginated 100 by 100. */
export async function fetchLeadsInWindow(window: TimeWindow | null, extra: LeadCountFilter = {}): Promise<Paged<Lead>> {
  const base = leadParams({ ...extra, window })
  base.set('per_page', String(LEADS_PER_PAGE))
  base.set('sort', 'created_at')
  base.set('order', 'asc')
  const pageUrl = (page: number) => {
    const p = new URLSearchParams(base)
    p.set('page', String(page))
    return `/api/leads?${p.toString()}`
  }
  const first = await api.get<LeadsListResponse>(pageUrl(1))
  const totalPages = Math.min(first.meta.total_pages, LEADS_MAX_PAGES)
  const rows = [...first.data]
  const remaining: number[] = []
  for (let page = 2; page <= totalPages; page++) remaining.push(page)
  // Small concurrency so a 90-day window doesn't fire 20 requests at once.
  for (let i = 0; i < remaining.length; i += 4) {
    const chunk = await Promise.all(remaining.slice(i, i + 4).map((page) => api.get<LeadsListResponse>(pageUrl(page))))
    for (const res of chunk) rows.push(...res.data)
  }
  return { rows, truncated: first.meta.total_pages > LEADS_MAX_PAGES }
}

export const LEAD_SOURCES: LeadSource[] = ['facebook_ads', 'instagram_ads', 'follow_ads', 'formulaire', 'manuel', 'funnel']

// ─── Calls ──────────────────────────────────────────────────────────────────

const CALLS_PER_PAGE = 250
const CALLS_MAX_PAGES = 40

/**
 * Calls CREATED since `since` (null = all). GET /api/calls has no created_at
 * filter, but it accepts sort=created_at, so pages are read newest-first
 * until a row older than `since` shows up.
 */
export async function fetchCallsCreatedSince(since: Date | null): Promise<Paged<CallWithLead>> {
  const rows: CallWithLead[] = []
  for (let page = 1; page <= CALLS_MAX_PAGES; page++) {
    const p = new URLSearchParams({ sort: 'created_at', order: 'desc', per_page: String(CALLS_PER_PAGE), page: String(page) })
    const res = await api.get<CallsListResponse>(`/api/calls?${p.toString()}`)
    let reachedOlder = false
    for (const c of res.data) {
      if (since && new Date(c.created_at).getTime() < since.getTime()) {
        reachedOlder = true
        break
      }
      rows.push(c)
    }
    if (reachedOlder || res.data.length < CALLS_PER_PAGE) return { rows, truncated: false }
  }
  return { rows, truncated: true }
}

/** Calls whose scheduled_at is in [after, before) — same filters as the web. */
export async function fetchCallsScheduled(opts: { after?: Date; before?: Date; outcome?: string; type?: string; perPage?: number; maxPages?: number }): Promise<Paged<CallWithLead>> {
  const perPage = opts.perPage ?? CALLS_PER_PAGE
  const maxPages = opts.maxPages ?? CALLS_MAX_PAGES
  const rows: CallWithLead[] = []
  for (let page = 1; page <= maxPages; page++) {
    const p = new URLSearchParams({ sort: 'scheduled_at', order: 'asc', per_page: String(perPage), page: String(page) })
    if (opts.after) p.set('scheduled_after', opts.after.toISOString())
    if (opts.before) p.set('scheduled_before', opts.before.toISOString())
    if (opts.outcome) p.set('outcome', opts.outcome)
    if (opts.type) p.set('type', opts.type)
    const res = await api.get<CallsListResponse>(`/api/calls?${p.toString()}`)
    rows.push(...res.data)
    if (res.data.length < perPage) return { rows, truncated: false }
  }
  return { rows, truncated: true }
}

// ─── Deals ──────────────────────────────────────────────────────────────────

export async function fetchDeals(params: Record<string, string> = {}): Promise<DealWithLead[]> {
  const qs = new URLSearchParams(params).toString()
  const res = await api.get<{ data: DealWithLead[] | null }>(`/api/deals${qs ? `?${qs}` : ''}`)
  return res.data ?? []
}

// ─── Bookings (GET /api/bookings — BOOKING_SELECT) ─────────────────────────

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'no_show' | 'completed'

export interface BookingRow {
  id: string
  calendar_id: string | null
  lead_id: string | null
  call_id: string | null
  title: string
  scheduled_at: string
  duration_minutes: number
  status: BookingStatus
  source: string
  meet_url: string | null
  is_personal: boolean
  created_at: string
  booking_calendar: { name: string; color: string | null } | null
  lead: { id: string; first_name: string; last_name: string; phone: string | null; email: string | null; instagram_profile_pic_url?: string | null } | null
  location: { id: string; name: string; address: string | null; location_type: string | null } | null
}

interface BookingsListResponse {
  data: BookingRow[]
  meta: { total: number; page: number; per_page: number }
}

const BOOKINGS_PER_PAGE = 250

/** Bookings scheduled in [start, end] (sorted by scheduled_at asc, as the API does). */
export async function fetchBookings(opts: { start?: Date; end?: Date; maxPages?: number; stopWhen?: (rows: BookingRow[]) => boolean }): Promise<Paged<BookingRow>> {
  const maxPages = opts.maxPages ?? 8
  const rows: BookingRow[] = []
  for (let page = 1; page <= maxPages; page++) {
    const p = new URLSearchParams({ per_page: String(BOOKINGS_PER_PAGE), page: String(page) })
    if (opts.start) p.set('date_start', opts.start.toISOString())
    if (opts.end) p.set('date_end', opts.end.toISOString())
    const res = await api.get<BookingsListResponse>(`/api/bookings?${p.toString()}`)
    rows.push(...res.data)
    if (res.data.length < BOOKINGS_PER_PAGE) return { rows, truncated: false }
    if (opts.stopWhen?.(rows)) return { rows, truncated: false }
  }
  return { rows, truncated: true }
}

// ─── Follow-ups ─────────────────────────────────────────────────────────────

export async function fetchFollowUps(params: Record<string, string>): Promise<FollowUpsListResponse> {
  return api.get<FollowUpsListResponse>(`/api/follow-ups?${new URLSearchParams(params).toString()}`)
}

// ─── Finance (GET /api/finance/overview, /api/finance/team) ────────────────

export interface FinanceOverview {
  mrr_current: number
  mrr_new_this_month: number
  mrr_churned_this_month: number
  cash_this_month: number
  cash_cumulative: number
  revenue_cumulative: number
  deals_active: number
  avg_deal_size: number
  mrr_by_month: { month: string; mrr: number }[]
}

export interface MemberPerformance {
  user_id: string
  full_name: string
  email: string
  role: 'admin' | 'setter' | 'closer'
  deals_as_closer: number
  deals_as_setter: number
  revenue_closed: number
  cash_collected: number
  mrr_contributed: number
}

export async function fetchFinanceOverview(): Promise<FinanceOverview> {
  const res = await api.get<{ data: FinanceOverview }>('/api/finance/overview')
  return res.data
}

export async function fetchFinanceTeam(): Promise<MemberPerformance[]> {
  const res = await api.get<{ data: MemberPerformance[] }>('/api/finance/team')
  return res.data ?? []
}

// ─── Team reporting (GET /api/workspaces/reporting — admin only) ──────────

export interface MemberReport {
  user_id: string
  full_name: string
  email: string
  role: string
  stats: {
    messages_sent: number
    calls_total: number
    calls_reached: number
    rdv_booked: number
    closings: number
    deal_amount: number
    no_shows: number
    joignabilite: number
    closing_rate: number
  }
}

/** Null when the caller is not admin (403) — the section is then hidden. */
export async function fetchReporting(dateFrom: string, dateTo: string): Promise<MemberReport[] | null> {
  try {
    const res = await api.get<{ data: { members: MemberReport[] } }>(`/api/workspaces/reporting?date_from=${dateFrom}&date_to=${dateTo}`)
    return res.data.members
  } catch (err) {
    if (err instanceof ApiError && err.status === 403) return null
    throw err
  }
}

// ─── Meta Ads (GET /api/meta/insights?level=account) ──────────────────────

export interface MetaKpis {
  spend: number
  impressions: number
  clicks: number
  ctr: number
  leads: number
  cpl: number | null
}

export type MetaInsightsResult =
  | { state: 'connected'; kpis: MetaKpis }
  | { state: 'not_connected' }
  | { state: 'needs_upgrade' }
  | { state: 'error'; message: string }

export async function fetchMetaInsights(dateFrom: string, dateTo: string): Promise<MetaInsightsResult> {
  try {
    const res = await api.get<{ kpis: MetaKpis }>(`/api/meta/insights?level=account&date_from=${dateFrom}&date_to=${dateTo}`)
    return { state: 'connected', kpis: res.kpis }
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return { state: 'not_connected' }
    if (err instanceof ApiError && err.status === 403) return { state: 'needs_upgrade' }
    return { state: 'error', message: err instanceof Error ? err.message : 'Erreur Meta' }
  }
}

// ─── Current user + role (GET /api/user/profile + /api/workspaces/members) ─

export type WorkspaceRole = 'admin' | 'setter' | 'closer' | 'monteur'

export interface CurrentMember {
  userId: string
  fullName: string | null
  role: WorkspaceRole
}

export async function fetchCurrentMember(): Promise<CurrentMember> {
  const profile = await api.get<{ data: { user: { id: string; full_name: string | null; email: string } } }>('/api/user/profile')
  const user = profile.data.user
  let role: WorkspaceRole = 'admin'
  try {
    const members = await api.get<{ data: { user_id: string; role: WorkspaceRole; status: string }[] }>('/api/workspaces/members')
    const me = members.data.find((m) => m.user_id === user.id)
    if (me) role = me.role
  } catch {
    // Members list unavailable → keep the admin default, same as the web
    // when no member row narrows the role.
  }
  return { userId: user.id, fullName: user.full_name, role }
}

export type { Lead, CallWithLead, DealWithLead }

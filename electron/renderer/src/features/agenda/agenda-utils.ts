// Pure helpers for the Agenda module — date math (no date-fns in the
// desktop bundle), grid positioning (port of src/lib/agenda/positioning.ts),
// event mapping (port of src/types/agenda.ts) and the booking payload builder
// used by the create modal (same body as the web's NewBookingModal).
import type {
  AgendaBookingEvent,
  AgendaCall,
  AgendaCallEvent,
  AgendaEvent,
  AgendaViewMode,
  BookingStatus,
  BookingWithCalendar,
  CallType,
} from './types'

/* ─── Dates ─────────────────────────────────────────────────────────────── */

export function startOfDay(d: Date): Date {
  const r = new Date(d)
  r.setHours(0, 0, 0, 0)
  return r
}

export function endOfDay(d: Date): Date {
  const r = new Date(d)
  r.setHours(23, 59, 59, 999)
  return r
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

export function addMonths(d: Date, n: number): Date {
  const r = new Date(d)
  const day = r.getDate()
  r.setDate(1)
  r.setMonth(r.getMonth() + n)
  const last = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate()
  r.setDate(Math.min(day, last))
  return r
}

export function addMinutes(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 60_000)
}

/** Monday-based week start (weekStartsOn: 1, like the web). */
export function startOfWeek(d: Date): Date {
  const r = startOfDay(d)
  const dow = (r.getDay() + 6) % 7 // 0 = Monday
  return addDays(r, -dow)
}

export function endOfWeek(d: Date): Date {
  return endOfDay(addDays(startOfWeek(d), 6))
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0)
}

export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** "2026-09-25" in local time. */
export function toDateInput(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/** "14:30" in local time. */
export function toTimeInput(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

/** 9.5 → "09:30". */
export function hourToHHmm(hour: number): string {
  const totalMin = Math.round(hour * 60)
  return `${pad2(Math.floor(totalMin / 60))}:${pad2(totalMin % 60)}`
}

export function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

export function minutesToTime(total: number): string {
  const t = ((total % 1440) + 1440) % 1440
  return `${pad2(Math.floor(t / 60))}:${pad2(t % 60)}`
}

/** Local date + time inputs → ISO (UTC), like the web modal. */
export function localToIso(date: string, time: string): string {
  return new Date(`${date}T${time}:00`).toISOString()
}

/** Every quarter hour of a day, "00:00" … "23:45". */
export const QUARTER_TIMES: string[] = Array.from({ length: 96 }, (_, i) => minutesToTime(i * 15))

export function getDateRange(view: AgendaViewMode, date: Date): { start: Date; end: Date } {
  if (view === 'day') return { start: startOfDay(date), end: endOfDay(date) }
  if (view === 'week') return { start: startOfWeek(date), end: endOfWeek(date) }
  return { start: startOfMonth(date), end: endOfMonth(date) }
}

/** Page size per view — same values as the web's useAgendaData. */
export function perPageFor(view: AgendaViewMode): number {
  return view === 'day' ? 30 : view === 'week' ? 100 : 200
}

export function navigate(view: AgendaViewMode, date: Date, direction: 1 | -1): Date {
  if (view === 'day') return addDays(date, direction)
  if (view === 'week') return addDays(date, 7 * direction)
  return addMonths(date, direction)
}

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('fr-FR', opts)

export function formatPeriodLabel(view: AgendaViewMode, date: Date): string {
  if (view === 'day') return fmt({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date)
  if (view === 'week') {
    const start = startOfWeek(date)
    const end = addDays(start, 6)
    if (start.getMonth() === end.getMonth()) {
      return `${start.getDate()} – ${fmt({ day: 'numeric', month: 'long', year: 'numeric' }).format(end)}`
    }
    return `${fmt({ day: 'numeric', month: 'short' }).format(start)} – ${fmt({ day: 'numeric', month: 'short', year: 'numeric' }).format(end)}`
  }
  return fmt({ month: 'long', year: 'numeric' }).format(date)
}

export function formatLongDate(d: Date): string {
  return fmt({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(d)
}

export function formatDayHeader(d: Date): { weekday: string; day: number } {
  return { weekday: fmt({ weekday: 'short' }).format(d).replace('.', ''), day: d.getDate() }
}

export function formatDateTime(iso: string): string {
  return fmt({ weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
}

/** 90 → "1h30", 1440 → "1 jour", 20 → "20 min". */
export function formatDuration(minutes: number): string {
  if (minutes >= 1440 && minutes % 1440 === 0) {
    const days = minutes / 1440
    return days === 1 ? '1 jour' : `${days} jours`
  }
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return m > 0 ? `${h}h${pad2(m)}` : `${h}h`
  }
  return `${minutes} min`
}

/* ─── Grid positioning (port of src/lib/agenda/positioning.ts) ──────────── */

/** Height of a 30-min slot, in px → 64 px per hour. */
export const SLOT_HEIGHT = 32
export const PX_PER_MINUTE = SLOT_HEIGHT / 30
export const GRID_HEIGHT = 24 * 2 * SLOT_HEIGHT
export const EVENT_VERTICAL_GAP_PX = 2

export function eventToPosition(start: string, durationMinutes: number): { top: number; height: number } {
  const d = new Date(start)
  const startMin = d.getHours() * 60 + d.getMinutes()
  const endMin = Math.min(startMin + durationMinutes, 24 * 60)
  const rawHeight = (endMin - startMin) * PX_PER_MINUTE
  return { top: startMin * PX_PER_MINUTE, height: Math.max(8, rawHeight - EVENT_VERTICAL_GAP_PX) }
}

export function pixelToHour(pixelY: number): number {
  return pixelY / PX_PER_MINUTE / 60
}

/** Snap to the nearest quarter hour (00/15/30/45) — web granularity. */
export function snapToQuarter(hour: number): number {
  return Math.round(hour * 4) / 4
}

export interface OverlapLayout {
  column: number
  groupSize: number
}

/** Side-by-side columns for overlapping events (same sweep as the web). */
export function computeOverlapLayout(events: Pick<AgendaEvent, 'id' | 'start' | 'durationMinutes'>[]): Map<string, OverlapLayout> {
  const result = new Map<string, OverlapLayout>()
  if (events.length === 0) return result
  const sorted = [...events].sort((a, b) => {
    const sa = new Date(a.start).getTime()
    const sb = new Date(b.start).getTime()
    if (sa !== sb) return sa - sb
    return b.durationMinutes - a.durationMinutes
  })
  let active: { column: number; endMs: number; groupId: number }[] = []
  let nextGroupId = 0
  const groups = new Map<number, string[]>()
  for (const ev of sorted) {
    const startMs = new Date(ev.start).getTime()
    const endMs = startMs + ev.durationMinutes * 60_000
    active = active.filter((a) => a.endMs > startMs)
    let groupId: number
    let column = 0
    if (active.length === 0) {
      groupId = nextGroupId++
    } else {
      groupId = active[0].groupId
      const used = new Set(active.map((a) => a.column))
      while (used.has(column)) column++
    }
    active.push({ column, endMs, groupId })
    result.set(ev.id, { column, groupSize: 1 })
    const list = groups.get(groupId) ?? []
    list.push(ev.id)
    groups.set(groupId, list)
  }
  for (const ids of groups.values()) {
    const size = Math.max(...ids.map((id) => result.get(id)?.column ?? 0)) + 1
    for (const id of ids) {
      const r = result.get(id)
      if (r) result.set(id, { column: r.column, groupSize: size })
    }
  }
  return result
}

/* ─── Event mapping (port of src/types/agenda.ts) ───────────────────────── */

const CALL_COLORS: Record<CallType, string> = { setting: '#3b82f6', closing: '#a855f7' }
const CALL_LABELS: Record<CallType, string> = { setting: 'Setting', closing: 'Closing' }

export function bookingToAgendaEvent(b: BookingWithCalendar): AgendaBookingEvent {
  const leadName = b.lead ? `${b.lead.first_name} ${b.lead.last_name}`.trim() : null
  const formColor = b.form_data?.color
  const personalColor = typeof formColor === 'string' && formColor.length > 0 ? formColor : '#6b7280'
  const color = b.color ?? (b.is_personal ? personalColor : b.booking_calendar?.color ?? '#3b82f6')
  return {
    id: `booking-${b.id}`,
    kind: 'booking',
    start: b.scheduled_at,
    durationMinutes: b.duration_minutes,
    color,
    title: b.is_personal ? b.title : leadName || b.title,
    subtitle: b.booking_calendar?.name ?? null,
    lead: b.lead,
    booking: b,
  }
}

export function callToAgendaEvent(c: AgendaCall): AgendaCallEvent {
  const lead = c.lead ?? null
  const leadName = lead ? `${lead.first_name} ${lead.last_name}`.trim() : 'Appel'
  return {
    id: `call-${c.id}`,
    kind: 'call',
    start: c.scheduled_at,
    durationMinutes: c.duration_seconds ? Math.max(1, Math.ceil(c.duration_seconds / 60)) : 30,
    color: CALL_COLORS[c.type],
    title: leadName,
    subtitle: CALL_LABELS[c.type],
    lead,
    call: c,
  }
}

/** Bookings + calls, minus calls already linked to a booking (web dedup). */
export function mergeEvents(bookings: BookingWithCalendar[], calls: AgendaCall[]): AgendaEvent[] {
  const linked = new Set(bookings.map((b) => b.call_id).filter((x): x is string => Boolean(x)))
  return [...bookings.map(bookingToAgendaEvent), ...calls.filter((c) => !linked.has(c.id)).map(callToAgendaEvent)]
}

export function eventStatus(e: AgendaEvent): BookingStatus {
  if (e.kind === 'booking') return e.booking.status
  switch (e.call.outcome) {
    case 'done':
      return 'completed'
    case 'cancelled':
      return 'cancelled'
    case 'no_show':
      return 'no_show'
    default:
      return 'confirmed'
  }
}

export const STATUS_META: Record<BookingStatus, { label: string; color: string; bg: string }> = {
  pending: { label: 'À confirmer', color: '#b45309', bg: '#fdf3e2' },
  confirmed: { label: 'Confirmé', color: '#1a7f4e', bg: '#e8f7ee' },
  completed: { label: 'Terminé', color: '#2563eb', bg: '#eaf2fe' },
  cancelled: { label: 'Annulé', color: '#d63447', bg: '#fceced' },
  no_show: { label: 'No-show', color: '#b45309', bg: '#fdf3e2' },
}

/* ─── Filters (sidebar of the web agenda) ───────────────────────────────── */

export interface AgendaFilters {
  /** Hidden ids (empty = everything visible, new calendars auto-visible). */
  hiddenCalendarIds: Set<string>
  hiddenGoogleAccountIds: Set<string>
  showPersonal: boolean
  showCalls: boolean
}

export function filterEvents(events: AgendaEvent[], f: AgendaFilters): AgendaEvent[] {
  return events.filter((ev) => {
    if (ev.kind === 'call') return f.showCalls
    const b = ev.booking
    if (b.source === 'google_sync' && b.google_account_id) {
      if (f.hiddenGoogleAccountIds.has(b.google_account_id)) return false
      return b.is_personal ? f.showPersonal : true
    }
    if (b.is_personal) return f.showPersonal
    if (b.calendar_id) return !f.hiddenCalendarIds.has(b.calendar_id)
    return true
  })
}

export function eventsForDay(events: AgendaEvent[], day: Date): AgendaEvent[] {
  return events.filter((ev) => isSameDay(new Date(ev.start), day))
}

/** Local events are all-day blocks when they start at 00:00 and last ≥ 1 day. */
export function isAllDay(ev: AgendaEvent): boolean {
  const d = new Date(ev.start)
  return d.getHours() === 0 && d.getMinutes() === 0 && ev.durationMinutes >= 1440
}

/* ─── Booking creation payload (same body as NewBookingModal) ───────────── */

export const BLOCKED_CALENDAR_VALUE = '__blocked__'

export interface BookingFormState {
  calendarId: string // BLOCKED_CALENDAR_VALUE or a booking_calendar id
  leadId: string | null
  leadName: string | null
  locationId: string
  title: string
  date: string
  time: string
  duration: number
  allDay: boolean
  allDayDays: number
  notes: string
  color: string | null
  blocksAvailability: boolean
  recurrence: 'none' | 'daily' | 'weekly' | 'monthly'
  recurrenceCount: number
}

export function buildBookingPayload(s: BookingFormState): Record<string, unknown> {
  const isBlocked = s.calendarId === BLOCKED_CALENDAR_VALUE
  const time = s.allDay ? '00:00' : s.time
  const duration = s.allDay ? Math.max(1, s.allDayDays) * 1440 : s.duration
  const scheduledAt = localToIso(s.date, time)
  const recurrence = s.recurrence !== 'none' ? { recurrence: { frequency: s.recurrence, count: s.recurrenceCount } } : {}
  if (isBlocked) {
    return {
      is_personal: true,
      calendar_id: null,
      lead_id: null,
      location_id: null,
      title: s.title.trim() || 'Horaire bloqué',
      scheduled_at: scheduledAt,
      duration_minutes: duration,
      notes: s.notes || null,
      color: s.color,
      blocks_availability: s.blocksAvailability,
      ...recurrence,
    }
  }
  return {
    is_personal: false,
    calendar_id: s.calendarId || null,
    lead_id: s.leadId,
    location_id: s.locationId || null,
    title: s.title.trim() || s.leadName || 'Rendez-vous',
    scheduled_at: scheduledAt,
    duration_minutes: duration,
    notes: s.notes || null,
    color: s.color,
    blocks_availability: s.blocksAvailability,
    ...recurrence,
  }
}

/** Same 8 colors as src/lib/agenda/color-palette.ts. */
export const BOOKING_COLOR_PALETTE: { hex: string; label: string }[] = [
  { hex: '#3b82f6', label: 'Bleu' },
  { hex: '#10b981', label: 'Vert' },
  { hex: '#f59e0b', label: 'Orange' },
  { hex: '#ef4444', label: 'Rouge' },
  { hex: '#a855f7', label: 'Violet' },
  { hex: '#ec4899', label: 'Rose' },
  { hex: '#06b6d4', label: 'Cyan' },
  { hex: '#6b7280', label: 'Gris' },
]

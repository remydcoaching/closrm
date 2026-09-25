import { describe, it, expect } from 'vitest'
import {
  BLOCKED_CALENDAR_VALUE,
  buildBookingPayload,
  computeOverlapLayout,
  eventToPosition,
  filterEvents,
  formatDuration,
  getDateRange,
  mergeEvents,
  navigate,
  snapToQuarter,
  startOfWeek,
  type BookingFormState,
} from '../agenda-utils'
import type { AgendaCall, BookingWithCalendar } from '../types'

function booking(o: Partial<BookingWithCalendar> = {}): BookingWithCalendar {
  return {
    id: 'b1', workspace_id: 'w', calendar_id: 'c1', lead_id: null, call_id: null, title: 'RDV',
    scheduled_at: new Date(2026, 8, 21, 10, 0).toISOString(), duration_minutes: 60, status: 'confirmed',
    source: 'manual', form_data: {}, notes: null, google_event_id: null, location_id: null, meet_url: null,
    is_personal: false, recurrence_group_id: null, color: null, blocks_availability: true, google_account_id: null,
    created_at: '', booking_calendar: { name: 'Découverte', color: '#10b981' }, lead: null, location: null, ...o,
  }
}

const call = (o: Partial<AgendaCall> = {}): AgendaCall => ({
  id: 'k1', lead_id: 'l1', type: 'closing', scheduled_at: new Date(2026, 8, 21, 14).toISOString(),
  outcome: 'pending', notes: null, duration_seconds: null, ...o,
})

describe('dates', () => {
  it('week starts on Monday', () => {
    const d = startOfWeek(new Date(2026, 8, 27)) // Sunday
    expect(d.getDay()).toBe(1)
    expect(d.getDate()).toBe(21)
  })
  it('ranges cover whole days', () => {
    const { start, end } = getDateRange('day', new Date(2026, 8, 25, 15))
    expect(start.getHours()).toBe(0)
    expect(end.getHours()).toBe(23)
  })
  it('navigates by month without overflow', () => {
    expect(navigate('month', new Date(2026, 0, 31), 1).getMonth()).toBe(1)
  })
  it('formats durations like the web', () => {
    expect(formatDuration(90)).toBe('1h30')
    expect(formatDuration(1440)).toBe('1 jour')
    expect(formatDuration(20)).toBe('20 min')
  })
})

describe('grid positioning', () => {
  it('maps 10:00 / 60 min to 64 px per hour', () => {
    const pos = eventToPosition(new Date(2026, 8, 21, 10).toISOString(), 60)
    expect(pos.top).toBe(640)
    expect(pos.height).toBe(62)
  })
  it('snaps to quarter hours', () => {
    expect(snapToQuarter(9.13)).toBe(9.25)
    expect(snapToQuarter(9.1)).toBe(9)
  })
  it('puts overlapping events side by side', () => {
    const at = (h: number) => new Date(2026, 8, 21, h).toISOString()
    const layout = computeOverlapLayout([
      { id: 'a', start: at(10), durationMinutes: 60 },
      { id: 'b', start: at(10), durationMinutes: 30 },
      { id: 'c', start: at(12), durationMinutes: 30 },
    ])
    expect(layout.get('a')).toEqual({ column: 0, groupSize: 2 })
    expect(layout.get('b')).toEqual({ column: 1, groupSize: 2 })
    expect(layout.get('c')).toEqual({ column: 0, groupSize: 1 })
  })
})

describe('events', () => {
  it('dedups calls already linked to a booking and resolves colors', () => {
    const evs = mergeEvents([booking({ call_id: 'k1' })], [call(), call({ id: 'k2' })])
    expect(evs.map((e) => e.id)).toEqual(['booking-b1', 'call-k2'])
    expect(evs[0].color).toBe('#10b981')
    expect(evs[1].color).toBe('#a855f7')
  })
  it('filters hidden calendars, personal and calls', () => {
    const evs = mergeEvents([booking(), booking({ id: 'b2', is_personal: true, calendar_id: null })], [call()])
    const out = filterEvents(evs, { hiddenCalendarIds: new Set(['c1']), hiddenGoogleAccountIds: new Set(), showPersonal: true, showCalls: false })
    expect(out.map((e) => e.id)).toEqual(['booking-b2'])
  })
})

describe('buildBookingPayload', () => {
  const base: BookingFormState = {
    calendarId: BLOCKED_CALENDAR_VALUE, leadId: null, leadName: null, locationId: '', title: '', date: '2026-09-25',
    time: '14:00', duration: 45, allDay: false, allDayDays: 1, notes: '', color: null, blocksAvailability: true,
    recurrence: 'none', recurrenceCount: 4,
  }
  it('blocked slot = personal booking with default title', () => {
    const p = buildBookingPayload(base)
    expect(p).toMatchObject({ is_personal: true, calendar_id: null, title: 'Horaire bloqué', duration_minutes: 45 })
    expect(p).not.toHaveProperty('recurrence')
  })
  it('calendar booking uses lead name, all-day and recurrence', () => {
    const p = buildBookingPayload({ ...base, calendarId: 'c1', leadId: 'l1', leadName: 'Jean Dupont', allDay: true, allDayDays: 2, recurrence: 'weekly' })
    expect(p).toMatchObject({ is_personal: false, calendar_id: 'c1', lead_id: 'l1', title: 'Jean Dupont', duration_minutes: 2880, recurrence: { frequency: 'weekly', count: 4 } })
    expect(new Date(p.scheduled_at as string).getHours()).toBe(0)
  })
})

import { describe, it, expect } from 'vitest'
import { buildActivity } from '../build-activity'
import type { Call, FollowUp, JourneyEvent } from '../types'

function call(overrides: Partial<Call> = {}): Call {
  return {
    id: 'call-1',
    workspace_id: 'ws-1',
    lead_id: 'lead-1',
    type: 'setting',
    scheduled_at: '2026-09-20T09:15:00Z',
    outcome: 'no_show',
    notes: null,
    attempt_number: 2,
    reached: false,
    duration_seconds: null,
    created_at: '2026-09-20T09:15:00Z',
    ...overrides,
  }
}

function followUp(overrides: Partial<FollowUp> = {}): FollowUp {
  return {
    id: 'fu-1',
    workspace_id: 'ws-1',
    lead_id: 'lead-1',
    reason: 'Relancer après le setting',
    scheduled_at: '2026-09-19T18:30:00Z',
    channel: 'instagram_dm',
    status: 'en_attente',
    notes: null,
    created_at: '2026-09-19T18:30:00Z',
    ...overrides,
  }
}

function journeyEvent(overrides: Partial<JourneyEvent> = {}): JourneyEvent {
  return {
    id: 'evt-1',
    event_type: 'instagram_like',
    metadata: { instagram_username: 'jeandupont' },
    funnel_page_id: null,
    funnel_page_name: null,
    created_at: '2026-09-20T10:42:00Z',
    ...overrides,
  }
}

describe('buildActivity', () => {
  it('merges calls, follow-ups and instagram journey events into one list', () => {
    const result = buildActivity([call()], [followUp()], [journeyEvent()])
    expect(result).toHaveLength(3)
  })

  it('sorts entries from most recent to oldest', () => {
    const result = buildActivity([call()], [followUp()], [journeyEvent()])
    const times = result.map((e) => new Date(e.at).getTime())
    expect(times).toEqual([...times].sort((a, b) => b - a))
  })

  it('ignores journey events that are not instagram or funnel related', () => {
    const result = buildActivity([], [], [journeyEvent({ event_type: 'video_play' })])
    expect(result).toHaveLength(0)
  })

  it('includes the attempt number in the call detail', () => {
    const result = buildActivity([call({ attempt_number: 3 })], [], [])
    expect(result[0].detail).toContain('#3')
  })

  it('returns an empty array when there is no activity at all', () => {
    expect(buildActivity([], [], [])).toEqual([])
  })
})

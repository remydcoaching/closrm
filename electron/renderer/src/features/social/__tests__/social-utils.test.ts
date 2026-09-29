import { describe, expect, it } from 'vitest'
import {
  classifyIntent,
  fmtCompact,
  getDefaultStep,
  getTransitionAction,
  hexToRgba,
  isStepComplete,
  mediaIdToShortcode,
  monthCells,
  normalizeGrid,
  periodRange,
  planPresetRange,
  planningWindow,
  replaceInGrid,
  timeAgo,
  weekKey,
} from '../social-utils'
import type { SocialPost } from '../types'

function slot(p: Partial<SocialPost>): SocialPost {
  return {
    id: 's1',
    workspace_id: 'w',
    title: null,
    media_urls: [],
    status: 'draft',
    scheduled_at: null,
    published_at: null,
    pillar_id: null,
    content_kind: 'post',
    production_status: 'idea',
    plan_date: null,
    slot_index: null,
    hook: null,
    monteur_id: null,
    rush_url: null,
    final_url: null,
    ...p,
  }
}

describe('classifyIntent', () => {
  it('detects buying intents in priority order', () => {
    expect(classifyIntent('On peut faire un appel demain ?')).toBe('rdv')
    expect(classifyIntent("C'est combien le coaching ?")).toBe('prix')
    expect(classifyIntent("J'aimerais plus d'infos sur le programme")).toBe('info')
    expect(classifyIntent('trop cher pour moi')).toBe('objection')
    expect(classifyIntent('Merci bravo')).toBe('fan')
    expect(classifyIntent('🔥🔥🔥')).toBe('spam')
    expect(classifyIntent(null)).toBe('neutre')
    expect(classifyIntent('ok')).toBe('neutre')
  })
})

describe('mediaIdToShortcode', () => {
  it('maps numeric ids and strips the user suffix', () => {
    expect(mediaIdToShortcode('0')).toBe('0')
    expect(mediaIdToShortcode('64')).toBe('BA')
    expect(mediaIdToShortcode('64_123')).toBe('BA')
    expect(mediaIdToShortcode('abc')).toBe('abc')
  })
})

describe('formatting', () => {
  it('fmtCompact', () => {
    expect(fmtCompact(999)).toBe('999')
    expect(fmtCompact(1500)).toBe('1.5K')
    expect(fmtCompact(2_000_000)).toBe('2M')
  })
  it('timeAgo', () => {
    const now = Date.parse('2026-01-10T12:00:00Z')
    expect(timeAgo('2026-01-10T11:30:00Z', now)).toBe('30min')
    expect(timeAgo('2026-01-10T09:00:00Z', now)).toBe('3h')
    expect(timeAgo('2026-01-08T12:00:00Z', now)).toBe('2j')
    expect(timeAgo(null, now)).toBe('')
  })
  it('hexToRgba', () => {
    expect(hexToRgba('#ff0000', 0.12)).toBe('rgba(255,0,0,0.12)')
  })
})

describe('slot stepper', () => {
  it('default step follows status', () => {
    expect(getDefaultStep(slot({ production_status: 'idea' }))).toBe('brief')
    expect(getDefaultStep(slot({ production_status: 'edited' }))).toBe('montage')
    expect(getDefaultStep(slot({ production_status: 'ready' }))).toBe('publication')
    expect(getDefaultStep(slot({ status: 'scheduled', production_status: 'idea' }))).toBe('publication')
  })
  it('completion + transitions', () => {
    expect(isStepComplete(slot({ hook: 'h', script: 's' }), 'brief')).toBe(true)
    expect(isStepComplete(slot({ hook: 'h' }), 'brief')).toBe(false)
    expect(getTransitionAction(slot({ production_status: 'to_film' }), 'brief')?.nextStatus).toBe('filmed')
    expect(getTransitionAction(slot({ production_status: 'edited', final_url: 'x' }), 'montage')?.nextStatus).toBe('ready')
    expect(getTransitionAction(slot({ production_status: 'ready', final_url: 'x' }), 'montage')).toBeNull()
  })
})

describe('dates', () => {
  const ref = new Date(2026, 8, 17) // Thu 17 Sept 2026
  it('periodRange / planPresetRange', () => {
    expect(periodRange('this_week', ref)).toEqual({ from: '2026-09-14', to: '2026-09-20' })
    expect(periodRange('this_month', ref)).toEqual({ from: '2026-09-01', to: '2026-09-30' })
    expect(periodRange('next_month', ref)).toEqual({ from: '2026-10-01', to: '2026-10-31' })
    expect(planPresetRange('next_week', ref)).toEqual({ start: '2026-09-17', end: '2026-09-23' })
  })
  it('weekKey / monthCells / planningWindow', () => {
    expect(weekKey('2026-09-17')).toBe('2026-09-14')
    const cells = monthCells(2026, 9)
    expect(cells).toHaveLength(42)
    expect(cells[0].key).toBe('2026-08-31')
    expect(cells[1]).toMatchObject({ key: '2026-09-01', inMonth: true })
    expect(planningWindow(2026, 12)).toEqual({ from: '2026-12-01', to: '2027-01-31' })
  })
})

describe('trame grids', () => {
  it('normalizes and replaces', () => {
    const g = normalizeGrid({ mon: ['a', 'b', 'c'] }, 2)
    expect(g.mon).toEqual(['a', 'b'])
    expect(g.sun).toEqual([null, null])
    expect(replaceInGrid(g, 'a', null).mon).toEqual([null, 'b'])
  })
})

import { describe, it, expect } from 'vitest'
import { statusEntry, sourceEntry, displayName, nextFollowUp } from '../status'

describe('statusEntry', () => {
  it('resolves known statuses to their real ClosRM web label/color', () => {
    expect(statusEntry('nouveau')).toMatchObject({ label: 'Nouveau' })
    expect(statusEntry('clos')).toMatchObject({ label: 'Closé ✅' })
    expect(statusEntry('dead')).toMatchObject({ label: 'Dead ❌' })
  })

  it('falls back to a neutral entry for an unrecognized status rather than throwing', () => {
    // @ts-expect-error deliberately testing an out-of-range value
    expect(statusEntry('unknown_status').label).toBe('unknown_status')
  })
})

describe('sourceEntry', () => {
  it('resolves known sources to their real ClosRM web label', () => {
    expect(sourceEntry('instagram_ads')).toMatchObject({ label: 'Instagram Ads' })
    expect(sourceEntry('manuel')).toMatchObject({ label: 'Manuel' })
  })
})

describe('displayName', () => {
  it('joins first and last name when both are present', () => {
    expect(displayName('Marie', 'Dupont', 'fallback')).toBe('Marie Dupont')
  })

  it('falls back when both names are empty', () => {
    expect(displayName('', '', 'marie_coach')).toBe('marie_coach')
  })

  it('trims a lone first or last name without a dangling space', () => {
    expect(displayName('Marie', '', 'fallback')).toBe('Marie')
    expect(displayName('', 'Dupont', 'fallback')).toBe('Dupont')
  })
})

describe('nextFollowUp', () => {
  it('returns the earliest pending (en_attente) follow-up', () => {
    const result = nextFollowUp([
      { status: 'en_attente', scheduled_at: '2026-09-25T10:00:00Z' },
      { status: 'en_attente', scheduled_at: '2026-09-21T10:00:00Z' },
      { status: 'fait', scheduled_at: '2026-09-20T10:00:00Z' },
    ])
    expect(result?.scheduled_at).toBe('2026-09-21T10:00:00Z')
  })

  it('returns null when there is no pending follow-up', () => {
    expect(nextFollowUp([{ status: 'fait', scheduled_at: '2026-09-20T10:00:00Z' }])).toBeNull()
  })

  it('returns null for an empty list', () => {
    expect(nextFollowUp([])).toBeNull()
  })
})

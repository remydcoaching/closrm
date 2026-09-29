import { describe, expect, it } from 'vitest'
import { confidenceLevel } from '../confidence'

const NOW = new Date('2026-09-25T00:00:00Z')
const base = { score: 85, totalInteractions: 12, distinctContentCount: 6, lastInteractionAt: '2026-09-20T00:00:00Z' }

describe('confidenceLevel (server)', () => {
  it('matches the desktop rules', () => {
    expect(confidenceLevel(base, NOW)).toBe('tres_eleve')
    expect(confidenceLevel({ ...base, score: 45 }, NOW)).toBe('moyen')
    expect(confidenceLevel({ ...base, totalInteractions: 0 }, NOW)).toBe('insuffisant')
    expect(confidenceLevel({ ...base, distinctContentCount: 1 }, NOW)).toBe('moyen')
    expect(confidenceLevel({ ...base, lastInteractionAt: '2026-06-01T00:00:00Z' }, NOW)).toBe('eleve')
  })
})

import { describe, it, expect } from 'vitest'
import { purchasePotential } from '../purchase-potential'
import type { EngagementScore } from '../types'

function score(overrides: Partial<EngagementScore> = {}): EngagementScore {
  return {
    score: 0,
    likesCount: 0,
    commentsCount: 0,
    dmCount: 0,
    mentionCount: 0,
    totalInteractions: 0,
    distinctContentCount: 0,
    firstInteractionAt: null,
    lastInteractionAt: null,
    signals: [],
    ...overrides,
  }
}

describe('purchasePotential', () => {
  it('is eleve for a closed or closing-planned lead regardless of score', () => {
    expect(purchasePotential({ status: 'clos' }, null)).toBe('eleve')
    expect(purchasePotential({ status: 'closing_planifie' }, score({ score: 0 }))).toBe('eleve')
  })

  it('is faible for a dead or disqualified lead even with a high score', () => {
    expect(purchasePotential({ status: 'dead' }, score({ score: 50 }))).toBe('faible')
    expect(purchasePotential({ status: 'pas_qualifie' }, score({ score: 50 }))).toBe('faible')
  })

  it('is eleve for an active lead with a high engagement score', () => {
    expect(purchasePotential({ status: 'nouveau' }, score({ score: 12 }))).toBe('eleve')
  })

  it('is moyen for an active lead with a medium engagement score', () => {
    expect(purchasePotential({ status: 'nouveau' }, score({ score: 5 }))).toBe('moyen')
  })

  it('is faible for an active lead with no meaningful engagement', () => {
    expect(purchasePotential({ status: 'nouveau' }, score({ score: 0 }))).toBe('faible')
    expect(purchasePotential({ status: 'nouveau' }, null)).toBe('faible')
  })
})

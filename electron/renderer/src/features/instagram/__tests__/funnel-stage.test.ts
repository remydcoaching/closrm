import { describe, it, expect } from 'vitest'
import { funnelStage } from '../funnel-stage'

describe('funnelStage', () => {
  it('classifies a low engagement rate as haut de tunnel (broad, cold reach)', () => {
    expect(funnelStage(0.005)).toBe('haut')
    expect(funnelStage(0)).toBe('haut')
  })

  it('classifies a mid engagement rate as milieu de tunnel', () => {
    expect(funnelStage(0.02)).toBe('milieu')
  })

  it('classifies a high engagement rate as bas de tunnel (warm, converting audience)', () => {
    expect(funnelStage(0.05)).toBe('bas')
  })

  it('is deterministic at the exact threshold boundaries', () => {
    expect(funnelStage(0.04)).toBe('bas')
    expect(funnelStage(0.015)).toBe('milieu')
    expect(funnelStage(0.0149)).toBe('haut')
  })
})

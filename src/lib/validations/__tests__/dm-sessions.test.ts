import { describe, it, expect } from 'vitest'
import { createDmSessionSchema, updateDmSessionItemSchema } from '../dm-sessions'

describe('createDmSessionSchema', () => {
  it('accepts a valid target_count and defaults stale_threshold_days to 30', () => {
    const result = createDmSessionSchema.parse({ target_count: 30 })
    expect(result).toEqual({ target_count: 30, stale_threshold_days: 30 })
  })

  it('rejects a target_count of 0', () => {
    expect(() => createDmSessionSchema.parse({ target_count: 0 })).toThrow()
  })
})

describe('updateDmSessionItemSchema', () => {
  it('accepts a relaunched outcome with a delay and note', () => {
    const result = updateDmSessionItemSchema.parse({
      outcome: 'relaunched',
      delay_days: 7,
      note: 'A dit revenir en septembre',
    })
    expect(result.outcome).toBe('relaunched')
  })

  it('rejects an unknown outcome value', () => {
    expect(() => updateDmSessionItemSchema.parse({ outcome: 'ghosted' })).toThrow()
  })

  it('accepts the replied outcome', () => {
    const result = updateDmSessionItemSchema.parse({ outcome: 'replied' })
    expect(result.outcome).toBe('replied')
  })
})

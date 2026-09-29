import { describe, it, expect } from 'vitest'
import { startDiscoverySchema } from '../hiker'

describe('startDiscoverySchema (Phase 3.5 point 9 — endpoint payload validation)', () => {
  it('accepts a valid username with no options', () => {
    const result = startDiscoverySchema.safeParse({ instagramUsername: 'test_hiker_user' })
    expect(result.success).toBe(true)
  })

  it('accepts a valid username with options', () => {
    const result = startDiscoverySchema.safeParse({
      instagramUsername: 'test_hiker_user',
      options: { maxContentsForInteractions: 25 },
    })
    expect(result.success).toBe(true)
  })

  it('rejects an empty username', () => {
    const result = startDiscoverySchema.safeParse({ instagramUsername: '' })
    expect(result.success).toBe(false)
  })

  it('rejects a missing username field entirely', () => {
    const result = startDiscoverySchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('rejects a username with invalid characters (path traversal / injection attempt)', () => {
    const result = startDiscoverySchema.safeParse({ instagramUsername: '../../etc/passwd' })
    expect(result.success).toBe(false)
  })

  it('rejects a username with spaces', () => {
    const result = startDiscoverySchema.safeParse({ instagramUsername: 'not a username' })
    expect(result.success).toBe(false)
  })

  it('rejects a username longer than Instagram allows', () => {
    const result = startDiscoverySchema.safeParse({ instagramUsername: 'a'.repeat(31) })
    expect(result.success).toBe(false)
  })

  it('rejects a negative or absurd maxContentsForInteractions option', () => {
    const negative = startDiscoverySchema.safeParse({ instagramUsername: 'x', options: { maxContentsForInteractions: -1 } })
    const tooLarge = startDiscoverySchema.safeParse({ instagramUsername: 'x', options: { maxContentsForInteractions: 999999 } })
    expect(negative.success).toBe(false)
    expect(tooLarge.success).toBe(false)
  })

  it('rejects an entirely invalid payload shape (e.g. a bare string)', () => {
    const result = startDiscoverySchema.safeParse('test_hiker_user')
    expect(result.success).toBe(false)
  })
})

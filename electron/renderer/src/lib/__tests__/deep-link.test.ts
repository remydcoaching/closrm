import { describe, it, expect } from 'vitest'
import { extractAuthCode } from '../deep-link'

describe('extractAuthCode', () => {
  it('extracts the code param from a valid closrm:// deep link', () => {
    expect(extractAuthCode('closrm://auth-callback?code=abc123')).toBe('abc123')
  })

  it('returns null when no code param is present', () => {
    expect(extractAuthCode('closrm://auth-callback')).toBeNull()
  })

  it('returns null for a malformed URL rather than throwing', () => {
    expect(extractAuthCode('not-a-url')).toBeNull()
  })

  it('extracts the code even with additional query params present', () => {
    expect(extractAuthCode('closrm://auth-callback?state=xyz&code=def456')).toBe('def456')
  })

  it('never returns a value for other sensitive params as if they were the code', () => {
    // Guards against a future regression that might read the wrong param.
    expect(extractAuthCode('closrm://auth-callback?access_token=should-not-be-read')).toBeNull()
  })
})

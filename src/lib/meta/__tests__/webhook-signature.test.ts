import { describe, expect, it } from 'vitest'
import { createHmac } from 'crypto'
import { verifyMetaSignature } from '../webhook-signature'

const sign = (body: string, secret: string) => 'sha256=' + createHmac('sha256', secret).update(body).digest('hex')

describe('verifyMetaSignature', () => {
  it('accepts the right signature only', () => {
    const body = '{"object":"page"}'
    expect(verifyMetaSignature(body, sign(body, 's3cret'), 's3cret')).toBe(true)
    expect(verifyMetaSignature(body, sign(body, 'other'), 's3cret')).toBe(false)
    expect(verifyMetaSignature(body + ' ', sign(body, 's3cret'), 's3cret')).toBe(false)
    expect(verifyMetaSignature(body, null, 's3cret')).toBe(false)
    expect(verifyMetaSignature(body, 'sha256=short', 's3cret')).toBe(false)
  })
  it('no secret configured (local dev): not verified', () => expect(verifyMetaSignature('x', null, '')).toBe(true))
})

import { describe, expect, it } from 'vitest'
import { allowedOrigins, metaCallbackUrl, resolveAppOrigin } from '../oauth-origin'
import { isInvalidTokenPayload, MetaTokenInvalidError, throwGraphError } from '../token-error'

const prod = { NEXT_PUBLIC_APP_URL: 'https://closrm.vercel.app', NODE_ENV: 'production' } as unknown as NodeJS.ProcessEnv

describe('Meta login return address', () => {
  it('returns to the address the coach started from (closrm.fr), not NEXT_PUBLIC_APP_URL', () => {
    expect(resolveAppOrigin('https://closrm.fr', prod)).toBe('https://closrm.fr')
    expect(metaCallbackUrl(resolveAppOrigin('https://closrm.fr', prod))).toBe('https://closrm.fr/api/integrations/meta/callback')
  })
  it('keeps working on the Vercel address', () => {
    expect(resolveAppOrigin('https://closrm.vercel.app', prod)).toBe('https://closrm.vercel.app')
  })
  it('never follows an unknown Host header (falls back to NEXT_PUBLIC_APP_URL)', () => {
    expect(resolveAppOrigin('https://evil.example', prod)).toBe('https://closrm.vercel.app')
    expect(resolveAppOrigin(null, prod)).toBe('https://closrm.vercel.app')
  })
  it('accepts a full callback URL (the cookie) and extra origins from APP_ORIGINS', () => {
    expect(resolveAppOrigin('https://closrm.fr/api/integrations/meta/callback', prod)).toBe('https://closrm.fr')
    const env = { ...prod, APP_ORIGINS: 'https://app.closrm.io' } as NodeJS.ProcessEnv
    expect(resolveAppOrigin('https://app.closrm.io', env)).toBe('https://app.closrm.io')
  })
  it('localhost only outside production', () => {
    expect(allowedOrigins(prod)).not.toContain('http://localhost:3000')
    expect(allowedOrigins({ NEXT_PUBLIC_APP_URL: 'http://localhost:3000', NODE_ENV: 'development' } as unknown as NodeJS.ProcessEnv)).toContain('http://localhost:3000')
  })
})

describe('dead Meta token detection', () => {
  const dead = { error: { message: 'Error validating access token: The session has been invalidated because the user changed their password', code: 190, error_subcode: 460 } }
  it('recognises error 190 (password changed, expired, revoked)', () => {
    expect(isInvalidTokenPayload(dead)).toBe(true)
    expect(isInvalidTokenPayload({ error: { code: 4, message: 'rate limit' } })).toBe(false)
    expect(isInvalidTokenPayload(null)).toBe(false)
  })
  it('throwGraphError raises MetaTokenInvalidError for 190, a plain Error otherwise', async () => {
    await expect(throwGraphError(new Response(JSON.stringify(dead), { status: 400 }), 'x')).rejects.toBeInstanceOf(MetaTokenInvalidError)
    const other = throwGraphError(new Response(JSON.stringify({ error: { code: 100, message: 'bad field' } }), { status: 400 }), 'IG media fetch')
    await expect(other).rejects.not.toBeInstanceOf(MetaTokenInvalidError)
    await expect(throwGraphError(new Response('{}', { status: 500 }), 'IG media fetch')).rejects.toThrow('IG media fetch failed: 500')
  })
})

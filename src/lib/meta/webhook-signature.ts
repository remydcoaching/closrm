// Meta signs every webhook POST with the app secret (X-Hub-Signature-256:
// sha256=<hmac of the raw body>). Without the check, anyone could post fake
// lead or message events to our endpoints.
import { createHmac, timingSafeEqual } from 'crypto'

export function verifyMetaSignature(rawBody: string, signature: string | null, secret = process.env.META_APP_SECRET): boolean {
  // Not configured (local dev): nothing to verify against.
  if (!secret) return true
  if (!signature?.startsWith('sha256=')) return false
  const expected = Buffer.from('sha256=' + createHmac('sha256', secret).update(rawBody).digest('hex'))
  const given = Buffer.from(signature)
  return expected.length === given.length && timingSafeEqual(expected, given)
}

/**
 * Email unsubscribe token generation & verification.
 * Uses HMAC-SHA256 to sign tokens (no external JWT dependency needed).
 */

import { createHmac } from 'crypto'

function getSecret(): string {
  const secret = process.env.RESEND_API_KEY // reuse as signing secret
  if (!secret) throw new Error('RESEND_API_KEY is not set (used for unsubscribe token signing)')
  return secret
}

interface UnsubscribePayload {
  leadId: string
  workspaceId: string
}

/**
 * Generate a signed unsubscribe token encoding lead_id + workspace_id.
 * Format: base64(payload).base64(signature)
 */
export function generateUnsubscribeToken(payload: UnsubscribePayload): string {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = createHmac('sha256', getSecret()).update(data).digest('base64url')
  return `${data}.${signature}`
}

/**
 * Verify and decode an unsubscribe token.
 * Returns the payload if valid, null if tampered.
 */
export function verifyUnsubscribeToken(token: string): UnsubscribePayload | null {
  const parts = token.split('.')
  if (parts.length !== 2) return null

  const [data, signature] = parts
  const expected = createHmac('sha256', getSecret()).update(data).digest('base64url')

  if (signature !== expected) return null

  try {
    const decoded = JSON.parse(Buffer.from(data, 'base64url').toString())
    if (!decoded.leadId || !decoded.workspaceId) return null
    return decoded as UnsubscribePayload
  } catch {
    return null
  }
}

/**
 * Build the full unsubscribe URL for an email.
 */
export function buildUnsubscribeUrl(leadId: string, workspaceId: string): string {
  const token = generateUnsubscribeToken({ leadId, workspaceId })
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return `${baseUrl}/unsubscribe?token=${token}`
}

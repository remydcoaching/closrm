/**
 * Resend Domains API wrapper.
 * Manages custom email domains for workspaces.
 */

const RESEND_API = 'https://api.resend.com'

interface ResendDomainResponse {
  id: string
  name: string
  status: string
  records: Array<{
    record: string
    name: string
    type: string
    ttl: string
    value: string
    priority?: number
    status: string
  }>
  created_at: string
}

function getApiKey(): string {
  const key = process.env.RESEND_API_KEY
  if (!key) throw new Error('RESEND_API_KEY is not set')
  return key
}

function headers() {
  return {
    Authorization: `Bearer ${getApiKey()}`,
    'Content-Type': 'application/json',
  }
}

export async function createDomain(domain: string): Promise<{
  ok: boolean
  domain?: ResendDomainResponse
  error?: string
}> {
  const res = await fetch(`${RESEND_API}/domains`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ name: domain }),
  })

  const data = await res.json()
  if (!res.ok) {
    return { ok: false, error: data.message || 'Failed to create domain' }
  }
  return { ok: true, domain: data }
}

export async function verifyDomain(resendDomainId: string): Promise<{
  ok: boolean
  domain?: ResendDomainResponse
  error?: string
}> {
  // First trigger verification
  const verifyRes = await fetch(`${RESEND_API}/domains/${resendDomainId}/verify`, {
    method: 'POST',
    headers: headers(),
  })

  if (!verifyRes.ok) {
    const data = await verifyRes.json()
    return { ok: false, error: data.message || 'Failed to verify domain' }
  }

  // Then fetch updated status
  const res = await fetch(`${RESEND_API}/domains/${resendDomainId}`, {
    method: 'GET',
    headers: headers(),
  })

  const data = await res.json()
  if (!res.ok) {
    return { ok: false, error: data.message || 'Failed to fetch domain status' }
  }
  return { ok: true, domain: data }
}

export async function getDomain(resendDomainId: string): Promise<{
  ok: boolean
  domain?: ResendDomainResponse
  error?: string
}> {
  const res = await fetch(`${RESEND_API}/domains/${resendDomainId}`, {
    method: 'GET',
    headers: headers(),
  })

  const data = await res.json()
  if (!res.ok) {
    return { ok: false, error: data.message || 'Failed to fetch domain' }
  }
  return { ok: true, domain: data }
}

export async function deleteDomain(resendDomainId: string): Promise<{
  ok: boolean
  error?: string
}> {
  const res = await fetch(`${RESEND_API}/domains/${resendDomainId}`, {
    method: 'DELETE',
    headers: headers(),
  })

  if (!res.ok) {
    const data = await res.json()
    return { ok: false, error: data.message || 'Failed to delete domain' }
  }
  return { ok: true }
}

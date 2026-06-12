/**
 * Meta Conversions API (CAPI) sender.
 *
 * Sends server-to-server events to Meta so the ads algo can optimize for
 * lead quality (qualified / closed) instead of raw lead volume. Required
 * because the browser pixel doesn't fire on offline CRM status changes.
 *
 * Docs: https://developers.facebook.com/docs/marketing-api/conversions-api
 */

import { createHash } from 'crypto'
import { decrypt } from '@/lib/meta/encryption'
import type { MetaCredentials } from '@/lib/meta/client'

const GRAPH_URL = 'https://graph.facebook.com/v18.0'

export interface CapiUserData {
  email?: string | null
  phone?: string | null
  first_name?: string | null
  last_name?: string | null
  external_id?: string | null
  client_ip_address?: string | null
  client_user_agent?: string | null
  fbc?: string | null // _fbc cookie value or constructed from fbclid
  fbp?: string | null // _fbp cookie value
}

export interface CapiCustomData {
  value?: number | null
  currency?: string | null
  content_name?: string | null
  content_category?: string | null
  status?: string | null
  lead_event_source?: string | null
  // Custom flat fields are allowed too
  [key: string]: unknown
}

export interface CapiEvent {
  event_name: string
  event_time: number // unix seconds
  event_id?: string // for dedup with browser pixel
  event_source_url?: string
  action_source: 'system_generated' | 'website' | 'phone_call' | 'chat' | 'email' | 'other'
  user_data: CapiUserData
  custom_data?: CapiCustomData
}

export interface CapiSendResult {
  success: boolean
  events_received?: number
  error?: string
  fbtrace_id?: string
}

/**
 * Normalize a value before SHA-256 hashing per Meta's requirements.
 * - lowercase + trim for text
 * - strip non-digits for phone (E.164-style)
 */
function normalizeForHash(value: string, kind: 'email' | 'phone' | 'name'): string {
  const v = value.trim().toLowerCase()
  if (kind === 'phone') return v.replace(/[^\d]/g, '')
  return v
}

function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

/**
 * Build the user_data block with all known fields hashed.
 * Meta requires SHA-256 hex for PII (email, phone, names) but NOT for
 * client_ip_address, client_user_agent, fbc, fbp.
 */
function buildHashedUserData(input: CapiUserData): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {}

  if (input.email) {
    out.em = sha256Hex(normalizeForHash(input.email, 'email'))
  }
  if (input.phone) {
    const phone = normalizeForHash(input.phone, 'phone')
    if (phone) out.ph = sha256Hex(phone)
  }
  if (input.first_name) {
    out.fn = sha256Hex(normalizeForHash(input.first_name, 'name'))
  }
  if (input.last_name) {
    out.ln = sha256Hex(normalizeForHash(input.last_name, 'name'))
  }
  if (input.external_id) {
    // external_id is hashed too per Meta spec
    out.external_id = sha256Hex(input.external_id.trim().toLowerCase())
  }
  if (input.client_ip_address) out.client_ip_address = input.client_ip_address
  if (input.client_user_agent) out.client_user_agent = input.client_user_agent
  if (input.fbc) out.fbc = input.fbc
  if (input.fbp) out.fbp = input.fbp

  return out
}

interface MetaIntegrationRow {
  credentials_encrypted: string | null
  is_active: boolean | null
  capi_enabled: boolean | null
}

/**
 * Send one CAPI event for a workspace. Returns success/false without
 * throwing — callers can fire-and-forget.
 *
 * The pixel is provided by the caller because it lives on `funnels`
 * (per-funnel), not on the workspace integration. Use
 * `resolveMetaPixelForLead` to derive it from a lead.
 *
 * No-ops cleanly when:
 *   - Meta integration is not connected / disabled
 *   - pixelId is empty
 *   - credentials are missing or undecryptable
 */
export async function sendCapiEvent(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  workspaceId: string,
  pixelId: string,
  event: CapiEvent,
): Promise<CapiSendResult> {
  if (!pixelId) {
    return { success: false, error: 'pixel_not_configured' }
  }

  const { data: integration } = await supabase
    .from('integrations')
    .select('credentials_encrypted, is_active, capi_enabled')
    .eq('workspace_id', workspaceId)
    .eq('type', 'meta')
    .maybeSingle() as { data: MetaIntegrationRow | null }

  if (!integration || !integration.is_active) {
    return { success: false, error: 'meta_not_connected' }
  }
  // Workspace-level kill switch. Coach can disable the server-side relay
  // from /parametres/integrations while keeping the browser pixel live.
  if (integration.capi_enabled === false) {
    return { success: false, error: 'capi_disabled' }
  }
  if (!integration.credentials_encrypted) {
    return { success: false, error: 'credentials_missing' }
  }

  let creds: MetaCredentials
  try {
    creds = JSON.parse(decrypt(integration.credentials_encrypted))
  } catch (err) {
    console.error('[capi] failed to decrypt Meta credentials', err)
    return { success: false, error: 'credentials_decrypt_failed' }
  }

  const payload = {
    data: [
      {
        event_name: event.event_name,
        event_time: event.event_time,
        event_id: event.event_id,
        event_source_url: event.event_source_url,
        action_source: event.action_source,
        user_data: buildHashedUserData(event.user_data),
        custom_data: event.custom_data ?? {},
      },
    ],
    // In dev you can set META_CAPI_TEST_EVENT_CODE to route to Meta's
    // Test Events tab in Events Manager without touching the algo.
    ...(process.env.META_CAPI_TEST_EVENT_CODE
      ? { test_event_code: process.env.META_CAPI_TEST_EVENT_CODE }
      : {}),
  }

  const url = `${GRAPH_URL}/${pixelId}/events?access_token=${encodeURIComponent(creds.user_access_token)}`

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = (await res.json().catch(() => null)) as
      | { events_received?: number; error?: { message: string; fbtrace_id?: string } }
      | null

    if (!res.ok) {
      const errMsg = json?.error?.message ?? `HTTP ${res.status}`
      console.error('[capi] Meta rejected event', {
        event: event.event_name,
        pixel: pixelId,
        error: errMsg,
        fbtrace_id: json?.error?.fbtrace_id,
      })
      return { success: false, error: errMsg, fbtrace_id: json?.error?.fbtrace_id }
    }

    return {
      success: true,
      events_received: json?.events_received ?? 1,
    }
  } catch (err) {
    console.error('[capi] network error sending event', err)
    return { success: false, error: err instanceof Error ? err.message : 'network_error' }
  }
}

/**
 * Convenience wrapper: build a CapiEvent from a lead row and send it.
 * Caller provides only the event_name + optional custom_data overrides.
 */
export async function sendCapiEventForLead(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  workspaceId: string,
  pixelId: string,
  lead: {
    id: string
    first_name: string | null
    last_name: string | null
    email: string | null
    phone: string | null
  },
  eventName: string,
  customData: CapiCustomData = {},
): Promise<CapiSendResult> {
  const event: CapiEvent = {
    event_name: eventName,
    event_time: Math.floor(Date.now() / 1000),
    event_id: `lead-${lead.id}-${eventName}-${Date.now()}`,
    action_source: 'system_generated',
    user_data: {
      email: lead.email,
      phone: lead.phone,
      first_name: lead.first_name,
      last_name: lead.last_name,
      external_id: lead.id,
    },
    custom_data: customData,
  }

  return sendCapiEvent(supabase, workspaceId, pixelId, event)
}

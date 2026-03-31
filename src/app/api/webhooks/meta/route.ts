import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { decrypt } from '@/lib/meta/encryption'
import { getLeadData, parseLeadFields, type MetaCredentials } from '@/lib/meta/client'

// ─── GET : webhook verification ──────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 })
  }

  return new NextResponse('Forbidden', { status: 403 })
}

// ─── POST : lead events ───────────────────────────────────────────────────────

interface LeadgenChange {
  value: {
    form_id: string
    leadgen_id: string
    created_time: number
    page_id: string
    ad_id?: string
    adset_id?: string
    campaign_id?: string
  }
  field: 'leadgen'
}

interface WebhookEntry {
  id: string
  time: number
  changes: LeadgenChange[]
}

interface WebhookPayload {
  object: string
  entry: WebhookEntry[]
}

export async function POST(request: NextRequest) {
  let payload: WebhookPayload

  try {
    payload = await request.json()
  } catch {
    return new NextResponse('Bad Request', { status: 400 })
  }

  if (payload.object !== 'page') {
    return new NextResponse('OK', { status: 200 })
  }

  const supabase = createServiceClient()

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== 'leadgen') continue

      const { page_id, leadgen_id, ad_id, adset_id, campaign_id } = change.value

      try {
        // 1. Find the workspace for this page
        const { data: integration } = await supabase
          .from('integrations')
          .select('workspace_id, credentials_encrypted')
          .eq('type', 'meta')
          .eq('is_active', true)
          .eq('meta_page_id', page_id)
          .maybeSingle()

        if (!integration?.credentials_encrypted) {
          console.warn(`No active Meta integration for page_id=${page_id}`)
          continue
        }

        const creds: MetaCredentials = JSON.parse(decrypt(integration.credentials_encrypted))

        // 2. Fetch lead data from Meta
        const leadData = await getLeadData(leadgen_id, creds.page_access_token)
        const parsed = parseLeadFields(leadData.field_data)

        // 3. Insert lead into database
        const { error } = await supabase
          .from('leads')
          .insert({
            workspace_id: integration.workspace_id,
            first_name: parsed.first_name,
            last_name: parsed.last_name,
            phone: parsed.phone ?? '',
            email: parsed.email,
            status: 'nouveau',
            source: 'facebook_ads',
            tags: [],
            call_attempts: 0,
            reached: false,
            meta_campaign_id: campaign_id ?? null,
            meta_adset_id: adset_id ?? null,
            meta_ad_id: ad_id ?? null,
          })

        if (error) {
          console.error('Failed to insert Meta lead:', error)
        }
      } catch (err) {
        console.error(`Error processing leadgen_id=${leadgen_id}:`, err)
        // Don't fail the response — Meta only retries on HTTP errors
      }
    }
  }

  return new NextResponse('OK', { status: 200 })
}

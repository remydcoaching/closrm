import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { decrypt } from '@/lib/meta/encryption'
import { getLeadData, parseLeadFields, type MetaCredentials } from '@/lib/meta/client'
import { findExistingLeadId } from '@/lib/leads/identity'

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

        // Build full answers map (incl. custom Meta lead form questions)
        // and a human-readable summary of the custom-only ones for `notes`.
        const STANDARD_KEYS = new Set([
          'first_name', 'prenom', 'prénom',
          'last_name', 'nom', 'family_name', 'full_name',
          'email', 'email_address',
          'phone', 'phone_number', 'mobile_phone', 'telephone',
        ])
        const fullAnswers: Record<string, string> = {}
        const customAnswers: Record<string, string> = {}
        for (const f of leadData.field_data ?? []) {
          const key = f.name
          const value = (f.values?.[0] ?? '').trim()
          if (!value) continue
          fullAnswers[key] = value
          if (!STANDARD_KEYS.has(key.toLowerCase())) {
            customAnswers[key] = value
          }
        }
        const customNotes = Object.entries(customAnswers)
          .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`)
          .join('\n')
        const notesBlock = customNotes
          ? `[Lead form Meta — ${new Date().toLocaleDateString('fr-FR')}]\n${customNotes}`
          : null

        // 3. Dedup: look for an existing lead in this workspace by normalized
        //    email then phone. If found, enrich it instead of creating a duplicate.
        const existingLeadId = await findExistingLeadId(supabase, integration.workspace_id, {
          email: parsed.email,
          phone: parsed.phone || null,
        })

        if (existingLeadId) {
          // Update only the fields we have new info on. Append notes instead of
          // overwriting; keep existing source/tags untouched.
          const { data: existing } = await supabase
            .from('leads')
            .select('notes, form_answers, meta_campaign_id, meta_adset_id, meta_ad_id')
            .eq('id', existingLeadId)
            .single()

          const mergedAnswers = {
            ...((existing?.form_answers as Record<string, string> | null) ?? {}),
            ...fullAnswers,
          }
          const mergedNotes = notesBlock
            ? (existing?.notes ? `${existing.notes}\n\n${notesBlock}` : notesBlock)
            : existing?.notes ?? null

          const { error } = await supabase
            .from('leads')
            .update({
              form_answers: mergedAnswers,
              notes: mergedNotes,
              // Only fill Meta IDs if missing — don't overwrite first-touch attribution.
              meta_campaign_id: existing?.meta_campaign_id ?? campaign_id ?? null,
              meta_adset_id: existing?.meta_adset_id ?? adset_id ?? null,
              meta_ad_id: existing?.meta_ad_id ?? ad_id ?? null,
            })
            .eq('id', existingLeadId)

          if (error) {
            console.error('Failed to enrich existing Meta lead:', error)
          }
        } else {
          // 4. Insert a fresh lead.
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
              notes: notesBlock,
              form_answers: fullAnswers,
              meta_campaign_id: campaign_id ?? null,
              meta_adset_id: adset_id ?? null,
              meta_ad_id: ad_id ?? null,
            })

          if (error) {
            console.error('Failed to insert Meta lead:', error)
          }
        }
      } catch (err) {
        console.error(`Error processing leadgen_id=${leadgen_id}:`, err)
        // Don't fail the response — Meta only retries on HTTP errors
      }
    }
  }

  return new NextResponse('OK', { status: 200 })
}

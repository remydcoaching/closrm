import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { decrypt } from '@/lib/meta/encryption'
import { getLeadData, parseLeadFields, type MetaCredentials } from '@/lib/meta/client'
import { findExistingLeadId } from '@/lib/leads/identity'
import { planRevive } from '@/lib/leads/revive'
import { fireTriggersForEvent } from '@/lib/workflows/trigger'
import { sendPushToWorkspace } from '@/lib/push/send-to-workspace'

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

        // Build full answers map (incl. custom Meta lead form questions).
        // Avant on dupliquait les réponses dans `notes` sous forme texte —
        // supprimé car le bloc Parcours du lead les affiche déjà proprement
        // depuis `form_answers`. Évite des notes auto-générées en double.
        const fullAnswers: Record<string, string> = {}
        for (const f of leadData.field_data ?? []) {
          const key = f.name
          const value = (f.values?.[0] ?? '').trim()
          if (!value) continue
          fullAnswers[key] = value
        }

        // Distingue Facebook vs Instagram via le champ `platform` que Meta
        // expose au niveau du leadgen (renvoie "fb" ou "ig"). Sans ça tout
        // arrivait comme `facebook_ads` même si l'ad était vu sur Instagram.
        const leadSource: 'facebook_ads' | 'instagram_ads' =
          leadData.platform === 'ig' ? 'instagram_ads' : 'facebook_ads'

        // 3. Dedup: look for an existing lead in this workspace by normalized
        //    email then phone. If found, enrich it instead of creating a duplicate.
        const existingLeadId = await findExistingLeadId(supabase, integration.workspace_id, {
          email: parsed.email,
          phone: parsed.phone || null,
        })

        if (existingLeadId) {
          // Pull what we need for both the enrichment AND the revive
          // check (status / tags / notes / form_answers / Meta IDs).
          const { data: existing } = await supabase
            .from('leads')
            .select('status, tags, notes, first_name, last_name, form_answers, meta_campaign_id, meta_adset_id, meta_ad_id')
            .eq('id', existingLeadId)
            .single()

          const mergedAnswers = {
            ...((existing?.form_answers as Record<string, string> | null) ?? {}),
            ...fullAnswers,
          }

          const revive = planRevive(
            (existing?.status ?? 'nouveau'),
            (existing?.tags as string[] | null) ?? [],
            'meta_lead_form',
          )

          const updates: Record<string, unknown> = {
            form_answers: mergedAnswers,
            // Only fill Meta IDs if missing — don't overwrite first-touch attribution.
            meta_campaign_id: existing?.meta_campaign_id ?? campaign_id ?? null,
            meta_adset_id: existing?.meta_adset_id ?? adset_id ?? null,
            meta_ad_id: existing?.meta_ad_id ?? ad_id ?? null,
          }

          if (revive.shouldRevive) {
            updates.status = revive.newStatus
            updates.tags = revive.newTags
            updates.notes = (existing?.notes ?? '') + (revive.noteAppend ?? '')
            updates.reached = false
            updates.last_activity_at = new Date().toISOString()
          }

          const { error } = await supabase
            .from('leads')
            .update(updates)
            .eq('id', existingLeadId)

          if (error) {
            console.error('Failed to enrich existing Meta lead:', error)
          } else if (revive.shouldRevive) {
            // Treat the revived lead as a fresh inbound so the coach
            // gets the same notifications as for a brand new lead.
            fireTriggersForEvent(integration.workspace_id, 'new_lead', {
              lead_id: existingLeadId,
              source: leadSource,
            }).catch(() => {})

            const fullName = `${existing?.first_name ?? ''} ${existing?.last_name ?? ''}`.trim() || 'Lead'
            sendPushToWorkspace({
              workspaceId: integration.workspace_id,
              type: 'new_lead',
              title: '🔁 Lead relancé',
              body: `${fullName} vient de re-soumettre via Meta (anciennement perdu).`,
              data: { entity_type: 'lead', entity_id: existingLeadId },
            }).catch(() => {})
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
              source: leadSource,
              tags: [],
              call_attempts: 0,
              reached: false,
              notes: null,
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

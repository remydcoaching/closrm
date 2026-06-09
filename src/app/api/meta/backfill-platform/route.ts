import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { decrypt } from '@/lib/meta/encryption'
import type { MetaCredentials } from '@/lib/meta/client'

const GRAPH = 'https://graph.facebook.com/v21.0'

interface MetaLeadWithPlatform {
  id: string
  platform?: 'fb' | 'ig' | null
  created_time: string
  field_data?: { name: string; values: string[] }[]
}

/**
 * Backfill `lead.source` (facebook_ads vs instagram_ads) à partir du champ
 * `platform` de Meta. Pour les leads qu'on a importés avant qu'on demande
 * `platform` à Meta, tous étaient hardcodés en `facebook_ads`.
 *
 * Stratégie : pour chaque `meta_ad_id` distinct dans la fenêtre demandée,
 * on liste les leads de cette ad côté Meta (avec leur `platform`) et on
 * matche sur l'email pour mettre à jour la source.
 *
 * Usage : POST /api/meta/backfill-platform?days=7
 *   → traite les leads créés dans les N derniers jours (default 7, max 90).
 */
export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const daysParam = parseInt(request.nextUrl.searchParams.get('days') ?? '7', 10)
    const days = Math.min(Math.max(1, isNaN(daysParam) ? 7 : daysParam), 90)
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

    // 1. Récupère les leads candidats (source=facebook_ads, meta_ad_id non null)
    const { data: candidates, error: cErr } = await supabase
      .from('leads')
      .select('id, email, phone, meta_ad_id, source, created_at')
      .eq('workspace_id', workspaceId)
      .eq('source', 'facebook_ads')
      .not('meta_ad_id', 'is', null)
      .gte('created_at', since)

    if (cErr) {
      return NextResponse.json({ error: cErr.message }, { status: 500 })
    }

    if (!candidates || candidates.length === 0) {
      return NextResponse.json({ checked: 0, updated: 0, message: 'Aucun lead à backfiller.' })
    }

    // 2. Fetch Meta credentials
    const { data: integration } = await supabase
      .from('integrations')
      .select('credentials_encrypted, is_active')
      .eq('workspace_id', workspaceId)
      .eq('type', 'meta')
      .eq('is_active', true)
      .maybeSingle()

    if (!integration?.credentials_encrypted) {
      return NextResponse.json({ error: 'Intégration Meta non connectée.' }, { status: 400 })
    }
    const creds: MetaCredentials = JSON.parse(decrypt(integration.credentials_encrypted))

    // 3. Group by ad_id pour minimiser les appels Meta
    const byAdId = new Map<string, typeof candidates>()
    for (const c of candidates) {
      if (!c.meta_ad_id) continue
      const arr = byAdId.get(c.meta_ad_id) ?? []
      arr.push(c)
      byAdId.set(c.meta_ad_id, arr)
    }

    let checked = 0
    let updated = 0
    const errors: { ad_id: string; error: string }[] = []

    // Cache form_id → leads (un form peut servir plusieurs ads)
    const formLeadsCache = new Map<string, MetaLeadWithPlatform[]>()

    for (const [adId, leadsOfAd] of byAdId.entries()) {
      try {
        // Étape 1 : trouver le form_id de l'ad via son creative.
        // L'endpoint /{ad_id}/leads est gated derrière une perm que Meta ne
        // grant pas toujours. /{form_id}/leads est plus permissif (le page
        // token suffit + scope leads_retrieval).
        const adUrl = `${GRAPH}/${adId}?fields=creative{lead_gen_form{id}}&access_token=${creds.user_access_token}`
        const adRes = await fetch(adUrl)
        if (!adRes.ok) {
          const text = await adRes.text()
          errors.push({ ad_id: adId, error: `Meta ${adRes.status} (ad fetch): ${text.slice(0, 150)}` })
          continue
        }
        const adJson = await adRes.json() as {
          creative?: { lead_gen_form?: { id?: string } }
        }
        const formId = adJson.creative?.lead_gen_form?.id
        if (!formId) {
          errors.push({ ad_id: adId, error: 'Ad sans lead_gen_form rattaché.' })
          continue
        }

        // Étape 2 : récupère tous les leads du form (avec cache).
        let metaLeads = formLeadsCache.get(formId)
        if (!metaLeads) {
          const url = `${GRAPH}/${formId}/leads?fields=id,platform,created_time,field_data&limit=200&access_token=${creds.page_access_token}`
          const res = await fetch(url)
          if (!res.ok) {
            const text = await res.text()
            errors.push({ ad_id: adId, error: `Meta ${res.status} (form leads): ${text.slice(0, 150)}` })
            continue
          }
          const json: { data?: MetaLeadWithPlatform[] } = await res.json()
          metaLeads = json.data ?? []
          formLeadsCache.set(formId, metaLeads)
        }

        // Index par email (lowercase) pour match
        const byEmail = new Map<string, MetaLeadWithPlatform>()
        for (const ml of metaLeads) {
          const emailField = ml.field_data?.find((f) =>
            ['email', 'email_address'].includes(f.name.toLowerCase()),
          )
          const email = emailField?.values?.[0]?.toLowerCase().trim()
          if (email) byEmail.set(email, ml)
        }

        // Match + update
        for (const lead of leadsOfAd) {
          checked++
          const leadEmail = lead.email?.toLowerCase().trim()
          if (!leadEmail) continue
          const matched = byEmail.get(leadEmail)
          if (!matched) continue
          if (matched.platform === 'ig') {
            const { error: uErr } = await supabase
              .from('leads')
              .update({ source: 'instagram_ads' })
              .eq('id', lead.id)
              .eq('workspace_id', workspaceId)
            if (!uErr) updated++
          }
        }
      } catch (err) {
        errors.push({ ad_id: adId, error: err instanceof Error ? err.message : String(err) })
      }
    }

    return NextResponse.json({
      checked,
      updated,
      ads_processed: byAdId.size,
      errors,
      message: `Backfill terminé. ${updated} lead${updated > 1 ? 's' : ''} marqué${updated > 1 ? 's' : ''} comme Instagram.`,
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur', details: String(err) }, { status: 500 })
  }
}

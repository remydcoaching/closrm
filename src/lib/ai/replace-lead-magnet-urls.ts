import type { SupabaseClient } from '@supabase/supabase-js'
import type { LeadMagnet } from '@/types'
import { generateShortCode } from '@/lib/lead-magnets/shortcode'

interface Args {
  message: string
  leadId: string
  workspaceId: string
  leadMagnets: Pick<LeadMagnet, 'id' | 'url'>[]
  supabase: SupabaseClient
  appUrl: string
}

/**
 * Parcourt le message, détecte les URLs de lead_magnets,
 * remplace chacune par un short link trackable pour le lead donné.
 */
export async function replaceLeadMagnetUrls({
  message, leadId, workspaceId, leadMagnets, supabase, appUrl,
}: Args): Promise<string> {
  let out = message
  for (const lm of leadMagnets) {
    if (!lm.url || !out.includes(lm.url)) continue
    const shortCode = await ensureTrackedLink(supabase, workspaceId, lm.id, leadId)
    if (shortCode) {
      out = out.split(lm.url).join(`${appUrl}/c/${shortCode}`)
    }
  }
  return out
}

async function ensureTrackedLink(
  supabase: SupabaseClient,
  workspaceId: string,
  leadMagnetId: string,
  leadId: string,
): Promise<string | null> {
  const { data: existing } = await supabase
    .from('tracked_links')
    .select('short_code')
    .eq('lead_magnet_id', leadMagnetId)
    .eq('lead_id', leadId)
    .maybeSingle()
  if (existing) return existing.short_code

  for (let i = 0; i < 3; i++) {
    const short_code = generateShortCode()
    const { data, error } = await supabase
      .from('tracked_links')
      .insert({ workspace_id: workspaceId, lead_magnet_id: leadMagnetId, lead_id: leadId, short_code })
      .select('short_code')
      .single()
    if (!error && data) return data.short_code
    if (error?.code !== '23505') return null
  }
  return null
}

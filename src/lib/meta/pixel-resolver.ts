/**
 * Resolves the Meta Pixel ID to use for a given lead when sending a
 * server-side Conversions API event.
 *
 * Pixels live on the FUNNEL (cf. migration 083_funnel_meta_pixel.sql).
 * A lead can be attributed to a funnel via:
 *   1. A tag `funnel:<funnel_id>` set at form submission (funnel/f/submit)
 *   2. The lead's `visitor_id` (cookie) linking to `funnel_events` →
 *      `funnel_pages.funnel_id` → `funnels.meta_pixel_id`
 *
 * Returns null when neither route yields a pixel. Callers MUST treat
 * `null` as "skip CAPI gracefully", never as an error.
 */

interface LeadForPixelLookup {
  id?: string
  tags?: string[] | null
  visitor_id?: string | null
}

export async function resolveMetaPixelForLead(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  workspaceId: string,
  lead: LeadForPixelLookup,
): Promise<{ pixelId: string; funnelId: string } | null> {
  // ── Route 1: funnel:<id> tag ──────────────────────────────────────────
  const tags = Array.isArray(lead.tags) ? lead.tags : []
  for (const t of tags) {
    if (typeof t !== 'string') continue
    const match = t.match(/^funnel:([0-9a-fA-F-]{16,})$/)
    if (!match) continue
    const funnelId = match[1]
    const { data: funnel } = await supabase
      .from('funnels')
      .select('id, meta_pixel_id')
      .eq('id', funnelId)
      .eq('workspace_id', workspaceId)
      .maybeSingle() as { data: { id: string; meta_pixel_id: string | null } | null }
    if (funnel?.meta_pixel_id) {
      return { pixelId: funnel.meta_pixel_id, funnelId: funnel.id }
    }
  }

  // ── Route 2: visitor_id → funnel_events → funnel_pages → funnel ──────
  if (lead.visitor_id) {
    const { data: events } = await supabase
      .from('funnel_events')
      .select('funnel_page_id')
      .eq('workspace_id', workspaceId)
      .eq('visitor_id', lead.visitor_id)
      .not('funnel_page_id', 'is', null)
      .order('created_at', { ascending: true })
      .limit(1) as { data: Array<{ funnel_page_id: string }> | null }

    const firstPageId = events?.[0]?.funnel_page_id
    if (firstPageId) {
      const { data: page } = await supabase
        .from('funnel_pages')
        .select('funnel_id, funnels!inner(id, meta_pixel_id)')
        .eq('id', firstPageId)
        .maybeSingle() as { data: { funnel_id: string; funnels: { id: string; meta_pixel_id: string | null } | { id: string; meta_pixel_id: string | null }[] } | null }

      const funnelRow = Array.isArray(page?.funnels) ? page?.funnels?.[0] : page?.funnels
      if (funnelRow?.meta_pixel_id) {
        return { pixelId: funnelRow.meta_pixel_id, funnelId: funnelRow.id }
      }
    }
  }

  // ── Route 3: workspace-level fallback (integrations.meta_pixel_id) ────
  //  Used when the lead arrived via Meta Lead Form (no funnel) or the
  //  coach gave a direct /book/<ws>/<cal> link instead of a funnel.
  const { data: integration } = await supabase
    .from('integrations')
    .select('meta_pixel_id')
    .eq('workspace_id', workspaceId)
    .eq('type', 'meta')
    .maybeSingle() as { data: { meta_pixel_id: string | null } | null }

  if (integration?.meta_pixel_id) {
    return { pixelId: integration.meta_pixel_id, funnelId: '' }
  }

  return null
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'

/**
 * Audience analysis — segments leads that have Instagram engagement data
 * (from Ciblage scans and instagram_interactions) into groups a coach can
 * act on: actifs (recent interaction), ne vous suivent pas (observed via
 * discovery_profiles.follows_target = false), lurkers (interacted but never
 * contacted commercially). Everything here comes from real rows already
 * persisted — no live Instagram API call, no follower/story-view totals
 * ClosRM has no way to know without a fresh Hiker scan (those stay on the
 * lead's own instagram-signal endpoint, dated).
 */
export async function GET(_request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    // Leads with at least one real Instagram interaction on record.
    const { data: interactions } = await supabase
      .from('instagram_interactions')
      .select('lead_id, last_seen_at')
      .eq('workspace_id', workspaceId)

    const lastSeenByLead = new Map<string, string>()
    for (const row of interactions ?? []) {
      const prev = lastSeenByLead.get(row.lead_id)
      if (!prev || row.last_seen_at > prev) lastSeenByLead.set(row.lead_id, row.last_seen_at)
    }
    const engagedLeadIds = [...lastSeenByLead.keys()]
    if (engagedLeadIds.length === 0) {
      return NextResponse.json({ data: { actifs: 0, neVousSuiventPas: 0, lurkers: 0, totalEngaged: 0 } })
    }

    const { data: leads } = await supabase
      .from('leads')
      .select('id, status, last_activity_at, call_attempts')
      .eq('workspace_id', workspaceId)
      .in('id', engagedLeadIds)

    // "Vous suit" comes from the most recent discovery_profiles observation
    // per Instagram identity — not a live check.
    const { data: profiles } = await supabase
      .from('discovery_profiles')
      .select('matched_lead_id, follows_target, created_at')
      .eq('workspace_id', workspaceId)
      .not('matched_lead_id', 'is', null)
      .order('created_at', { ascending: false })

    const followsByLead = new Map<string, boolean>()
    for (const p of profiles ?? []) {
      if (p.matched_lead_id && !followsByLead.has(p.matched_lead_id)) {
        followsByLead.set(p.matched_lead_id, p.follows_target)
      }
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString()
    let actifs = 0
    let neVousSuiventPas = 0
    let lurkers = 0

    for (const lead of leads ?? []) {
      const lastSeen = lastSeenByLead.get(lead.id)
      if (lastSeen && lastSeen >= sevenDaysAgo) actifs += 1
      if (followsByLead.get(lead.id) === false) neVousSuiventPas += 1
      // Lurker: has engaged but never been called/contacted (call_attempts = 0).
      if ((lead.call_attempts ?? 0) === 0) lurkers += 1
    }

    return NextResponse.json({
      data: {
        actifs,
        neVousSuiventPas,
        lurkers,
        totalEngaged: engagedLeadIds.length,
      },
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

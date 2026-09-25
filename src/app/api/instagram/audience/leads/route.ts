import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'

type Segment = 'actifs' | 'ne_vous_suivent_pas' | 'lurkers'

/**
 * Lists the leads behind one audience segment (see /api/instagram/audience
 * for the counts) — same underlying data, just returned as rows instead of
 * a count so the coach can open a segment and see who's in it.
 */
export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const segment = (request.nextUrl.searchParams.get('segment') || 'actifs') as Segment

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
    if (engagedLeadIds.length === 0) return NextResponse.json({ data: [] })

    const { data: leads } = await supabase
      .from('leads')
      .select('id, first_name, last_name, instagram_handle, status, call_attempts, last_activity_at')
      .eq('workspace_id', workspaceId)
      .in('id', engagedLeadIds)

    let filtered = leads ?? []

    if (segment === 'actifs') {
      const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString()
      filtered = filtered.filter((l) => (lastSeenByLead.get(l.id) ?? '') >= sevenDaysAgo)
    } else if (segment === 'ne_vous_suivent_pas') {
      const { data: profiles } = await supabase
        .from('discovery_profiles')
        .select('matched_lead_id, follows_target, created_at')
        .eq('workspace_id', workspaceId)
        .not('matched_lead_id', 'is', null)
        .order('created_at', { ascending: false })
      const followsByLead = new Map<string, boolean>()
      for (const p of profiles ?? []) {
        if (p.matched_lead_id && !followsByLead.has(p.matched_lead_id)) followsByLead.set(p.matched_lead_id, p.follows_target)
      }
      filtered = filtered.filter((l) => followsByLead.get(l.id) === false)
    } else if (segment === 'lurkers') {
      filtered = filtered.filter((l) => (l.call_attempts ?? 0) === 0)
    }

    const rows = filtered
      .map((l) => ({ ...l, last_seen_at: lastSeenByLead.get(l.id) ?? null }))
      .sort((a, b) => (b.last_seen_at ?? '').localeCompare(a.last_seen_at ?? ''))

    return NextResponse.json({ data: rows })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

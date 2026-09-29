import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { segmentAudience } from '@/lib/instagram/audience-segments'
import { loadEngagedLeads, parsePeriodDays } from '@/lib/instagram/audience-data'

/**
 * Audience analysis — counts per segment (see
 * src/lib/instagram/audience-segments.ts for the definitions) over
 * `?period_days=` (default 7). Everything comes from rows already persisted
 * (instagram_interactions, discovery_profiles, leads, dm_session_items) —
 * no live Instagram call, nothing estimated.
 */
export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const periodDays = parsePeriodDays(request.nextUrl.searchParams.get('period_days'))
    const engaged = await loadEngagedLeads(supabase, workspaceId)
    return NextResponse.json({ data: { ...segmentAudience(engaged, periodDays), periodDays } })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

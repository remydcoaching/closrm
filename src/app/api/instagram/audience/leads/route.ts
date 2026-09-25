import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { AUDIENCE_SEGMENTS, inSegment, type AudienceSegment } from '@/lib/instagram/audience-segments'
import { loadEngagedLeads, parsePeriodDays } from '@/lib/instagram/audience-data'

/**
 * Leads behind one audience segment — same loader and same segment
 * definitions as GET /api/instagram/audience, so a card's figure always
 * equals the length of its list.
 */
export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const raw = request.nextUrl.searchParams.get('segment') || 'actifs'
    if (!AUDIENCE_SEGMENTS.includes(raw as AudienceSegment)) {
      return NextResponse.json({ error: 'Segment inconnu' }, { status: 400 })
    }
    const segment = raw as AudienceSegment
    const periodDays = parsePeriodDays(request.nextUrl.searchParams.get('period_days'))
    const now = new Date()

    const rows = (await loadEngagedLeads(supabase, workspaceId))
      .filter((l) => inSegment(l, segment, periodDays, now))
      .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt))
      .map((l) => ({
        id: l.id,
        first_name: l.first_name,
        last_name: l.last_name,
        instagram_handle: l.instagram_handle,
        instagram_profile_pic_url: l.instagram_profile_pic_url,
        status: l.status,
        call_attempts: l.callAttempts,
        follows_target: l.followsTarget,
        interactions_count: l.interactionsCount,
        last_seen_at: l.lastSeenAt,
      }))

    return NextResponse.json({ data: rows })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

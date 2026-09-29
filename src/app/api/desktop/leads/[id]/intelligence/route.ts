import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { loadLeadIntelligence } from '@/lib/leads/lead-intelligence'

/**
 * Lead page in one round-trip: lead + calls + follow-ups, journey, engagement
 * score (existing scorer) and the latest Instagram observation — loaded in
 * parallel. Server durations are returned in Server-Timing (no data in it).
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const result = await loadLeadIntelligence(supabase, workspaceId, id)
    if (!result) return NextResponse.json({ error: 'Lead introuvable' }, { status: 404 })
    const serverTiming = Object.entries(result.timings)
      .map(([k, v]) => `${k};dur=${v}`)
      .join(', ')
    return NextResponse.json({ data: result.data }, { headers: { 'Server-Timing': serverTiming } })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

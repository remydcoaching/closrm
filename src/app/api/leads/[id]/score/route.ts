import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { computeEngagementScore } from '@/lib/leads/engagement-score'

/**
 * Per-lead engagement score + the data-backed reasons behind it — reuses the
 * exact same scoring logic as GET /api/leads/hot (see
 * src/lib/leads/engagement-score.ts), just scoped to one lead instead of a
 * workspace-wide window. No second scoring system.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const result = await computeEngagementScore(supabase, workspaceId, id)

    if (!result) {
      return NextResponse.json({ error: 'Lead introuvable' }, { status: 404 })
    }

    return NextResponse.json({ data: result })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { loadInstagramSignal } from '@/lib/leads/lead-intelligence'

/**
 * Most recent Ciblage (Discovery) observation of this lead's Instagram
 * account, if any — follows_target ("vu comme abonné"), last engagement
 * counts at scan time. Read from discovery_profiles (the table a scan
 * observes profiles into, see migration 102) rather than fabricating a
 * live "follows you" check, which ClosRM has no way to perform outside of
 * a Hiker scan. Returns null if this lead has never appeared in a scan.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const { data: lead } = await supabase
      .from('leads')
      .select('instagram_user_id, instagram_handle')
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    if (!lead) {
      return NextResponse.json({ error: 'Lead introuvable' }, { status: 404 })
    }

    return NextResponse.json({ data: await loadInstagramSignal(supabase, workspaceId, lead) })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { loadContentDetail } from '@/lib/instagram/content-data'

/**
 * One content's detail for the Content page: Instagram counters from the
 * latest Ciblage scan, and every identified profile that liked/commented it
 * (discovery_interactions + instagram_interactions), with follow status,
 * account-wide activity and the matching lead when there is one.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ contentId: string }> }) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const { contentId } = await params
    const detail = await loadContentDetail(supabase, workspaceId, contentId)
    if (!detail) return NextResponse.json({ error: 'Contenu introuvable' }, { status: 404 })
    return NextResponse.json({ data: detail })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

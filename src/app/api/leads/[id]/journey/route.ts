import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { loadLeadJourney } from '@/lib/leads/lead-journey'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const data = await loadLeadJourney(supabase, workspaceId, id)
    if (!data) return NextResponse.json({ error: 'Lead introuvable' }, { status: 404 })
    return NextResponse.json({ data })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    console.error('[journey] error', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

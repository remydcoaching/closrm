import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'

// GET /api/reel-shots/locations  → liste DISTINCT des lieux utilisés (autocomplete)
export async function GET() {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('reel_shots')
      .select('location')
      .eq('workspace_id', workspaceId)
      .not('location', 'is', null)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const distinct = [...new Set((data ?? []).map(r => r.location).filter(Boolean) as string[])].sort()
    return NextResponse.json({ data: distinct })
  } catch (e) {
    if (e instanceof Error && e.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

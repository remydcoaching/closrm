import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'

// GET /api/reel-shots?social_post_id=X  → 1 reel
// GET /api/reel-shots?social_post_ids=X,Y,Z  → multi-reels
// GET /api/reel-shots  → tous les shots du workspace (peut être lourd)
export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const single = searchParams.get('social_post_id')
    const multi = searchParams.get('social_post_ids')

    let query = supabase
      .from('reel_shots')
      .select('*')
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
      .order('social_post_id', { ascending: true })
      .order('position', { ascending: true })

    if (single) {
      query = query.eq('social_post_id', single)
    } else if (multi) {
      const ids = multi.split(',').map(s => s.trim()).filter(Boolean)
      if (ids.length === 0) return NextResponse.json({ data: [] })
      query = query.in('social_post_id', ids)
    }

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data: data ?? [] })
  } catch (e) {
    if (e instanceof Error && e.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

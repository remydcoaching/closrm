import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const { searchParams } = new URL(request.url)
    const days = Math.min(365, Math.max(7, parseInt(searchParams.get('days') ?? '30', 10)))
    const since = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10)

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('yt_snapshots')
      .select('*')
      .eq('workspace_id', workspaceId)
      .gte('date', since)
      .order('date', { ascending: true })
    if (error) throw error
    return NextResponse.json({ data: data ?? [] })
  } catch (e) {
    if (e instanceof Error && e.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') // 'short' | 'long'
    const search = searchParams.get('search') ?? ''
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get('per_page') ?? '25', 10)))

    const supabase = await createClient()
    let q = supabase
      .from('yt_videos')
      .select('*', { count: 'exact' })
      .eq('workspace_id', workspaceId)
      .order('published_at', { ascending: false })
      .range((page - 1) * perPage, page * perPage - 1)

    if (format === 'short' || format === 'long') q = q.eq('format', format)
    if (search) q = q.ilike('title', `%${search}%`)

    const { data, count, error } = await q
    if (error) throw error
    return NextResponse.json({ data: data ?? [], total: count ?? 0, page, per_page: perPage })
  } catch (e) {
    if (e instanceof Error && e.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

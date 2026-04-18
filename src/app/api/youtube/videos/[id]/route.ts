import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const { data: video, error } = await supabase
      .from('yt_videos')
      .select('*')
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .single()
    if (error || !video) return NextResponse.json({ error: 'Vidéo introuvable' }, { status: 404 })

    const [{ data: daily }, { data: traffic }, { data: demo }] = await Promise.all([
      supabase.from('yt_video_daily_stats').select('*').eq('yt_video_id', id).order('date'),
      supabase.from('yt_traffic_sources').select('*').eq('yt_video_id', id),
      supabase.from('yt_demographics').select('*').eq('yt_video_id', id),
    ])

    return NextResponse.json({
      data: {
        ...video,
        daily_stats: daily ?? [],
        traffic_sources: traffic ?? [],
        demographics: demo ?? [],
      },
    })
  } catch (e) {
    if (e instanceof Error && e.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

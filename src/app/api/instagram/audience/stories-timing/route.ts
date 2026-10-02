import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'

/**
 * « Quand publier » › Vos stories : pour chaque story collectée, sa date,
 * ses vues (compteur Instagram) et ses j'aime (spectateurs qui ont liké).
 */
export async function GET() {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const [stories, likes] = await Promise.all([
      supabase.from('story_view_stories').select('story_pk, taken_at, viewer_count').eq('workspace_id', workspaceId).order('taken_at', { ascending: false }).limit(500),
      supabase.from('story_viewers').select('story_pk').eq('workspace_id', workspaceId).eq('has_liked', true).limit(20000),
    ])
    const likesBy = new Map<string, number>()
    for (const r of likes.data ?? []) likesBy.set(r.story_pk as string, (likesBy.get(r.story_pk as string) ?? 0) + 1)
    return NextResponse.json({
      data: (stories.data ?? []).map((s) => ({ storyPk: s.story_pk, takenAt: s.taken_at, views: s.viewer_count, likes: likesBy.get(s.story_pk as string) ?? 0 })),
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

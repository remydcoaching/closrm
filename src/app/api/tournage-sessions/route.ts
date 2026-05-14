import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'

// GET /api/tournage-sessions
// Liste les sessions du workspace avec leurs reels et stats agrégées.
export async function GET() {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const { data: sessions, error } = await supabase
      .from('tournage_sessions')
      .select(`
        *,
        reels:tournage_session_reels (
          social_post_id, position, added_at,
          post:social_posts (id, title, hook, content_kind)
        )
      `)
      .eq('workspace_id', workspaceId)
      .order('scheduled_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Stats agrégées par session : total/done/skipped des phrases
    const reelIdsSet = new Set<string>()
    sessions?.forEach(s => s.reels?.forEach((r: { social_post_id: string }) => reelIdsSet.add(r.social_post_id)))

    let statsByReel: Record<string, { total: number; done: number; skipped: number }> = {}
    if (reelIdsSet.size > 0) {
      const { data: shots } = await supabase
        .from('reel_shots')
        .select('social_post_id, done, skipped')
        .eq('workspace_id', workspaceId)
        .in('social_post_id', Array.from(reelIdsSet))
        .is('deleted_at', null)
      for (const row of shots ?? []) {
        const id = row.social_post_id as string
        if (!statsByReel[id]) statsByReel[id] = { total: 0, done: 0, skipped: 0 }
        statsByReel[id].total++
        if (row.done) statsByReel[id].done++
        if (row.skipped) statsByReel[id].skipped++
      }
    }

    const enriched = (sessions ?? []).map(s => {
      let total = 0, done = 0, skipped = 0
      const reelsCount = s.reels?.length ?? 0
      s.reels?.forEach((r: { social_post_id: string }) => {
        const st = statsByReel[r.social_post_id]
        if (st) { total += st.total; done += st.done; skipped += st.skipped }
      })
      return { ...s, reels_count: reelsCount, stats: { total, done, skipped } }
    })

    return NextResponse.json({ data: enriched })
  } catch (e) {
    if (e instanceof Error && e.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

// POST /api/tournage-sessions
// Body: { name?, scheduled_date?, social_post_ids?: string[] }
export async function POST(request: NextRequest) {
  try {
    const { workspaceId, userId } = await getWorkspaceId()
    const supabase = await createClient()
    const body = await request.json().catch(() => ({}))

    const { data: session, error: insErr } = await supabase
      .from('tournage_sessions')
      .insert({
        workspace_id: workspaceId,
        name: body.name?.trim() || null,
        scheduled_date: body.scheduled_date || null,
        notes: body.notes?.trim() || null,
        created_by: userId,
      })
      .select()
      .single()
    if (insErr || !session) return NextResponse.json({ error: insErr?.message ?? 'insert failed' }, { status: 500 })

    const ids: string[] = Array.isArray(body.social_post_ids)
      ? body.social_post_ids.filter((i: unknown) => typeof i === 'string')
      : []
    if (ids.length > 0) {
      const rows = ids.map((id, i) => ({ session_id: session.id, social_post_id: id, position: i }))
      const { error: linkErr } = await supabase.from('tournage_session_reels').insert(rows)
      if (linkErr) {
        // best-effort cleanup
        await supabase.from('tournage_sessions').delete().eq('id', session.id)
        return NextResponse.json({ error: 'link failed: ' + linkErr.message }, { status: 500 })
      }
    }

    return NextResponse.json({ data: session })
  } catch (e) {
    if (e instanceof Error && e.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

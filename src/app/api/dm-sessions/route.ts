import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { createDmSessionSchema } from '@/lib/validations/dm-sessions'
import { buildPriorityQueue } from '@/lib/dm-sessions/priority'

export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const body = await request.json()
    const parsed = createDmSessionSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const queue = await buildPriorityQueue(supabase, workspaceId, parsed.data.stale_threshold_days, {
      relanceEnRetard: parsed.data.relance_en_retard,
      premierContact: parsed.data.premier_contact,
      jamaisRecontacte: parsed.data.jamais_recontacte,
    })
    const truncated = queue.slice(0, parsed.data.target_count)

    const { data: session, error: sessionError } = await supabase
      .from('dm_sessions')
      .insert({
        workspace_id: workspaceId,
        status: 'active',
        target_count: parsed.data.target_count,
        stale_threshold_days: parsed.data.stale_threshold_days,
      })
      .select()
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Impossible de créer la session' }, { status: 500 })
    }

    const { data: items, error: itemsError } = await supabase
      .from('dm_session_items')
      .insert(
        truncated.map((entry, index) => ({
          session_id: session.id,
          lead_id: entry.lead_id,
          position: index,
          category: entry.category,
        }))
      )
      .select()

    if (itemsError) {
      return NextResponse.json({ error: 'Impossible de créer la file de leads' }, { status: 500 })
    }

    return NextResponse.json({ data: { ...session, items: (items ?? []).slice(0, truncated.length) } })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const { data: session } = await supabase
      .from('dm_sessions')
      .select('*, items:dm_session_items(*)')
      .eq('workspace_id', workspaceId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    return NextResponse.json({ data: session ?? null })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

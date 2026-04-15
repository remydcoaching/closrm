import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'

export async function POST(request: NextRequest) {
  try {
    const { userId, workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const body = await request.json()
    const itemId = typeof body.item_id === 'string' ? body.item_id : null
    const completed = body.completed === true

    if (!itemId) {
      return NextResponse.json({ error: 'item_id requis.' }, { status: 400 })
    }

    // Verify item belongs to workspace
    const { data: item } = await supabase
      .from('team_training_items')
      .select('id')
      .eq('id', itemId)
      .eq('workspace_id', workspaceId)
      .single()

    if (!item) {
      return NextResponse.json({ error: 'Element introuvable.' }, { status: 404 })
    }

    // Upsert progress
    const { data, error } = await supabase
      .from('team_training_progress')
      .upsert(
        {
          workspace_id: workspaceId,
          user_id: userId,
          item_id: itemId,
          completed,
          completed_at: completed ? new Date().toISOString() : null,
        },
        { onConflict: 'user_id,item_id' }
      )
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ data })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

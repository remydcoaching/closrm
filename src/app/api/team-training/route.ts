import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'

export async function GET() {
  try {
    const { userId, workspaceId, role } = await getWorkspaceId()
    const supabase = await createClient()

    // Fetch all modules for the workspace
    const { data: modules, error: modError } = await supabase
      .from('team_training_modules')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('sort_order', { ascending: true })

    if (modError) return NextResponse.json({ error: modError.message }, { status: 500 })

    // Fetch all items
    const { data: items, error: itemError } = await supabase
      .from('team_training_items')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('sort_order', { ascending: true })

    if (itemError) return NextResponse.json({ error: itemError.message }, { status: 500 })

    // Fetch progress for the current user
    const { data: progress, error: progError } = await supabase
      .from('team_training_progress')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)

    if (progError) return NextResponse.json({ error: progError.message }, { status: 500 })

    // If admin, also fetch progress of all members for the overview
    let membersProgress: { user_id: string; full_name: string; item_id: string; completed: boolean }[] = []
    if (role === 'admin') {
      const { data: allProgress } = await supabase
        .from('team_training_progress')
        .select('user_id, item_id, completed')
        .eq('workspace_id', workspaceId)

      const { data: members } = await supabase
        .from('workspace_members')
        .select('user_id, user:users!inner(full_name)')
        .eq('workspace_id', workspaceId)
        .eq('status', 'active')

      if (allProgress && members) {
        membersProgress = allProgress.map(p => {
          const member = members.find(m => m.user_id === p.user_id)
          const userData = member?.user as unknown as { full_name: string } | undefined
          return {
            user_id: p.user_id,
            full_name: userData?.full_name ?? 'Membre',
            item_id: p.item_id,
            completed: p.completed,
          }
        })
      }
    }

    // Assemble modules with items and progress
    const result = (modules ?? []).map(mod => ({
      ...mod,
      items: (items ?? []).filter(i => i.module_id === mod.id),
      progress: (progress ?? []).filter(p =>
        (items ?? []).some(i => i.module_id === mod.id && i.id === p.item_id)
      ),
    }))

    return NextResponse.json({ data: result, membersProgress })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { workspaceId, role } = await getWorkspaceId()
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const supabase = await createClient()
    const body = await request.json()

    const title = typeof body.title === 'string' ? body.title.trim() : ''
    if (!title) {
      return NextResponse.json({ error: 'Le titre est requis.' }, { status: 400 })
    }

    const description = typeof body.description === 'string' ? body.description.trim() : null
    const roleValue = ['setter', 'closer', 'all'].includes(body.role) ? body.role : 'all'

    // Get next sort_order
    const { count } = await supabase
      .from('team_training_modules')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)

    const { data, error } = await supabase
      .from('team_training_modules')
      .insert({
        workspace_id: workspaceId,
        title,
        description,
        role: roleValue,
        sort_order: (count ?? 0),
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

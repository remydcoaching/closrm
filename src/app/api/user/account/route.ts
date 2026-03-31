import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { createServiceClient } from '@/lib/supabase/service'
import { deleteAccountSchema } from '@/lib/validations/settings'

export async function DELETE(request: NextRequest) {
  try {
    const { userId, workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const serviceClient = createServiceClient()

    const body = await request.json()
    const parsed = deleteAccountSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    // Verify confirmation matches workspace name
    const { data: workspace, error: wsError } = await supabase
      .from('workspaces')
      .select('name')
      .eq('id', workspaceId)
      .single()

    if (wsError || !workspace) {
      return NextResponse.json({ error: 'Workspace introuvable' }, { status: 404 })
    }

    if (parsed.data.confirmation !== workspace.name) {
      return NextResponse.json(
        { error: 'Le nom du workspace ne correspond pas.' },
        { status: 400 }
      )
    }

    // 1. Delete avatar files from Storage
    const { data: avatarFiles } = await supabase.storage
      .from('avatars')
      .list(userId)

    if (avatarFiles && avatarFiles.length > 0) {
      const paths = avatarFiles.map((f) => `${userId}/${f.name}`)
      await supabase.storage.from('avatars').remove(paths)
    }

    // 2. Delete workspace (CASCADE will delete users, leads, calls, follow_ups, etc.)
    const { error: deleteWsError } = await serviceClient
      .from('workspaces')
      .delete()
      .eq('id', workspaceId)

    if (deleteWsError) {
      return NextResponse.json({ error: 'Erreur suppression workspace' }, { status: 500 })
    }

    // 3. Delete auth user via admin API
    const { error: deleteAuthError } = await serviceClient.auth.admin.deleteUser(userId)

    if (deleteAuthError) {
      return NextResponse.json({ error: 'Erreur suppression compte auth' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

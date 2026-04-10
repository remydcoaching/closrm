import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import type { WorkspaceRole, MemberStatus } from '@/types'

const VALID_ROLES: WorkspaceRole[] = ['setter', 'closer']
const VALID_STATUSES: MemberStatus[] = ['active', 'suspended']

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId: targetUserId } = await params
    const { userId, workspaceId, role } = await getWorkspaceId()

    if (role !== 'admin') {
      return NextResponse.json(
        { error: 'Seul un administrateur peut modifier les membres' },
        { status: 403 }
      )
    }

    if (targetUserId === userId) {
      return NextResponse.json(
        { error: 'Vous ne pouvez pas modifier votre propre rôle ou statut' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { role: newRole, status: newStatus } = body as {
      role?: string
      status?: string
    }

    // Validate at least one field provided
    if (!newRole && !newStatus) {
      return NextResponse.json(
        { error: 'Aucune modification fournie' },
        { status: 400 }
      )
    }

    if (newRole && !VALID_ROLES.includes(newRole as WorkspaceRole)) {
      return NextResponse.json(
        { error: 'Le rôle doit être "setter" ou "closer"' },
        { status: 400 }
      )
    }

    if (newStatus && !VALID_STATUSES.includes(newStatus as MemberStatus)) {
      return NextResponse.json(
        { error: 'Le statut doit être "active" ou "suspended"' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Build update object
    const memberUpdate: Record<string, string> = {}
    if (newRole) memberUpdate.role = newRole
    if (newStatus) memberUpdate.status = newStatus

    const { data: member, error: memberError } = await supabase
      .from('workspace_members')
      .update(memberUpdate)
      .eq('workspace_id', workspaceId)
      .eq('user_id', targetUserId)
      .select()
      .single()

    if (memberError || !member) {
      return NextResponse.json(
        { error: 'Membre introuvable' },
        { status: 404 }
      )
    }

    // Keep users table in sync
    if (newRole) {
      await supabase
        .from('users')
        .update({ role: newRole })
        .eq('id', targetUserId)
        .eq('workspace_id', workspaceId)
    }

    return NextResponse.json({ data: member })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId: targetUserId } = await params
    const { userId, workspaceId, role } = await getWorkspaceId()

    if (role !== 'admin') {
      return NextResponse.json(
        { error: 'Seul un administrateur peut supprimer des membres' },
        { status: 403 }
      )
    }

    if (targetUserId === userId) {
      return NextResponse.json(
        { error: 'Vous ne pouvez pas vous supprimer vous-même' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Delete workspace_members row
    const { error: deleteError } = await supabase
      .from('workspace_members')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('user_id', targetUserId)

    if (deleteError) {
      console.error('[API /workspaces/members/[userId]] DELETE error:', deleteError.message)
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    // Ban the auth user (disable, not delete) using service client
    const serviceClient = createServiceClient()
    await serviceClient.auth.admin.updateUserById(targetUserId, {
      ban_duration: 'none',
      user_metadata: { banned: true },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

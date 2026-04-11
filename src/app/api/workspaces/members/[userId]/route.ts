import { NextRequest, NextResponse } from 'next/server'
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

    const serviceClient = createServiceClient()

    // Build update object
    const memberUpdate: Record<string, string> = {}
    if (newRole) memberUpdate.role = newRole
    if (newStatus) memberUpdate.status = newStatus

    const { data: member, error: memberError } = await serviceClient
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
      await serviceClient
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

    const serviceClient = createServiceClient()

    // 1. Delete workspace_members row
    await serviceClient
      .from('workspace_members')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('user_id', targetUserId)

    // 2. Delete users row
    await serviceClient
      .from('users')
      .delete()
      .eq('id', targetUserId)
      .eq('workspace_id', workspaceId)

    // 3. Delete Supabase Auth account completely (so email can be reused)
    await serviceClient.auth.admin.deleteUser(targetUserId)

    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

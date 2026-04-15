import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import type { WorkspaceMemberWithUser, WorkspaceRole } from '@/types'

export async function GET() {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    // Fetch members
    const { data: members, error } = await supabase
      .from('workspace_members')
      .select('id, workspace_id, user_id, role, status, permissions, invited_by, invited_at, activated_at, created_at')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[API /workspaces/members] GET error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Fetch user profiles separately (FK is to auth.users, not public.users)
    const userIds = (members || []).map(m => m.user_id)
    const { data: users } = userIds.length > 0
      ? await supabase.from('users').select('id, email, full_name, avatar_url').in('id', userIds)
      : { data: [] }

    const userMap = new Map((users || []).map(u => [u.id, u]))

    // Merge members with user data
    const enriched = (members || []).map((row) => ({
      ...row,
      user: userMap.get(row.user_id) || { id: row.user_id, email: '', full_name: 'Inconnu', avatar_url: null },
    }))

    return NextResponse.json({ data: enriched })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

const VALID_ROLES: WorkspaceRole[] = ['setter', 'closer']

export async function POST(request: NextRequest) {
  try {
    const { userId, workspaceId, role } = await getWorkspaceId()

    if (role !== 'admin') {
      return NextResponse.json(
        { error: 'Seul un administrateur peut inviter des membres' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { email, full_name, password, role: memberRole } = body as {
      email?: string
      full_name?: string
      password?: string
      role?: string
    }

    // Validation
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'Email invalide' }, { status: 400 })
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      return NextResponse.json(
        { error: 'Le mot de passe doit contenir au moins 6 caractères' },
        { status: 400 }
      )
    }
    if (!memberRole || !VALID_ROLES.includes(memberRole as WorkspaceRole)) {
      return NextResponse.json(
        { error: 'Le rôle doit être "setter" ou "closer"' },
        { status: 400 }
      )
    }

    const serviceClient = createServiceClient()

    // Create Supabase Auth account
    // is_invited flag prevents handle_new_user trigger from creating a separate workspace
    const { data: authUser, error: authError } = await serviceClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: full_name || '', is_invited: true },
    })

    if (authError) {
      if (authError.message.toLowerCase().includes('already') || authError.message.includes('duplicate')) {
        return NextResponse.json(
          { error: 'Un compte avec cet email existe déjà' },
          { status: 409 }
        )
      }
      console.error('[API /workspaces/members] Auth createUser error:', authError.message)
      return NextResponse.json({ error: authError.message }, { status: 500 })
    }

    const newUserId = authUser.user.id

    // Create users row
    const { error: userError } = await serviceClient
      .from('users')
      .insert({
        id: newUserId,
        workspace_id: workspaceId,
        email,
        role: memberRole,
        full_name: full_name || '',
      })

    if (userError) {
      console.error('[API /workspaces/members] Insert users error:', userError.message)
      // Rollback: delete auth user
      await serviceClient.auth.admin.deleteUser(newUserId)
      return NextResponse.json({ error: userError.message }, { status: 500 })
    }

    // Create workspace_members row
    const now = new Date().toISOString()
    const { data: member, error: memberError } = await serviceClient
      .from('workspace_members')
      .insert({
        workspace_id: workspaceId,
        user_id: newUserId,
        role: memberRole,
        status: 'active',
        invited_by: userId,
        invited_at: now,
        activated_at: now,
      })
      .select()
      .single()

    if (memberError) {
      console.error('[API /workspaces/members] Insert workspace_members error:', memberError.message)
      // Rollback: delete user row and auth user
      await serviceClient.from('users').delete().eq('id', newUserId)
      await serviceClient.auth.admin.deleteUser(newUserId)
      return NextResponse.json({ error: memberError.message }, { status: 500 })
    }

    return NextResponse.json(
      {
        data: {
          member,
          credentials: { email, password },
        },
      },
      { status: 201 }
    )
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

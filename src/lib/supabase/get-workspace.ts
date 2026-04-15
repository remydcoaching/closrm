import { createClient } from '@/lib/supabase/server'
import type { WorkspaceRole } from '@/types'

interface WorkspaceContext {
  userId: string
  workspaceId: string
  role: WorkspaceRole
}

export async function getWorkspaceId(): Promise<WorkspaceContext> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error('Not authenticated')
  }

  // Try workspace_members first (new team system)
  const { data: member } = await supabase
    .from('workspace_members')
    .select('workspace_id, role')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (member) {
    return {
      userId: user.id,
      workspaceId: member.workspace_id,
      role: member.role as WorkspaceRole,
    }
  }

  // Fallback to users table (backward compat if workspace_members not yet populated)
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('workspace_id, role')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    throw new Error('User profile not found')
  }

  return {
    userId: user.id,
    workspaceId: profile.workspace_id,
    role: (profile.role === 'coach' ? 'admin' : profile.role) as WorkspaceRole,
  }
}

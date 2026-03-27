import { createClient } from '@/lib/supabase/server'

interface WorkspaceContext {
  userId: string
  workspaceId: string
}

export async function getWorkspaceId(): Promise<WorkspaceContext> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error('Not authenticated')
  }

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('workspace_id')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    throw new Error('User profile not found')
  }

  return {
    userId: user.id,
    workspaceId: profile.workspace_id,
  }
}

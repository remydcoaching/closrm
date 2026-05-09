import { createClient } from '@/lib/supabase/server'
import { headers as nextHeaders } from 'next/headers'
import type { WorkspaceRole } from '@/types'

interface WorkspaceContext {
  userId: string
  workspaceId: string
  role: WorkspaceRole
}

export async function getWorkspaceId(): Promise<WorkspaceContext> {
  const supabase = await createClient()
  let { data: { user } } = await supabase.auth.getUser()

  // Fallback Bearer (mobile) — si pas de session cookies, on tente de
  // valider le JWT en clair via auth.getUser(token). Le client Supabase
  // a déjà l'Authorization en global.headers (cf createClient), donc
  // les requêtes RLS suivantes sont aussi authentifiées correctement.
  if (!user) {
    try {
      const h = await nextHeaders()
      const authHeader = h.get('authorization') ?? h.get('Authorization')
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice('Bearer '.length).trim()
        if (token) {
          const { data, error } = await supabase.auth.getUser(token)
          if (!error && data.user) user = data.user
        }
      }
    } catch {
      // headers() pas dispo — flow cookies a déjà échoué.
    }
  }

  if (!user) {
    throw new Error('Not authenticated')
  }

  // Try workspace_members first (new team system)
  // Un user peut avoir PLUSIEURS rows actives (auto-workspace + invitation).
  // Ordre de priorité du rôle effectif : monteur > admin > closer > setter.
  // En général le 'monteur' est dans le workspace de quelqu'un d'autre,
  // donc c'est celui-là qu'on prend en priorité (sinon il verrait son propre
  // workspace personnel auto-créé en admin).
  const { data: members } = await supabase
    .from('workspace_members')
    .select('workspace_id, role')
    .eq('user_id', user.id)
    .eq('status', 'active')

  const list = (members ?? []) as { workspace_id: string; role: string }[]
  if (list.length > 0) {
    const priority = ['monteur', 'admin', 'closer', 'setter']
    const sorted = [...list].sort(
      (a, b) => priority.indexOf(a.role) - priority.indexOf(b.role)
    )
    const primary = sorted[0]
    return {
      userId: user.id,
      workspaceId: primary.workspace_id,
      role: primary.role as WorkspaceRole,
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

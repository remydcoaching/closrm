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
  const { data: { user } } = await supabase.auth.getUser()
  let userId: string | null = user?.id ?? null

  // Fallback Bearer (desktop, mobile) — pas de session cookies : on vérifie
  // le JWT avec getClaims(). Avec des clés de signature asymétriques, la
  // vérification est locale (JWKS en cache : pas d'aller-retour vers Supabase
  // Auth à chaque requête, et l'API tient si Auth tombe) ; avec la clé
  // partagée HS256 historique, getClaims() refait getUser(token) comme avant.
  // Le client Supabase a déjà l'Authorization en global.headers (cf
  // createClient) : les requêtes RLS suivantes sont authentifiées.
  if (!userId) {
    try {
      const h = await nextHeaders()
      const authHeader = h.get('authorization') ?? h.get('Authorization')
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice('Bearer '.length).trim()
        if (token) {
          const { data, error } = await supabase.auth.getClaims(token)
          const sub = data?.claims?.sub
          if (!error && typeof sub === 'string' && sub) userId = sub
        }
      }
    } catch {
      // headers() pas dispo — flow cookies a déjà échoué.
    }
  }

  if (!userId) {
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
    .eq('user_id', userId)
    .eq('status', 'active')

  const list = (members ?? []) as { workspace_id: string; role: string }[]
  if (list.length > 0) {
    const priority = ['monteur', 'admin', 'closer', 'setter']
    const sorted = [...list].sort(
      (a, b) => priority.indexOf(a.role) - priority.indexOf(b.role)
    )
    const primary = sorted[0]
    return {
      userId,
      workspaceId: primary.workspace_id,
      role: primary.role as WorkspaceRole,
    }
  }

  // Fallback to users table (backward compat if workspace_members not yet populated)
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('workspace_id, role')
    .eq('id', userId)
    .single()

  if (profileError || !profile) {
    throw new Error('User profile not found')
  }

  return {
    userId,
    workspaceId: profile.workspace_id,
    role: (profile.role === 'coach' ? 'admin' : profile.role) as WorkspaceRole,
  }
}

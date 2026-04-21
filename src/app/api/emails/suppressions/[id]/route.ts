import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'

/**
 * DELETE /api/emails/suppressions/[id]
 *
 * Débloque une adresse : retire l'entrée de la suppression list. Réservé au
 * scope workspace (on ne peut pas débloquer une suppression globale via l'UI).
 * Utilise le service client car les policies d'insert/delete sont fermées au
 * rôle anon pour éviter qu'un user bypass les webhooks.
 */
interface RouteContext {
  params: Promise<{ id: string }>
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params
  const { workspaceId } = await getWorkspaceId()

  // Vérifie d'abord avec le client RLS que l'entrée appartient bien au workspace
  const supabaseUser = await createClient()
  const { data: entry } = await supabaseUser
    .from('email_suppressions')
    .select('id, workspace_id')
    .eq('id', id)
    .maybeSingle()

  if (!entry || entry.workspace_id !== workspaceId) {
    return NextResponse.json({ error: 'Entrée introuvable' }, { status: 404 })
  }

  // Delete via service role (les policies sur la table sont fermées pour INSERT/DELETE)
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('email_suppressions')
    .delete()
    .eq('id', id)
    .eq('workspace_id', workspaceId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

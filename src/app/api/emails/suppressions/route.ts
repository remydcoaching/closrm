import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'

/**
 * GET /api/emails/suppressions
 *
 * Liste les adresses bloquées pour le workspace courant (bounces permanents,
 * complaints, unsubscribes). La RLS s'assure qu'on ne voit que les suppressions
 * du workspace + les globales.
 */
export async function GET() {
  const { workspaceId } = await getWorkspaceId()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('email_suppressions')
    .select('id, email, reason, bounce_type, bounce_subtype, created_at, workspace_id')
    .or(`workspace_id.eq.${workspaceId},workspace_id.is.null`)
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

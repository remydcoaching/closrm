import { NextResponse } from 'next/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const { userId, workspaceId, role } = await getWorkspaceId()
    const supabase = await createClient()
    // Lookup the user's display name (full_name) and email so les
    // composants client (LeadActionModal, ConfirmationMessageBlock, etc.)
    // peuvent les afficher sans round-trip supplémentaire.
    const { data: user } = await supabase
      .from('users')
      .select('full_name, email')
      .eq('id', userId)
      .maybeSingle() as { data: { full_name: string | null; email: string | null } | null }

    return NextResponse.json({
      data: {
        userId,
        workspaceId,
        role,
        full_name: user?.full_name ?? null,
        email: user?.email ?? null,
      },
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

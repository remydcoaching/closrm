import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { loadInstagramPerson } from '@/lib/instagram/person'

/**
 * Fiche d'un compte Instagram qui a réagi (lead CRM ou non) : identité et
 * chaque geste vu par ClosRM — réels likés, commentaires, stories vues.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const { username } = await params
    const person = await loadInstagramPerson(supabase, workspaceId, decodeURIComponent(username))
    if (!person) return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 })
    return NextResponse.json({ data: person })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { loadReelReactions } from '@/lib/instagram/reel-reactions'

/**
 * « Qui a réagi » d'une publication (panneau de la page Contenu) : compteurs
 * Instagram, et chaque personne identifiée, séparée entre premier geste chez
 * le coach et personnes ayant déjà réagi à une publication plus ancienne.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ contentId: string }> }) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const { contentId } = await params
    const data = await loadReelReactions(supabase, workspaceId, contentId)
    if (!data) return NextResponse.json({ error: 'Contenu introuvable' }, { status: 404 })
    return NextResponse.json({ data })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { loadLikers } from '@/lib/instagram/likers-data'

const MAX_ROWS = 1000

/**
 * Qui like vos publications — les j'aime identifiés par le suivi des
 * publications, regroupés par compte Instagram (src/lib/instagram/likers-data.ts).
 * Totaux sur tout l'historique ; les 1000 comptes qui likent le plus.
 */
export async function GET() {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const { rows, ...totals } = await loadLikers(supabase, workspaceId)
    return NextResponse.json({ data: { ...totals, rows: rows.slice(0, MAX_ROWS) } })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

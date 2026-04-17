import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { createClient } from '@/lib/supabase/server'
import { previewImport } from '@/lib/leads/import-engine'
import type { ImportConfig } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const body = await request.json()

    const { rows, config } = body as { rows: Record<string, string>[]; config: ImportConfig }

    if (!rows || !Array.isArray(rows)) {
      return NextResponse.json({ error: 'Données manquantes' }, { status: 400 })
    }

    if (rows.length > 5000) {
      return NextResponse.json({ error: 'Maximum 5 000 lignes par import' }, { status: 400 })
    }

    const result = await previewImport(supabase, workspaceId, rows, config)

    return NextResponse.json({ data: result })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

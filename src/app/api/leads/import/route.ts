import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { createClient } from '@/lib/supabase/server'
import { executeImport } from '@/lib/leads/import-engine'
import type { ImportConfig } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const { workspaceId, userId } = await getWorkspaceId()
    const supabase = await createClient()
    const body = await request.json()

    const { rows, config, fileName } = body as {
      rows: Record<string, string>[]
      config: ImportConfig
      fileName: string
    }

    if (!rows || !Array.isArray(rows)) {
      return NextResponse.json({ error: 'Données manquantes' }, { status: 400 })
    }

    if (rows.length > 5000) {
      return NextResponse.json({ error: 'Maximum 5 000 lignes par import' }, { status: 400 })
    }

    // Create batch record
    const { data: batch, error: batchError } = await supabase
      .from('lead_import_batches')
      .insert({
        workspace_id: workspaceId,
        file_name: fileName || 'import.csv',
        status: 'processing',
        total_rows: rows.length,
        config,
        created_by: userId,
      })
      .select()
      .single()

    if (batchError || !batch) {
      return NextResponse.json({ error: 'Impossible de créer le batch' }, { status: 500 })
    }

    // Execute import inline
    await executeImport(supabase, workspaceId, batch.id, rows, config)

    // Fetch final batch state
    const { data: finalBatch } = await supabase
      .from('lead_import_batches')
      .select('*')
      .eq('id', batch.id)
      .single()

    return NextResponse.json({ data: finalBatch }, { status: 201 })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

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

    const { rows, config, fileName, batchId: existingBatchId } = body as {
      rows: Record<string, string>[]
      config: ImportConfig
      fileName: string
      batchId?: string
    }

    if (!rows || !Array.isArray(rows)) {
      return NextResponse.json({ error: 'Données manquantes' }, { status: 400 })
    }

    if (rows.length > 5000) {
      return NextResponse.json({ error: 'Maximum 5 000 lignes par import' }, { status: 400 })
    }

    let batchId: string

    if (existingBatchId) {
      // Re-use existing batch (chunked import)
      const { data: existing, error: existingError } = await supabase
        .from('lead_import_batches')
        .select('id')
        .eq('id', existingBatchId)
        .eq('workspace_id', workspaceId)
        .single()

      if (existingError || !existing) {
        return NextResponse.json({ error: 'Batch non trouvé' }, { status: 404 })
      }

      // Update total_rows to accumulate
      await supabase
        .from('lead_import_batches')
        .update({ total_rows: rows.length })
        .eq('id', existingBatchId)

      batchId = existingBatchId
    } else {
      // Create new batch record
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

      batchId = batch.id
    }

    // Execute import inline
    await executeImport(supabase, workspaceId, batchId, rows, config)

    // Fetch final batch state
    const { data: finalBatch } = await supabase
      .from('lead_import_batches')
      .select('*')
      .eq('id', batchId)
      .single()

    return NextResponse.json({ data: finalBatch }, { status: 201 })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

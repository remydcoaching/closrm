import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'

/**
 * POST /api/reel-shots/sync
 * Body: { social_post_id: string }
 *
 * Synchronise les `reel_shots` depuis le script du social_post :
 * - Split par retour à la ligne (lignes vides ignorées)
 * - Pour chaque ligne :
 *   - Si position existe déjà : update text uniquement (préserve location, done, etc.)
 *   - Sinon : insert nouvelle row
 * - Si phrases en moins (script raccourci) : delete les rows en surplus
 *
 * À appeler à l'ouverture de la prep ou en background quand le user édite le script.
 */
export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const body = await request.json().catch(() => ({}))
    const social_post_id = body.social_post_id as string | undefined
    if (!social_post_id) return NextResponse.json({ error: 'social_post_id requis' }, { status: 400 })

    // 1. Lit le script du social_post (RLS s'assure de l'appartenance au workspace)
    const { data: post, error: postErr } = await supabase
      .from('social_posts')
      .select('id, workspace_id, script')
      .eq('id', social_post_id)
      .eq('workspace_id', workspaceId)
      .single()
    if (postErr || !post) return NextResponse.json({ error: 'Reel introuvable' }, { status: 404 })

    const script: string = post.script ?? ''
    const newPhrases = script.split('\n').map(s => s.trim()).filter(Boolean)

    // 2. Lit les shots existants (NON soft-deleted)
    const { data: existing, error: exErr } = await supabase
      .from('reel_shots')
      .select('id, position, text, done, skipped')
      .eq('workspace_id', workspaceId)
      .eq('social_post_id', social_post_id)
      .is('deleted_at', null)
      .order('position', { ascending: true })
    if (exErr) return NextResponse.json({ error: exErr.message }, { status: 500 })

    const existingByPos = new Map<number, { id: string; text: string; done: boolean; skipped: boolean }>()
    for (const e of existing ?? []) existingByPos.set(e.position, { id: e.id, text: e.text, done: !!e.done, skipped: !!e.skipped })

    // 3. Plan des opérations
    type UpsertRow = { id?: string; workspace_id: string; social_post_id: string; position: number; text: string; done?: boolean; skipped?: boolean }
    const toUpsert: UpsertRow[] = []
    let resetCount = 0
    for (let i = 0; i < newPhrases.length; i++) {
      const found = existingByPos.get(i)
      if (found) {
        if (found.text !== newPhrases[i]) {
          // Texte modifié : si la phrase était déjà tournée/reportée, on reset done/skipped
          // pour que l'user sache qu'il doit re-filmer le nouveau texte.
          // Location et shot_note préservés (peuvent rester utiles).
          const row: UpsertRow = { id: found.id, workspace_id: workspaceId, social_post_id, position: i, text: newPhrases[i] }
          if (found.done || found.skipped) {
            row.done = false
            row.skipped = false
            resetCount++
          }
          toUpsert.push(row)
        }
      } else {
        toUpsert.push({ workspace_id: workspaceId, social_post_id, position: i, text: newPhrases[i] })
      }
    }

    // 4. Suppression des shots en surplus (positions > newPhrases.length - 1)
    const toDeleteIds: string[] = []
    for (const [pos, row] of existingByPos.entries()) {
      if (pos >= newPhrases.length) toDeleteIds.push(row.id)
    }

    // 5. Apply
    if (toUpsert.length > 0) {
      const { error: upErr } = await supabase
        .from('reel_shots')
        .upsert(toUpsert, { onConflict: 'social_post_id,position' })
      if (upErr) return NextResponse.json({ error: 'Sync upsert: ' + upErr.message }, { status: 500 })
    }
    if (toDeleteIds.length > 0) {
      // Soft-delete : préserve les phrases marquées tournées si l'user a raccourci le script
      // (sinon on perd l'historique de tournage). Le brief filtre WHERE deleted_at IS NULL,
      // mais en cas de regret on peut restaurer.
      const { error: delErr } = await supabase
        .from('reel_shots')
        .update({ deleted_at: new Date().toISOString() })
        .in('id', toDeleteIds)
      if (delErr) return NextResponse.json({ error: 'Sync soft-delete: ' + delErr.message }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      upserted: toUpsert.length,
      deleted: toDeleteIds.length,
      reset: resetCount,
      total: newPhrases.length,
    })
  } catch (e) {
    if (e instanceof Error && e.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

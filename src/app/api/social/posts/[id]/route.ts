import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { updateSocialPostSchema } from '@/lib/validations/social-posts'
import { notifyMonteurFilmed, notifyCoachEdited, notifyMonteurValidated, notifyMonteurRevisionRequested } from '@/lib/social/monteur-notifications'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('social_posts')
      .select('*, publications:social_post_publications(*)')
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .single()
    if (error) return NextResponse.json({ error: 'Post introuvable' }, { status: 404 })
    return NextResponse.json({ data })
  } catch (e) {
    if (e instanceof Error && e.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const { workspaceId } = await getWorkspaceId()
    const body = await request.json()
    const parsed = updateSocialPostSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    // revision_feedback est un champ transient (pas une colonne DB) — on le sort
    // du payload avant le update().
    const { publications, revision_feedback: _revisionFeedback, ...post } = parsed.data
    void _revisionFeedback

    // ⚠️ Important: certains champs (rush_url, final_url) ont un .transform()
    // dans le schema Zod qui transforme `undefined` (champ absent du payload)
    // en `null`. Resultat: PATCH { final_url: 'xxx' } produit
    // { final_url: 'xxx', rush_url: null } apres parse. Le UPDATE SQL inclut
    // alors rush_url: null, et le trigger DB monteur_guard voit
    // NEW.rush_url IS DISTINCT FROM OLD.rush_url → throws.
    // Fix: on ne garde dans l'UPDATE que les cles reellement presentes
    // dans le body original (= le client a explicitement voulu les modifier).
    const bodyKeys = body && typeof body === 'object' ? new Set(Object.keys(body)) : new Set()
    const filteredPost: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(post)) {
      if (bodyKeys.has(k)) filteredPost[k] = v
    }

    const supabase = await createClient()
    const { data: existing } = await supabase
      .from('social_posts')
      .select('id, production_status, monteur_id, monteur_notified_at, coach_notified_at')
      .eq('id', id).eq('workspace_id', workspaceId).single()
    if (!existing) return NextResponse.json({ error: 'Post introuvable' }, { status: 404 })

    const { data: updated, error } = await supabase
      .from('social_posts')
      .update(filteredPost)
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .select()
      .single()
    if (error) throw error

    // Notifications monteur — déclenchées sur transition production_status
    // OU sur réassignation alors que le slot est déjà filmed.
    // Idempotence assurée par les colonnes *_notified_at (reset par le trigger
    // DB quand on revient en filmed ou qu'on change de monteur).
    if (updated && existing) {
      const wasEdited = existing.production_status === 'edited'
      const nowFilmed = updated.production_status === 'filmed'
      const nowEdited = updated.production_status === 'edited'
      const monteurChanged = updated.monteur_id !== existing.monteur_id

      // Filmed avec un monteur assigné — soit transition, soit réassignation.
      // monteur_notified_at est null (reseté par trigger si nécessaire), donc
      // notifyMonteurFilmed ne renverra pas si déjà envoyé.
      // EXCLUSION: si on revient depuis edited|ready (= demande de retouches),
      // c'est notifyMonteurRevisionRequested qui prend le relai (eviter le
      // double email).
      const isRevisionFlow =
        nowFilmed && (existing.production_status === 'edited' || existing.production_status === 'ready')
      if (
        nowFilmed &&
        updated.monteur_id &&
        !isRevisionFlow &&
        (existing.production_status !== 'filmed' || monteurChanged)
      ) {
        notifyMonteurFilmed(supabase, updated).catch(err =>
          console.error('[social/posts PATCH] notify monteur failed:', err?.message)
        )
      }
      // filmed → edited : prévenir le coach
      if (!wasEdited && nowEdited) {
        notifyCoachEdited(supabase, updated).catch(err =>
          console.error('[social/posts PATCH] notify coach failed:', err?.message)
        )
      }
      // edited → ready : prévenir le monteur (montage validé)
      const wasReady = existing.production_status === 'ready'
      const nowReady = updated.production_status === 'ready'
      if (!wasReady && nowReady) {
        notifyMonteurValidated(supabase, updated).catch(err =>
          console.error('[social/posts PATCH] notify monteur validated failed:', err?.message)
        )
      }
      // edited|ready → filmed : retouches demandees
      if (isRevisionFlow && updated.monteur_id) {
        const feedback = (parsed.data as { revision_feedback?: string | null }).revision_feedback ?? null
        notifyMonteurRevisionRequested(supabase, updated, feedback).catch(err =>
          console.error('[social/posts PATCH] notify monteur revision failed:', err?.message)
        )
      }
    }

    if (publications) {
      // Strategy: upsert par (social_post_id, platform) — on remplace intégralement la liste.
      // Defense en profondeur: dedupe par platform (la unique constraint le ferait planter sinon).
      const dedupedPubs: typeof publications = []
      const seen = new Set<string>()
      for (const p of publications) {
        if (seen.has(p.platform)) continue
        seen.add(p.platform)
        dedupedPubs.push(p)
      }
      await supabase.from('social_post_publications').delete().eq('social_post_id', id)
      if (dedupedPubs.length > 0) {
        const rows = dedupedPubs.map((p) => ({
          social_post_id: id,
          workspace_id: workspaceId,
          platform: p.platform,
          config: p.config ?? {},
          scheduled_at: p.scheduled_at ?? post.scheduled_at ?? null,
          status: 'pending' as const,
        }))
        const { error: pubErr } = await supabase.from('social_post_publications').insert(rows)
        if (pubErr) throw pubErr
      }
    }

    const { data: withPubs } = await supabase
      .from('social_posts')
      .select('*, publications:social_post_publications(*)')
      .eq('id', id)
      .single()

    return NextResponse.json({ data: withPubs ?? updated })
  } catch (e) {
    if (e instanceof Error && e.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const { error } = await supabase
      .from('social_posts')
      .delete()
      .eq('id', id)
      .eq('workspace_id', workspaceId)
    if (error) throw error

    // Hard-delete des fichiers R2 du slot (final/media/rush). Best-effort:
    // si ca echoue le slot DB est deja supprime, le cron cleanup-r2-orphans
    // les rattrappera plus tard.
    try {
      const { isR2Configured } = await import('@/lib/storage/r2-client')
      if (isR2Configured()) {
        const { deleteByPrefix } = await import('@/lib/storage/signing')
        const prefix = `workspaces/${workspaceId}/posts/${id}/`
        await deleteByPrefix(prefix)
      }
    } catch (cleanupErr) {
      console.error('[social/posts DELETE] R2 cleanup failed:', (cleanupErr as Error).message)
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof Error && e.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

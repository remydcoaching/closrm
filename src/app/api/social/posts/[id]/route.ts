import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { updateSocialPostSchema } from '@/lib/validations/social-posts'
import { notifyMonteurFilmed, notifyCoachEdited } from '@/lib/social/monteur-notifications'

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
    const { publications, ...post } = parsed.data

    const supabase = await createClient()
    const { data: existing } = await supabase
      .from('social_posts')
      .select('id, production_status, monteur_id, monteur_notified_at, coach_notified_at')
      .eq('id', id).eq('workspace_id', workspaceId).single()
    if (!existing) return NextResponse.json({ error: 'Post introuvable' }, { status: 404 })

    const { data: updated, error } = await supabase
      .from('social_posts')
      .update(post)
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .select()
      .single()
    if (error) throw error

    // Notifications monteur — déclenchées sur transition production_status
    if (updated && existing) {
      const wasFilmed = existing.production_status === 'filmed'
      const wasEdited = existing.production_status === 'edited'
      const nowFilmed = updated.production_status === 'filmed'
      const nowEdited = updated.production_status === 'edited'

      // to_film → filmed : prévenir le monteur
      if (!wasFilmed && nowFilmed && updated.monteur_id) {
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
    }

    if (publications) {
      // Strategy: upsert par (social_post_id, platform) — on remplace intégralement la liste
      await supabase.from('social_post_publications').delete().eq('social_post_id', id)
      if (publications.length > 0) {
        const rows = publications.map((p) => ({
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
    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof Error && e.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

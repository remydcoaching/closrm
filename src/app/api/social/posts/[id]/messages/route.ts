import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { z } from 'zod'

const messageSchema = z.object({
  body: z.string().trim().min(1).max(4000),
  video_timestamp_seconds: z.number().min(0).max(86400).nullable().optional(),
})

// GET /api/social/posts/[id]/messages
// Liste tous les messages du fil + les profils auteurs (pour afficher
// nom/avatar). Marque automatiquement le fil comme lu (last_read_at = now).
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: slotId } = await params
    const { workspaceId, userId } = await getWorkspaceId()
    const supabase = await createClient()

    const { data: messages, error } = await supabase
      .from('social_post_messages')
      .select('id, author_id, body, created_at, video_timestamp_seconds, resolved_at, resolved_by')
      .eq('social_post_id', slotId)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: true })
      .limit(500)
    if (error) throw error

    // Fetch users séparément (FK pointe vers auth.users, pas joinable via REST)
    const authorIds = Array.from(new Set((messages ?? []).map(m => m.author_id)))
    const { data: users } = authorIds.length > 0 ? await supabase
      .from('users')
      .select('id, full_name, email, avatar_url')
      .in('id', authorIds) : { data: [] }
    const userMap = new Map((users ?? []).map(u => [u.id, u]))
    const data = (messages ?? []).map(m => ({ ...m, author: userMap.get(m.author_id) ?? null }))

    // Marque comme lu (best-effort, ne bloque pas la réponse)
    await supabase
      .from('social_post_message_reads')
      .upsert(
        { social_post_id: slotId, user_id: userId, last_read_at: new Date().toISOString() },
        { onConflict: 'social_post_id,user_id' },
      )

    return NextResponse.json({ data: data ?? [] })
  } catch (e) {
    if (e instanceof Error && e.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

// POST /api/social/posts/[id]/messages
// Crée un nouveau message dans le fil.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: slotId } = await params
    const { workspaceId, userId } = await getWorkspaceId()
    const json = await request.json()
    const parsed = messageSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: createdMsg, error } = await supabase
      .from('social_post_messages')
      .insert({
        workspace_id: workspaceId,
        social_post_id: slotId,
        author_id: userId,
        body: parsed.data.body,
        video_timestamp_seconds: parsed.data.video_timestamp_seconds ?? null,
      })
      .select('id, author_id, body, created_at, video_timestamp_seconds, resolved_at, resolved_by')
      .single()
    if (error) throw error

    // Fetch author info pour la response (pour afficher dans le UI sans refetch list)
    const { data: author } = await supabase
      .from('users')
      .select('id, full_name, email, avatar_url')
      .eq('id', userId)
      .single()
    const created = { ...createdMsg, author: author ?? null }

    // L'auteur a forcément lu son propre message → on update son last_read_at
    await supabase
      .from('social_post_message_reads')
      .upsert(
        { social_post_id: slotId, user_id: userId, last_read_at: new Date().toISOString() },
        { onConflict: 'social_post_id,user_id' },
      )

    return NextResponse.json({ data: created }, { status: 201 })
  } catch (e) {
    if (e instanceof Error && e.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

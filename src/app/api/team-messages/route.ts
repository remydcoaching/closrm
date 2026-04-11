import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'

export async function GET(request: NextRequest) {
  try {
    const { userId, workspaceId } = await getWorkspaceId()
    const supabase = createServiceClient()

    const { searchParams } = new URL(request.url)
    const channel = searchParams.get('channel') ?? 'general'
    const withUserId = searchParams.get('with_user_id')
    const leadId = searchParams.get('lead_id')
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10) || 50, 200)

    let query = supabase
      .from('team_messages')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: true })
      .limit(limit)

    if (leadId) {
      // Messages tied to a specific lead
      query = query.eq('lead_id', leadId)
    } else if (channel === 'general') {
      // General channel: recipient_id is null and no lead_id
      query = query.is('recipient_id', null).is('lead_id', null)
    } else if (channel === 'private' && withUserId) {
      // Private DMs between current user and another user
      query = query
        .is('lead_id', null)
        .or(
          `and(sender_id.eq.${userId},recipient_id.eq.${withUserId}),and(sender_id.eq.${withUserId},recipient_id.eq.${userId})`
        )
    } else {
      return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 })
    }

    const { data: messages, error } = await query

    if (error) {
      console.error('[API /team-messages] GET error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Fetch sender profiles
    const senderIds = [...new Set((messages ?? []).map(m => m.sender_id))]
    const { data: users } = senderIds.length > 0
      ? await supabase.from('users').select('id, full_name, avatar_url').in('id', senderIds)
      : { data: [] }

    const userMap = new Map((users ?? []).map(u => [u.id, u]))

    const enriched = (messages ?? []).map(msg => ({
      ...msg,
      sender: userMap.get(msg.sender_id) ?? { id: msg.sender_id, full_name: 'Inconnu', avatar_url: null },
    }))

    return NextResponse.json({ data: enriched })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    console.error('[API /team-messages] GET unexpected error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId, workspaceId } = await getWorkspaceId()
    const supabase = createServiceClient()

    const body = await request.json()
    const { content, recipient_id, lead_id } = body as {
      content?: string
      recipient_id?: string | null
      lead_id?: string | null
    }

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json({ error: 'Le contenu du message est requis' }, { status: 400 })
    }

    const { data: message, error } = await supabase
      .from('team_messages')
      .insert({
        workspace_id: workspaceId,
        sender_id: userId,
        recipient_id: recipient_id ?? null,
        lead_id: lead_id ?? null,
        content: content.trim(),
      })
      .select()
      .single()

    if (error) {
      console.error('[API /team-messages] POST error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Fetch sender profile for the response
    const { data: sender } = await supabase
      .from('users')
      .select('id, full_name, avatar_url')
      .eq('id', userId)
      .single()

    return NextResponse.json({
      data: {
        ...message,
        sender: sender ?? { id: userId, full_name: 'Inconnu', avatar_url: null },
      },
    }, { status: 201 })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    console.error('[API /team-messages] POST unexpected error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

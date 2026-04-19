import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'

export async function GET(request: Request) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')?.trim().toLowerCase() || ''

    let query = supabase
      .from('email_conversations')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('last_message_at', { ascending: false, nullsFirst: false })

    if (search) {
      query = query.or(
        `participant_email.ilike.%${search}%,participant_name.ilike.%${search}%,subject.ilike.%${search}%`,
      )
    }

    const { data, error } = await query.limit(200)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ data: data || [] })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

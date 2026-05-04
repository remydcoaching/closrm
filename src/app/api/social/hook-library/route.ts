import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { z } from 'zod'

const createSchema = z.object({
  content: z.string().min(1).max(500),
  pillar_id: z.string().uuid().optional().nullable(),
  content_kind: z.enum(['post', 'story', 'reel']).optional().nullable(),
  source: z.enum(['manual', 'ai_generated', 'extracted']).optional().default('manual'),
})

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const url = new URL(request.url)
    const pillarFilter = url.searchParams.get('pillar_id')

    const supabase = await createClient()
    let query = supabase
      .from('social_hook_library')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('used_count', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(200)

    if (pillarFilter) query = query.eq('pillar_id', pillarFilter)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data: data ?? [] })
  } catch (e) {
    if (e instanceof Error && e.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { workspaceId, userId } = await getWorkspaceId()
    const body = await request.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('social_hook_library')
      .insert({ workspace_id: workspaceId, created_by: userId, ...parsed.data })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data }, { status: 201 })
  } catch (e) {
    if (e instanceof Error && e.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

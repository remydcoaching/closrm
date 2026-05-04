import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { upsertTrameSchema } from '@/lib/validations/content-trame'

export async function GET() {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('content_trame')
      .select('*')
      .eq('workspace_id', workspaceId)
      .maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const { data: gens } = await supabase
      .from('content_trame_generations')
      .select('year, month, generated_at, slots_created')
      .eq('workspace_id', workspaceId)
      .order('year', { ascending: false })
      .order('month', { ascending: false })

    return NextResponse.json({ data, generations: gens ?? [] })
  } catch (e) {
    if (e instanceof Error && e.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const body = await request.json()
    const parsed = upsertTrameSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('content_trame')
      .upsert(
        { workspace_id: workspaceId, ...parsed.data },
        { onConflict: 'workspace_id' }
      )
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (e) {
    if (e instanceof Error && e.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

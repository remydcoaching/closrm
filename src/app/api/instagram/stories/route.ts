import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { igStoriesFiltersSchema } from '@/lib/validations/instagram'

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const params = Object.fromEntries(request.nextUrl.searchParams.entries())
    const filters = igStoriesFiltersSchema.parse(params)

    let query = supabase
      .from('ig_stories')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('published_at', { ascending: false })

    if (filters.from) query = query.gte('published_at', filters.from)
    if (filters.to) query = query.lte('published_at', filters.to + 'T23:59:59Z')

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data: data ?? [] })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { extractHandlesFromTexts, dedupHandles } from '@/lib/ai/instagram-import'
import { extractTextSchema } from '@/lib/validations/instagram-import'

export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const body = await request.json()
    const parsed = extractTextSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const allHandles = dedupHandles(extractHandlesFromTexts(parsed.data.texts))

    if (allHandles.length === 0) {
      return NextResponse.json({ results: [] })
    }

    const { data: existingLeads } = await supabase
      .from('leads')
      .select('id, instagram_handle')
      .eq('workspace_id', workspaceId)
      .in('instagram_handle', allHandles)

    const existingByHandle = new Map((existingLeads ?? []).map((l) => [l.instagram_handle, l.id]))

    const results = allHandles.map((handle) => ({
      handle,
      already_exists: existingByHandle.has(handle),
      existing_lead_id: existingByHandle.get(handle),
    }))

    return NextResponse.json({ results })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    console.error('[API /leads/import-from-screenshots] Error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

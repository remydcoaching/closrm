import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { getApiKey } from '@/lib/ai/brief'
import { extractHandlesFromImage, dedupHandles } from '@/lib/ai/instagram-import'
import { extractImagesSchema } from '@/lib/validations/instagram-import'

export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const body = await request.json()
    const parsed = extractImagesSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const apiKey = await getApiKey(workspaceId)
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Clé API Claude non configurée. Allez dans Paramètres > Assistant IA.' },
        { status: 400 },
      )
    }

    const perImageResults = await Promise.all(
      parsed.data.images.map((img) => extractHandlesFromImage(img, apiKey)),
    )
    const allHandles = dedupHandles(perImageResults.flat())

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
    // DEBUG TEMPORAIRE: expose le message d'erreur réel pour diagnostiquer le 500 en prod. À retirer une fois la cause identifiée.
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur serveur' }, { status: 500 })
  }
}

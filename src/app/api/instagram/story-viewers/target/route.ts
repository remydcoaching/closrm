import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { targetStoryViewer } from '@/lib/instagram/story-viewer-target'

const schema = z.object({ instagramUserId: z.string().min(1).max(40) })

/** "Cibler" a story viewer — see src/lib/instagram/story-viewer-target.ts. */
export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const parsed = schema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'Données invalides' }, { status: 400 })
    const result = await targetStoryViewer(supabase, workspaceId, parsed.data.instagramUserId)
    if (!result) return NextResponse.json({ error: 'Spectateur introuvable' }, { status: 404 })
    return NextResponse.json({ data: result }, { status: result.created ? 201 : 200 })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur serveur' }, { status: 500 })
  }
}

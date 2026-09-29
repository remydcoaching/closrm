import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { HikerClient } from '@/lib/hiker/client'
import { countLeadsNeedingPicture, enrichLeadPictures, MAX_PICTURES_PER_RUN } from '@/lib/instagram/lead-pictures'

export const maxDuration = 300

/**
 * Instagram pictures of leads that have a handle but no photo.
 * GET  — how many leads would be looked up (≈ one billed Hiker request each).
 * POST — { limit } (≤ 300): looks them up via Hiker and saves each at once.
 */
export async function GET() {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    return NextResponse.json({ data: { missing: await countLeadsNeedingPicture(supabase, workspaceId), maxPerRun: MAX_PICTURES_PER_RUN } })
  } catch (err) {
    return failure(err)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const body = (await request.json().catch(() => ({}))) as { limit?: unknown }
    const limit = Math.min(Math.max(Number(body.limit) || 0, 1), MAX_PICTURES_PER_RUN)
    let client: HikerClient
    try {
      client = new HikerClient()
    } catch {
      return NextResponse.json({ error: 'HikerAPI non configuré sur le serveur' }, { status: 503 })
    }
    return NextResponse.json({ data: await enrichLeadPictures(supabase, workspaceId, client, limit) })
  } catch (err) {
    return failure(err)
  }
}

function failure(err: unknown) {
  if (err instanceof Error && err.message === 'Not authenticated') {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }
  return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
}

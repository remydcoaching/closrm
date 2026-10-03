import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { getBrief, saveBrief } from '@/lib/ai/brief'

// The AI provider key never goes back to a client: only its last 4 characters.
const MASK = '••••'
const maskKey = <T extends { api_key?: string | null } | null>(brief: T): T =>
  brief ? { ...brief, api_key: brief.api_key ? `${MASK}${brief.api_key.slice(-4)}` : null } : brief

export async function GET() {
  try {
    const { workspaceId } = await getWorkspaceId()
    const brief = await getBrief(workspaceId)
    return NextResponse.json({ data: maskKey(brief) })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const body = await request.json()
    // Unchanged key (absent, or the masked value we sent): keep the stored one.
    const sent = typeof body.api_key === 'string' ? body.api_key.trim() : ''
    const apiKey = sent && !sent.startsWith(MASK) ? sent : ((await getBrief(workspaceId))?.api_key ?? undefined)

    const brief = await saveBrief(workspaceId, {
      offer_description: body.offer_description || '',
      target_audience: body.target_audience || '',
      tone: body.tone || 'tu',
      approach: body.approach || '',
      example_messages: body.example_messages || '',
      goal: body.goal || 'book_call',
      api_key: apiKey,
    })

    return NextResponse.json({ data: maskKey(brief) }, { status: 201 })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
    }
    console.error('[API /ai/brief] Error:', err)
    return NextResponse.json({ error: 'Erreur lors de la sauvegarde' }, { status: 500 })
  }
}

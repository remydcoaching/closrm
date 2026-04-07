import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { getBrief, saveBrief } from '@/lib/ai/brief'

export async function GET() {
  try {
    const { workspaceId } = await getWorkspaceId()
    const brief = await getBrief(workspaceId)
    return NextResponse.json({ data: brief })
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

    const brief = await saveBrief(workspaceId, {
      offer_description: body.offer_description || '',
      target_audience: body.target_audience || '',
      tone: body.tone || 'tu',
      approach: body.approach || '',
      example_messages: body.example_messages || '',
      goal: body.goal || 'book_call',
      api_key: body.api_key,
    })

    return NextResponse.json({ data: brief }, { status: 201 })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
    }
    console.error('[API /ai/brief] Error:', err)
    return NextResponse.json({ error: 'Erreur lors de la sauvegarde' }, { status: 500 })
  }
}

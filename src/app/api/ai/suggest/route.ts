import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { generateSuggestion } from '@/lib/ai/suggest'

export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const body = await request.json()

    const leadId = body.lead_id as string
    const conversationId = body.conversation_id as string | undefined

    if (!leadId) {
      return NextResponse.json({ error: 'lead_id requis' }, { status: 400 })
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY non configuree' }, { status: 500 })
    }

    const suggestion = await generateSuggestion(workspaceId, leadId, conversationId)
    return NextResponse.json({ data: suggestion })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
    }
    console.error('[API /ai/suggest] Error:', err)
    return NextResponse.json({ error: 'Erreur lors de la generation' }, { status: 500 })
  }
}

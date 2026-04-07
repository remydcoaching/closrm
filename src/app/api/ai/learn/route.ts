import { NextResponse } from 'next/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { createClient } from '@/lib/supabase/server'
import { getBrief, getWinningConversations } from '@/lib/ai/brief'
import { callClaude } from '@/lib/ai/client'

export async function POST() {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const brief = await getBrief(workspaceId)
    if (!brief) return NextResponse.json({ error: 'Brief non configure' }, { status: 400 })

    const wins = await getWinningConversations(workspaceId, '', 10)
    if (wins.length === 0) return NextResponse.json({ error: 'Aucune conversation gagnante' }, { status: 400 })

    const prompt = `Voici le brief actuel d'un coach :\n\n${brief.generated_brief}\n\nVoici ${wins.length} conversations qui ont abouti a une vente :\n\n${wins.map((w, i) => `--- Conversation ${i + 1} ---\n${w.messages}`).join('\n\n')}\n\nAffine le brief en integrant les patterns qui fonctionnent dans ces conversations. Garde le meme format, meme longueur (200 mots max). Ameliore la strategie et les phrases types basees sur ce qui a reellement converti.`

    if (!brief.api_key) return NextResponse.json({ error: 'Cle API non configuree' }, { status: 400 })
    const updatedBrief = await callClaude(prompt, brief.api_key, 'claude-sonnet-4-5-20250514')

    await supabase
      .from('ai_coach_briefs')
      .update({
        generated_brief: updatedBrief,
        wins_analyzed: (brief.wins_analyzed || 0) + wins.length,
        updated_at: new Date().toISOString(),
      })
      .eq('workspace_id', workspaceId)

    return NextResponse.json({ data: { brief: updatedBrief, wins_analyzed: wins.length } })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { getBrief, getApiKey } from '@/lib/ai/brief'
import { callClaude } from '@/lib/ai/client'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 30

interface Body {
  pillar_id?: string | null
  content_kind?: 'post' | 'story' | 'reel'
  topic?: string
  count?: number
}

export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const body = (await request.json()) as Body
    const count = Math.min(Math.max(body.count ?? 5, 1), 10)

    const brief = await getBrief(workspaceId)
    const apiKey = await getApiKey(workspaceId)
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Clé API non configurée. Allez dans Paramètres > Assistant IA.' },
        { status: 400 }
      )
    }

    let pillarName: string | null = null
    if (body.pillar_id) {
      const supabase = await createClient()
      const { data } = await supabase
        .from('ig_content_pillars')
        .select('name')
        .eq('id', body.pillar_id)
        .eq('workspace_id', workspaceId)
        .maybeSingle()
      pillarName = data?.name ?? null
    }

    const kindLabel =
      body.content_kind === 'story' ? 'story Instagram (24h)'
      : body.content_kind === 'reel' ? 'reel/short vidéo verticale'
      : 'post réseaux sociaux'

    const prompt = `Tu es un copywriter expert en hooks viraux pour coachs indépendants sur les réseaux sociaux.

CONTEXTE DU COACH :
${brief?.generated_brief ?? 'Pas de brief — utilise un ton chaleureux, direct, et orienté résultat.'}

TÂCHE :
Génère exactement ${count} hooks (accroches en 1 ligne) pour un ${kindLabel}.
${pillarName ? `Type de contenu (pillar) : ${pillarName}` : ''}
${body.topic ? `Sujet/thématique : ${body.topic}` : ''}

CONTRAINTES :
- Français
- Chaque hook = 1 phrase maximum, percutante
- Variété : pose des questions, fais des promesses, crée du suspens, choque, intrigue
- Pas d'emojis
- Pas de #hashtags
- Pas de numérotation, pas de tirets

Format de sortie EXACT (un hook par ligne, rien d'autre, pas de préambule) :
Hook 1
Hook 2
...`

    const result = await callClaude(prompt, apiKey, 'claude-sonnet-4-20250514')
    const hooks = result
      .split('\n')
      .map((l) => l.trim().replace(/^[\d]+[.)]\s*/, '').replace(/^[-•*]\s*/, ''))
      .filter((l) => l.length > 0 && l.length < 280)
      .slice(0, count)

    if (hooks.length === 0) throw new Error('Aucun hook généré')

    return NextResponse.json({ hooks })
  } catch (e) {
    if (e instanceof Error && e.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
